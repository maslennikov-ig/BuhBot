#!/usr/bin/env bash

# ============================================================================
# BuhBot Security Audit Script
# ============================================================================
# Purpose: Perform comprehensive security checks on BuhBot infrastructure
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following security checks:
# 1. HTTPS certificate validation (if configured)
# 2. Hardcoded secrets detection in codebase
# 3. Webhook signature configuration verification
# 4. RLS (Row Level Security) policies verification
# 5. Firewall (UFW) status check
# 6. Docker container non-root user verification
# 7. Exposed ports analysis
#
# Requirements:
# - Bash 4.0+
# - Optional: openssl (for cert checks)
# - Optional: ufw (for firewall checks)
# - Optional: docker (for container checks)
# - Optional: psql (for RLS checks)
#
# Usage:
#   ./security-audit.sh                # Run all security checks
#   ./security-audit.sh --verbose      # Run with detailed output
#   ./security-audit.sh --help         # Show help
#
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
# ============================================================================

set -uo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

# Command-line flags
VERBOSE=false

# Color codes for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_BOLD='\033[1m'
readonly COLOR_RESET='\033[0m'

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

# Expected open ports (customize as needed)
readonly EXPECTED_PORTS="22 80 443"

# Secret patterns to search for
readonly SECRET_PATTERNS=(
    'AWS_SECRET_ACCESS_KEY\s*[=:]\s*["\x27][A-Za-z0-9/+=]{40}["\x27]'
    'AWS_ACCESS_KEY_ID\s*[=:]\s*["\x27]AKIA[A-Z0-9]{16}["\x27]'
    'api[_-]?key\s*[=:]\s*["\x27][A-Za-z0-9_-]{20,}["\x27]'
    'api[_-]?secret\s*[=:]\s*["\x27][A-Za-z0-9_-]{20,}["\x27]'
    'password\s*[=:]\s*["\x27][^"\x27]{8,}["\x27]'
    'secret\s*[=:]\s*["\x27][A-Za-z0-9_-]{16,}["\x27]'
    'token\s*[=:]\s*["\x27][A-Za-z0-9_.-]{20,}["\x27]'
    'private[_-]?key\s*[=:]\s*["\x27]'
    'TELEGRAM_BOT_TOKEN\s*[=:]\s*["\x27][0-9]+:[A-Za-z0-9_-]{35}["\x27]'
    'DATABASE_URL\s*[=:]\s*["\x27]postgres(ql)?://[^"\x27]+["\x27]'
    'SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*["\x27]eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+["\x27]'
)

# Directories to exclude from secret scanning
readonly EXCLUDE_DIRS=(
    "node_modules"
    ".git"
    ".next"
    "dist"
    "build"
    "coverage"
    ".pnpm-store"
    "vendor"
)

# ============================================================================
# Output Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${COLOR_BOLD}BuhBot Security Audit Report${COLOR_RESET}"
    echo "============================"
    echo "Version: $SCRIPT_VERSION"
    echo "Date: $(date +'%Y-%m-%d %H:%M:%S')"
    echo "Project: $PROJECT_ROOT"
    echo ""
}

print_pass() {
    echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $*"
    ((PASS_COUNT++))
}

print_fail() {
    echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $*"
    ((FAIL_COUNT++))
}

print_warn() {
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"
    ((WARN_COUNT++))
}

print_skip() {
    echo -e "${COLOR_BLUE}[SKIP]${COLOR_RESET} $*"
    ((SKIP_COUNT++))
}

print_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"
    fi
}

print_detail() {
    if [ "$VERBOSE" = true ]; then
        echo "       $*"
    fi
}

print_summary() {
    echo ""
    echo "============================"
    echo -e "${COLOR_BOLD}Summary${COLOR_RESET}"
    echo "============================"

    local total=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT + SKIP_COUNT))

    echo -e "Total checks: $total"
    echo -e "${COLOR_GREEN}Passed:${COLOR_RESET}  $PASS_COUNT"
    echo -e "${COLOR_RED}Failed:${COLOR_RESET}  $FAIL_COUNT"
    echo -e "${COLOR_YELLOW}Warnings:${COLOR_RESET} $WARN_COUNT"
    echo -e "${COLOR_BLUE}Skipped:${COLOR_RESET} $SKIP_COUNT"
    echo ""

    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "${COLOR_RED}${COLOR_BOLD}SECURITY AUDIT FAILED${COLOR_RESET}"
        echo "Please address the failed checks before deployment."
    elif [ "$WARN_COUNT" -gt 0 ]; then
        echo -e "${COLOR_YELLOW}${COLOR_BOLD}SECURITY AUDIT PASSED WITH WARNINGS${COLOR_RESET}"
        echo "Review warnings and address if possible."
    else
        echo -e "${COLOR_GREEN}${COLOR_BOLD}SECURITY AUDIT PASSED${COLOR_RESET}"
        echo "All security checks passed successfully."
    fi
}

# ============================================================================
# Help Function
# ============================================================================

show_help() {
    cat << EOF
BuhBot Security Audit Script v$SCRIPT_VERSION

Usage: $(basename "$0") [OPTIONS]

Options:
  --verbose, -v    Show detailed output for each check
  --help, -h       Show this help message

Security Checks Performed:
  1. HTTPS Certificate - Validates SSL certificate (if configured)
  2. Hardcoded Secrets - Scans codebase for exposed credentials
  3. Webhook Signature - Verifies Telegram webhook signature validation
  4. RLS Policies     - Checks Supabase Row Level Security (if connected)
  5. Firewall Status  - Verifies UFW is active and configured
  6. Docker Non-Root  - Ensures containers run as non-root users
  7. Exposed Ports    - Validates only expected ports are open

Exit Codes:
  0 - All checks passed
  1 - One or more checks failed

Examples:
  ./security-audit.sh              # Run standard audit
  ./security-audit.sh --verbose    # Run with detailed output
  ./security-audit.sh -v           # Short form

EOF
    exit 0
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# Security Check Functions
# ============================================================================

# Check 1: HTTPS Certificate Validation
check_https_certificate() {
    print_info "Checking HTTPS certificate..."

    local ssl_dir="$INFRASTRUCTURE_DIR/nginx/ssl"
    local cert_file=""

    # Try to find certificate file
    if [ -f "$ssl_dir/fullchain.pem" ]; then
        cert_file="$ssl_dir/fullchain.pem"
    elif [ -f "$ssl_dir/cert.pem" ]; then
        cert_file="$ssl_dir/cert.pem"
    elif [ -f "$ssl_dir/server.crt" ]; then
        cert_file="$ssl_dir/server.crt"
    fi

    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        print_skip "HTTPS certificate check (openssl not installed)"
        return
    fi

    # Check if certificate exists
    if [ -z "$cert_file" ] || [ ! -f "$cert_file" ]; then
        print_warn "HTTPS certificate not found (SSL not configured)"
        print_detail "Expected location: $ssl_dir"
        return
    fi

    # Validate certificate
    local expiry_date
    local expiry_epoch
    local current_epoch
    local days_remaining

    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)

    if [ -z "$expiry_date" ]; then
        print_fail "HTTPS certificate is invalid or corrupted"
        return
    fi

    expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null)
    current_epoch=$(date +%s)
    days_remaining=$(( (expiry_epoch - current_epoch) / 86400 ))

    if [ "$days_remaining" -lt 0 ]; then
        print_fail "HTTPS certificate has expired ($days_remaining days ago)"
    elif [ "$days_remaining" -lt 7 ]; then
        print_fail "HTTPS certificate expires in $days_remaining days (critical)"
    elif [ "$days_remaining" -lt 30 ]; then
        print_warn "HTTPS certificate expires in $days_remaining days (renew soon)"
    else
        print_pass "HTTPS certificate valid (expires in $days_remaining days)"
    fi

    print_detail "Certificate file: $cert_file"
    print_detail "Expiry date: $expiry_date"
}

# Check 2: Hardcoded Secrets Detection
check_hardcoded_secrets() {
    print_info "Scanning for hardcoded secrets..."

    local exclude_args=""
    local secrets_found=0
    local findings=""

    # Build exclude arguments for grep
    for dir in "${EXCLUDE_DIRS[@]}"; do
        exclude_args="$exclude_args --exclude-dir=$dir"
    done

    # Also exclude common non-code files
    exclude_args="$exclude_args --exclude=*.md --exclude=*.lock --exclude=package-lock.json"
    exclude_args="$exclude_args --exclude=pnpm-lock.yaml --exclude=yarn.lock"
    exclude_args="$exclude_args --exclude=*.min.js --exclude=*.min.css"
    exclude_args="$exclude_args --exclude=*.map --exclude=*.woff* --exclude=*.ttf"
    exclude_args="$exclude_args --exclude=*.png --exclude=*.jpg --exclude=*.svg"

    cd "$PROJECT_ROOT" || {
        print_fail "Hardcoded secrets check (cannot access project root)"
        return
    }

    # Search for each secret pattern
    for pattern in "${SECRET_PATTERNS[@]}"; do
        local result
        # Use grep with extended regex, case-insensitive
        # shellcheck disable=SC2086
        result=$(grep -rniE $exclude_args "$pattern" . 2>/dev/null || true)

        if [ -n "$result" ]; then
            secrets_found=$((secrets_found + 1))
            findings="$findings\n$result"
        fi
    done

    # Additional check for .env files that might be committed
    local env_files
    env_files=$(find . -name ".env" -o -name ".env.local" -o -name ".env.production" 2>/dev/null | grep -v node_modules | grep -v .git || true)

    if [ -n "$env_files" ]; then
        # Check if any .env files contain actual secrets (not placeholders)
        while IFS= read -r env_file; do
            if [ -f "$env_file" ]; then
                # Check if file contains non-placeholder values
                if grep -qE '^[A-Z_]+=.{10,}' "$env_file" 2>/dev/null; then
                    # Exclude obvious placeholders
                    if ! grep -qE '(your-|example|placeholder|changeme|xxx)' "$env_file" 2>/dev/null; then
                        print_detail "Warning: $env_file may contain real secrets"
                    fi
                fi
            fi
        done <<< "$env_files"
    fi

    if [ "$secrets_found" -gt 0 ]; then
        print_fail "Hardcoded secrets detected ($secrets_found patterns found)"
        if [ "$VERBOSE" = true ]; then
            echo -e "$findings" | head -20
            echo "       (showing first 20 matches)"
        fi
    else
        print_pass "No hardcoded secrets found"
    fi

    print_detail "Scanned directories: $PROJECT_ROOT"
    print_detail "Excluded: ${EXCLUDE_DIRS[*]}"
}

# Check 3: Webhook Signature Validation
check_webhook_signature() {
    print_info "Checking webhook signature configuration..."

    # Look for webhook signature validation in backend code
    local backend_dir="$PROJECT_ROOT/backend"
    local webhook_validation_found=false

    if [ ! -d "$backend_dir" ]; then
        backend_dir="$PROJECT_ROOT/src"
    fi

    if [ ! -d "$backend_dir" ]; then
        print_skip "Webhook signature check (backend directory not found)"
        return
    fi

    # Search for Telegram webhook signature validation patterns
    local validation_patterns=(
        "verifyWebhook"
        "crypto.createHmac"
        "X-Telegram-Bot-Api-Secret-Token"
        "secret_token"
        "webhookSecret"
        "WEBHOOK_SECRET"
        "validateTelegramWebhook"
    )

    for pattern in "${validation_patterns[@]}"; do
        if grep -rq "$pattern" "$backend_dir" 2>/dev/null; then
            webhook_validation_found=true
            print_detail "Found pattern: $pattern"
            break
        fi
    done

    # Also check for grammy or telegraf webhook handling
    if grep -rqE "(webhookCallback|handleUpdate.*secret)" "$backend_dir" 2>/dev/null; then
        webhook_validation_found=true
        print_detail "Found framework webhook handler"
    fi

    # Check environment for webhook secret configuration
    local env_files=("$PROJECT_ROOT/backend/.env.example" "$INFRASTRUCTURE_DIR/.env.example")
    local webhook_secret_configured=false

    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            if grep -qE "(WEBHOOK_SECRET|TELEGRAM_WEBHOOK_SECRET|BOT_WEBHOOK_SECRET)" "$env_file" 2>/dev/null; then
                webhook_secret_configured=true
                print_detail "Webhook secret in env: $env_file"
                break
            fi
        fi
    done

    if [ "$webhook_validation_found" = true ]; then
        print_pass "Webhook signature validation enabled"
    elif [ "$webhook_secret_configured" = true ]; then
        print_warn "Webhook secret configured but validation code not detected"
        print_detail "Ensure webhook handler validates the secret token"
    else
        print_warn "Webhook signature validation not detected"
        print_detail "Consider implementing X-Telegram-Bot-Api-Secret-Token validation"
    fi
}

# Check 4: RLS Policies Verification
check_rls_policies() {
    print_info "Checking Supabase RLS policies..."

    # Check if we have database connection info
    local db_url=""
    local env_files=(
        "$PROJECT_ROOT/backend/.env"
        "$PROJECT_ROOT/.env"
        "$INFRASTRUCTURE_DIR/.env"
    )

    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            db_url=$(grep -E "^DATABASE_URL=" "$env_file" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
            if [ -n "$db_url" ]; then
                break
            fi
        fi
    done

    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        print_skip "RLS policies check (psql not installed)"
        return
    fi

    if [ -z "$db_url" ]; then
        print_skip "RLS policies check (no DATABASE_URL found)"
        print_detail "Set DATABASE_URL in .env to enable this check"
        return
    fi

    # Query to check RLS status on tables
    local rls_query="
        SELECT
            schemaname,
            tablename,
            rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
    "

    local result
    result=$(PGPASSWORD="" psql "$db_url" -t -c "$rls_query" 2>/dev/null || true)

    if [ -z "$result" ]; then
        print_warn "RLS policies check failed (cannot connect to database)"
        print_detail "Database URL: ${db_url:0:50}..."
        return
    fi

    local tables_without_rls=0
    local total_tables=0

    while IFS='|' read -r schema table rls_enabled; do
        table=$(echo "$table" | xargs)
        rls_enabled=$(echo "$rls_enabled" | xargs)

        if [ -n "$table" ]; then
            total_tables=$((total_tables + 1))
            if [ "$rls_enabled" != "t" ]; then
                tables_without_rls=$((tables_without_rls + 1))
                print_detail "No RLS: public.$table"
            fi
        fi
    done <<< "$result"

    if [ "$total_tables" -eq 0 ]; then
        print_skip "RLS policies check (no tables in public schema)"
    elif [ "$tables_without_rls" -eq 0 ]; then
        print_pass "RLS enabled on all $total_tables public tables"
    elif [ "$tables_without_rls" -eq "$total_tables" ]; then
        print_fail "RLS not enabled on any tables ($tables_without_rls of $total_tables)"
    else
        print_warn "RLS not enabled on $tables_without_rls of $total_tables tables"
    fi
}

# Check 5: Firewall Status
check_firewall_status() {
    print_info "Checking firewall status..."

    # Check if ufw is available
    if ! command -v ufw &> /dev/null; then
        print_skip "Firewall check (ufw not installed)"
        return
    fi

    # Check if we can run ufw status (may need sudo)
    local ufw_status
    ufw_status=$(sudo ufw status 2>/dev/null || ufw status 2>/dev/null || true)

    if [ -z "$ufw_status" ]; then
        print_skip "Firewall check (insufficient permissions)"
        print_detail "Run as root or with sudo to check firewall status"
        return
    fi

    # Check if firewall is active
    if echo "$ufw_status" | grep -q "Status: active"; then
        print_pass "Firewall (ufw) is active"

        # Show rules in verbose mode
        if [ "$VERBOSE" = true ]; then
            echo "$ufw_status" | while IFS= read -r line; do
                print_detail "$line"
            done
        fi
    elif echo "$ufw_status" | grep -q "Status: inactive"; then
        print_fail "Firewall (ufw) is inactive"
        print_detail "Enable with: sudo ufw enable"
    else
        print_warn "Firewall status unclear"
        print_detail "Output: $ufw_status"
    fi
}

# Check 6: Docker Non-Root Users
check_docker_nonroot() {
    print_info "Checking Docker container users..."

    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        print_skip "Docker non-root check (docker not installed)"
        return
    fi

    # Check if docker daemon is running
    if ! docker info &> /dev/null; then
        print_skip "Docker non-root check (docker daemon not running)"
        return
    fi

    # Get running containers for this project
    local containers
    containers=$(docker ps --filter "name=buhbot" --format "{{.Names}}" 2>/dev/null || true)

    if [ -z "$containers" ]; then
        print_skip "Docker non-root check (no BuhBot containers running)"
        return
    fi

    local root_containers=0
    local total_containers=0
    local root_container_names=""

    while IFS= read -r container; do
        if [ -n "$container" ]; then
            total_containers=$((total_containers + 1))

            # Get the user the container is running as
            local user
            user=$(docker exec "$container" whoami 2>/dev/null || docker inspect --format '{{.Config.User}}' "$container" 2>/dev/null || echo "unknown")

            # If user is empty or root, count it
            if [ -z "$user" ] || [ "$user" = "root" ] || [ "$user" = "0" ]; then
                root_containers=$((root_containers + 1))
                root_container_names="$root_container_names $container"
                print_detail "Root user: $container"
            else
                print_detail "Non-root ($user): $container"
            fi
        fi
    done <<< "$containers"

    if [ "$total_containers" -eq 0 ]; then
        print_skip "Docker non-root check (no containers to check)"
    elif [ "$root_containers" -eq 0 ]; then
        print_pass "All $total_containers containers run as non-root"
    else
        print_warn "$root_containers of $total_containers containers run as root"
        print_detail "Root containers:$root_container_names"
    fi
}

# Check 7: Exposed Ports Analysis
check_exposed_ports() {
    print_info "Checking exposed ports..."

    # Try multiple methods to get listening ports
    local listening_ports=""

    # Method 1: ss (modern)
    if command -v ss &> /dev/null; then
        listening_ports=$(ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | grep -oE '[0-9]+$' | sort -u || true)
    fi

    # Method 2: netstat (fallback)
    if [ -z "$listening_ports" ] && command -v netstat &> /dev/null; then
        listening_ports=$(netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | grep -oE '[0-9]+$' | sort -u || true)
    fi

    # Method 3: Docker ports
    if [ -z "$listening_ports" ] && command -v docker &> /dev/null; then
        listening_ports=$(docker ps --format "{{.Ports}}" 2>/dev/null | grep -oE '0\.0\.0\.0:[0-9]+' | cut -d: -f2 | sort -u || true)
    fi

    if [ -z "$listening_ports" ]; then
        print_skip "Exposed ports check (cannot determine listening ports)"
        print_detail "Try running as root or check if ss/netstat is available"
        return
    fi

    local unexpected_ports=""
    local unexpected_count=0

    while IFS= read -r port; do
        if [ -n "$port" ]; then
            # Check if port is in expected list
            local is_expected=false
            for expected in $EXPECTED_PORTS; do
                if [ "$port" = "$expected" ]; then
                    is_expected=true
                    break
                fi
            done

            # Common internal ports (not publicly exposed typically)
            case "$port" in
                3000|3001|3002|3003|6379|9090|9100)
                    # These are internal ports, usually bound to localhost
                    print_detail "Internal port: $port"
                    ;;
                *)
                    if [ "$is_expected" = false ]; then
                        unexpected_ports="$unexpected_ports $port"
                        unexpected_count=$((unexpected_count + 1))
                    fi
                    ;;
            esac
        fi
    done <<< "$listening_ports"

    if [ "$unexpected_count" -eq 0 ]; then
        print_pass "Only expected ports exposed ($EXPECTED_PORTS)"
    else
        print_warn "Unexpected ports exposed:$unexpected_ports"
        print_detail "Expected ports: $EXPECTED_PORTS"
        print_detail "Review if these ports should be publicly accessible"
    fi

    if [ "$VERBOSE" = true ]; then
        echo "       All listening ports: $(echo "$listening_ports" | tr '\n' ' ')"
    fi
}

# ============================================================================
# Additional Security Checks
# ============================================================================

# Check 8: Docker Compose Security Settings
check_docker_compose_security() {
    print_info "Checking Docker Compose security settings..."

    local compose_file="$INFRASTRUCTURE_DIR/docker-compose.yml"

    if [ ! -f "$compose_file" ]; then
        print_skip "Docker Compose security check (file not found)"
        return
    fi

    local issues=0

    # Check for privileged containers
    if grep -q "privileged:\s*true" "$compose_file" 2>/dev/null; then
        print_detail "Warning: Privileged container found"
        issues=$((issues + 1))
    fi

    # Check for host network mode
    if grep -q "network_mode:\s*host" "$compose_file" 2>/dev/null; then
        print_detail "Warning: Host network mode found"
        issues=$((issues + 1))
    fi

    # Check for read-only root filesystem (good practice)
    local has_readonly=false
    if grep -q "read_only:\s*true" "$compose_file" 2>/dev/null; then
        has_readonly=true
    fi

    # Check for security_opt or cap_drop (good practice)
    local has_security_opts=false
    if grep -qE "(security_opt|cap_drop)" "$compose_file" 2>/dev/null; then
        has_security_opts=true
    fi

    if [ "$issues" -eq 0 ]; then
        print_pass "Docker Compose has no obvious security issues"
        if [ "$has_readonly" = false ] && [ "$VERBOSE" = true ]; then
            print_detail "Consider adding read_only: true to services"
        fi
        if [ "$has_security_opts" = false ] && [ "$VERBOSE" = true ]; then
            print_detail "Consider adding security_opt or cap_drop"
        fi
    else
        print_warn "Docker Compose has $issues security concerns"
    fi
}

# Check 9: File Permissions
check_file_permissions() {
    print_info "Checking sensitive file permissions..."

    local issues=0
    local checked=0

    # Check .env files are not world-readable
    while IFS= read -r env_file; do
        if [ -f "$env_file" ]; then
            checked=$((checked + 1))
            local perms
            perms=$(stat -c "%a" "$env_file" 2>/dev/null || stat -f "%Lp" "$env_file" 2>/dev/null || echo "")

            if [ -n "$perms" ]; then
                # Check if world-readable (last digit > 0)
                local world_perms=${perms: -1}
                if [ "$world_perms" -gt 0 ]; then
                    issues=$((issues + 1))
                    print_detail "World-readable: $env_file ($perms)"
                fi
            fi
        fi
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f 2>/dev/null | grep -v node_modules | grep -v .git)

    # Check SSL key files
    local ssl_dir="$INFRASTRUCTURE_DIR/nginx/ssl"
    if [ -d "$ssl_dir" ]; then
        while IFS= read -r key_file; do
            if [ -f "$key_file" ]; then
                checked=$((checked + 1))
                local perms
                perms=$(stat -c "%a" "$key_file" 2>/dev/null || stat -f "%Lp" "$key_file" 2>/dev/null || echo "")

                if [ -n "$perms" ] && [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
                    issues=$((issues + 1))
                    print_detail "Insecure permissions: $key_file ($perms)"
                fi
            fi
        done < <(find "$ssl_dir" -name "*.key" -o -name "*privkey*" 2>/dev/null)
    fi

    if [ "$checked" -eq 0 ]; then
        print_skip "File permissions check (no sensitive files found)"
    elif [ "$issues" -eq 0 ]; then
        print_pass "Sensitive file permissions are secure"
    else
        print_warn "$issues files have insecure permissions"
    fi
}

# ============================================================================
# Main Function
# ============================================================================

main() {
    parse_arguments "$@"

    print_header

    echo "Running security checks..."
    echo ""

    # Run all security checks
    check_https_certificate
    check_hardcoded_secrets
    check_webhook_signature
    check_rls_policies
    check_firewall_status
    check_docker_nonroot
    check_exposed_ports
    check_docker_compose_security
    check_file_permissions

    print_summary

    # Exit with appropriate code
    if [ "$FAIL_COUNT" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

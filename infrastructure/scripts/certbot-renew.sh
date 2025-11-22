#!/usr/bin/env bash

# ============================================================================
# BuhBot Let's Encrypt Certificate Renewal Script
# ============================================================================
# Purpose: Automatic SSL certificate renewal with Nginx reload
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Checks certificate expiration status
# 2. Attempts certificate renewal via Certbot
# 3. Reloads Nginx if renewal successful
# 4. Logs renewal results
# 5. Optionally sets up cron job for automatic renewal
#
# Requirements:
# - Docker installed and running
# - Let's Encrypt certificates already acquired (see certbot-init.sh)
# - Nginx container running with certificate volumes mounted
#
# Usage:
#   ./certbot-renew.sh                    # Run renewal check
#   ./certbot-renew.sh --force            # Force renewal attempt
#   ./certbot-renew.sh --check-only       # Only check expiration, no renewal
#   ./certbot-renew.sh --setup-cron       # Install automatic renewal cron job
#   ./certbot-renew.sh --remove-cron      # Remove automatic renewal cron job
#
# Cron Schedule (when installed):
#   0 0,12 * * * - Twice daily at midnight and noon (recommended by Let's Encrypt)
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

# Domain for renewal (can be overridden with --domain flag)
DOMAIN="${BUHBOT_DOMAIN:-}"

# ============================================================================
# Script Configuration (do not edit unless you know what you're doing)
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_PATH="$SCRIPT_DIR/$(basename "$0")"
readonly INFRASTRUCTURE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker image for Certbot
readonly CERTBOT_IMAGE="certbot/certbot:v2.7.4"

# Volume names (must match docker-compose.yml and certbot-init.sh)
readonly CERTBOT_DATA_VOLUME="buhbot-certbot-data"
readonly LETSENCRYPT_VOLUME="buhbot-letsencrypt"

# Webroot path (must match nginx.conf)
readonly WEBROOT_PATH="/var/www/certbot"

# Nginx container name (from docker-compose.yml)
readonly NGINX_CONTAINER="buhbot-nginx"

# Renewal threshold (days before expiry to renew)
readonly RENEWAL_THRESHOLD_DAYS=30

# Log file location
readonly LOG_DIR="/var/log/buhbot"
readonly LOG_FILE="${LOG_DIR}/certbot-renewal.log"

# Cron schedule (twice daily as recommended by Let's Encrypt)
readonly CRON_SCHEDULE="0 0,12 * * *"
readonly CRON_IDENTIFIER="buhbot-certbot-renew"

# Command-line flags
FORCE_RENEWAL=false
CHECK_ONLY=false
SETUP_CRON=false
REMOVE_CRON=false
DRY_RUN=false
QUIET=false

# Color codes for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# ============================================================================
# Logging Functions
# ============================================================================

log_info() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*"
    [ "$QUIET" = false ] && echo -e "${COLOR_BLUE}${message}${COLOR_RESET}"
    log_to_file "$message"
}

log_success() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS] $*"
    [ "$QUIET" = false ] && echo -e "${COLOR_GREEN}${message}${COLOR_RESET}"
    log_to_file "$message"
}

log_warning() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING] $*"
    [ "$QUIET" = false ] && echo -e "${COLOR_YELLOW}${message}${COLOR_RESET}"
    log_to_file "$message"
}

log_error() {
    local message="[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*"
    [ "$QUIET" = false ] && echo -e "${COLOR_RED}${message}${COLOR_RESET}" >&2
    log_to_file "$message"
}

log_dry_run() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${COLOR_YELLOW}[DRY RUN]${COLOR_RESET} $*"
    fi
}

log_to_file() {
    # Create log directory if it doesn't exist (requires sudo in production)
    if [ -d "$LOG_DIR" ] || mkdir -p "$LOG_DIR" 2>/dev/null; then
        echo "$1" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --force)
                FORCE_RENEWAL=true
                shift
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --setup-cron)
                SETUP_CRON=true
                shift
                ;;
            --remove-cron)
                REMOVE_CRON=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE ENABLED - No changes will be made"
                shift
                ;;
            --quiet|-q)
                QUIET=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
BuhBot Let's Encrypt Certificate Renewal Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --domain DOMAIN    Domain name to renew (optional, renews all if not specified)
  --force            Force renewal attempt even if certificate is not due
  --check-only       Only check expiration status, do not attempt renewal
  --setup-cron       Install automatic renewal cron job
  --remove-cron      Remove automatic renewal cron job
  --dry-run          Perform a dry run without making changes
  --quiet, -q        Suppress console output (log to file only)
  -h, --help         Show this help message

Environment Variables:
  BUHBOT_DOMAIN      Domain name (alternative to --domain flag)

Examples:
  # Check and renew certificates if needed
  $0

  # Force renewal
  $0 --force

  # Check expiration only
  $0 --check-only

  # Setup automatic renewal cron job
  sudo $0 --setup-cron

  # Remove cron job
  sudo $0 --remove-cron

  # Quiet mode for cron (output to log file only)
  $0 --quiet

Cron Job Details:
  Schedule: $CRON_SCHEDULE (twice daily at midnight and noon)
  Log file: $LOG_FILE

EOF
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

check_certificates_exist() {
    log_info "Checking for existing certificates..."

    if ! docker volume ls --format '{{.Name}}' | grep -q "^${LETSENCRYPT_VOLUME}$"; then
        log_error "Let's Encrypt volume not found: $LETSENCRYPT_VOLUME"
        log_error "Run certbot-init.sh first to acquire certificates"
        exit 1
    fi

    # Check if any certificates exist
    local cert_count
    cert_count=$(docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        alpine sh -c "ls -d /etc/letsencrypt/live/*/ 2>/dev/null | wc -l" || echo "0")

    if [ "$cert_count" -eq 0 ]; then
        log_error "No certificates found in $LETSENCRYPT_VOLUME"
        log_error "Run certbot-init.sh first to acquire certificates"
        exit 1
    fi

    log_success "Found $cert_count certificate(s)"
}

check_nginx_running() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
        log_warning "Nginx container ($NGINX_CONTAINER) is not running"
        log_warning "Certificate renewal may work, but Nginx reload will fail"
    fi
}

# ============================================================================
# Certificate Status Check
# ============================================================================

check_certificate_expiration() {
    log_info "Checking certificate expiration..."

    local domains_info
    domains_info=$(docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        "$CERTBOT_IMAGE" \
        certificates 2>/dev/null || echo "")

    if [ -z "$domains_info" ]; then
        log_error "Could not retrieve certificate information"
        return 1
    fi

    echo "$domains_info"

    # Parse expiration dates and check if any need renewal
    local needs_renewal=false
    local current_timestamp
    current_timestamp=$(date +%s)

    # Get all certificate directories
    local cert_domains
    cert_domains=$(docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        alpine sh -c "ls /etc/letsencrypt/live/ 2>/dev/null | grep -v README" || echo "")

    for domain_dir in $cert_domains; do
        # Skip if specific domain requested and this isn't it
        if [ -n "$DOMAIN" ] && [ "$domain_dir" != "$DOMAIN" ]; then
            continue
        fi

        local expiry_date
        expiry_date=$(docker run --rm \
            -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
            alpine sh -c "openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain_dir}/fullchain.pem 2>/dev/null | cut -d= -f2" || echo "")

        if [ -n "$expiry_date" ]; then
            local expiry_timestamp
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")

            if [ "$expiry_timestamp" -gt 0 ]; then
                local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))

                if [ $days_until_expiry -lt $RENEWAL_THRESHOLD_DAYS ]; then
                    log_warning "$domain_dir: Expires in $days_until_expiry days - RENEWAL NEEDED"
                    needs_renewal=true
                else
                    log_success "$domain_dir: Expires in $days_until_expiry days - OK"
                fi
            fi
        fi
    done

    if [ "$needs_renewal" = true ]; then
        return 0  # Signal that renewal is needed
    else
        return 1  # No renewal needed
    fi
}

# ============================================================================
# Certificate Renewal
# ============================================================================

renew_certificates() {
    log_info "Attempting certificate renewal..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: docker run certbot/certbot renew --webroot --webroot-path=$WEBROOT_PATH"
        return 0
    fi

    # Build certbot command
    local certbot_cmd="renew"
    certbot_cmd+=" --webroot"
    certbot_cmd+=" --webroot-path=$WEBROOT_PATH"
    certbot_cmd+=" --quiet"

    if [ "$FORCE_RENEWAL" = true ]; then
        certbot_cmd+=" --force-renewal"
        log_info "Force renewal enabled"
    fi

    # Run Certbot renewal
    local renewal_output
    local renewal_status

    renewal_output=$(docker run --rm \
        -v "${CERTBOT_DATA_VOLUME}:${WEBROOT_PATH}" \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt" \
        --name "buhbot-certbot-renew" \
        "$CERTBOT_IMAGE" \
        $certbot_cmd 2>&1) && renewal_status=0 || renewal_status=$?

    if [ $renewal_status -eq 0 ]; then
        log_success "Certificate renewal completed successfully"

        # Check if any certificates were actually renewed
        if echo "$renewal_output" | grep -q "No renewals were attempted"; then
            log_info "No certificates needed renewal"
            return 1  # Signal no reload needed
        fi

        return 0  # Signal reload needed
    else
        log_error "Certificate renewal failed"
        log_error "Output: $renewal_output"
        return 2  # Signal error
    fi
}

# ============================================================================
# Nginx Reload
# ============================================================================

reload_nginx() {
    log_info "Reloading Nginx to apply new certificates..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: docker exec $NGINX_CONTAINER nginx -s reload"
        return 0
    fi

    # Check if Nginx container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
        log_error "Nginx container ($NGINX_CONTAINER) is not running"
        log_error "Cannot reload Nginx - please restart containers manually"
        return 1
    fi

    # Test Nginx configuration first
    log_info "Testing Nginx configuration..."
    if ! docker exec "$NGINX_CONTAINER" nginx -t 2>&1; then
        log_error "Nginx configuration test failed"
        log_error "Not reloading Nginx - please check configuration"
        return 1
    fi

    # Reload Nginx
    if docker exec "$NGINX_CONTAINER" nginx -s reload; then
        log_success "Nginx reloaded successfully"
        return 0
    else
        log_error "Failed to reload Nginx"
        return 1
    fi
}

# ============================================================================
# Cron Job Management
# ============================================================================

setup_cron_job() {
    log_info "Setting up automatic renewal cron job..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would add cron job: $CRON_SCHEDULE $SCRIPT_PATH --quiet"
        return 0
    fi

    # Check if running as root (required for system cron)
    if [ "$EUID" -ne 0 ]; then
        log_warning "Not running as root - will use user crontab"
        log_warning "For system-wide cron, run: sudo $0 --setup-cron"
    fi

    # Create log directory
    mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR" 2>/dev/null || sudo chmod 755 "$LOG_DIR"

    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$CRON_IDENTIFIER"; then
        log_warning "Cron job already exists"
        log_info "Current cron entry:"
        crontab -l 2>/dev/null | grep "$CRON_IDENTIFIER" || true
        return 0
    fi

    # Add cron job
    local cron_entry="$CRON_SCHEDULE $SCRIPT_PATH --quiet # $CRON_IDENTIFIER"

    (crontab -l 2>/dev/null || true; echo "$cron_entry") | crontab -

    log_success "Cron job installed successfully"
    log_info "Schedule: $CRON_SCHEDULE (twice daily at midnight and noon)"
    log_info "Log file: $LOG_FILE"
    log_info ""
    log_info "Verify with: crontab -l | grep $CRON_IDENTIFIER"
}

remove_cron_job() {
    log_info "Removing automatic renewal cron job..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would remove cron job containing: $CRON_IDENTIFIER"
        return 0
    fi

    # Check if cron job exists
    if ! crontab -l 2>/dev/null | grep -q "$CRON_IDENTIFIER"; then
        log_warning "Cron job not found"
        return 0
    fi

    # Remove cron job
    crontab -l 2>/dev/null | grep -v "$CRON_IDENTIFIER" | crontab -

    log_success "Cron job removed successfully"
}

show_cron_status() {
    log_info "Cron job status:"

    if crontab -l 2>/dev/null | grep -q "$CRON_IDENTIFIER"; then
        log_success "Automatic renewal cron job is ACTIVE"
        crontab -l 2>/dev/null | grep "$CRON_IDENTIFIER"
    else
        log_warning "Automatic renewal cron job is NOT INSTALLED"
        log_info "Run: $0 --setup-cron"
    fi
}

# ============================================================================
# Prometheus Metrics Export (Optional)
# ============================================================================

export_metrics() {
    # Export certificate expiration metrics for Prometheus
    # This creates a metrics file that can be scraped by node_exporter textfile collector

    local metrics_dir="/var/lib/prometheus/node-exporter"
    local metrics_file="${metrics_dir}/ssl_cert_expiry.prom"

    if [ ! -d "$metrics_dir" ]; then
        return 0  # Skip if Prometheus textfile collector not configured
    fi

    log_info "Exporting certificate metrics for Prometheus..."

    local current_timestamp
    current_timestamp=$(date +%s)

    # Get certificate expiration for all domains
    local cert_domains
    cert_domains=$(docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        alpine sh -c "ls /etc/letsencrypt/live/ 2>/dev/null | grep -v README" || echo "")

    # Create metrics file
    echo "# HELP ssl_certificate_expiry_seconds Seconds until SSL certificate expires" > "$metrics_file.tmp"
    echo "# TYPE ssl_certificate_expiry_seconds gauge" >> "$metrics_file.tmp"

    for domain_dir in $cert_domains; do
        local expiry_date
        expiry_date=$(docker run --rm \
            -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
            alpine sh -c "openssl x509 -enddate -noout -in /etc/letsencrypt/live/${domain_dir}/fullchain.pem 2>/dev/null | cut -d= -f2" || echo "")

        if [ -n "$expiry_date" ]; then
            local expiry_timestamp
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")

            if [ "$expiry_timestamp" -gt 0 ]; then
                local seconds_until_expiry=$(( expiry_timestamp - current_timestamp ))
                echo "ssl_certificate_expiry_seconds{domain=\"${domain_dir}\"} $seconds_until_expiry" >> "$metrics_file.tmp"
            fi
        fi
    done

    mv "$metrics_file.tmp" "$metrics_file"
    log_success "Metrics exported to $metrics_file"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse command-line arguments
    parse_arguments "$@"

    # Handle cron management separately
    if [ "$SETUP_CRON" = true ]; then
        setup_cron_job
        show_cron_status
        exit 0
    fi

    if [ "$REMOVE_CRON" = true ]; then
        remove_cron_job
        exit 0
    fi

    # Start logging
    [ "$QUIET" = false ] && log_info "========================================"
    [ "$QUIET" = false ] && log_info "BuhBot Certificate Renewal v$SCRIPT_VERSION"
    [ "$QUIET" = false ] && log_info "========================================"

    log_to_file "========================================"
    log_to_file "[$(date +'%Y-%m-%d %H:%M:%S')] Renewal check started"

    # Pre-flight checks
    check_docker
    check_certificates_exist
    check_nginx_running

    # Check certificate expiration
    local needs_renewal=false
    if check_certificate_expiration; then
        needs_renewal=true
    fi

    # If check-only mode, exit here
    if [ "$CHECK_ONLY" = true ]; then
        show_cron_status
        log_info "Check-only mode - skipping renewal"
        exit 0
    fi

    # Attempt renewal if needed or forced
    if [ "$needs_renewal" = true ] || [ "$FORCE_RENEWAL" = true ]; then
        local renewal_result
        renew_certificates && renewal_result=0 || renewal_result=$?

        case $renewal_result in
            0)
                # Certificates were renewed - reload Nginx
                reload_nginx
                ;;
            1)
                # No certificates needed renewal
                log_info "No certificates were renewed"
                ;;
            *)
                # Error occurred
                log_error "Renewal process failed"
                exit 1
                ;;
        esac
    else
        log_success "All certificates are valid and not due for renewal"
    fi

    # Export metrics for Prometheus (if configured)
    export_metrics 2>/dev/null || true

    # Show cron status
    [ "$QUIET" = false ] && show_cron_status

    log_to_file "[$(date +'%Y-%m-%d %H:%M:%S')] Renewal check completed"
    log_to_file "========================================"

    [ "$QUIET" = false ] && log_success "Certificate renewal check complete"
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

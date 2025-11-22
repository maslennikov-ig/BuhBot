#!/usr/bin/env bash

# ============================================================================
# BuhBot Backup Verification Script
# ============================================================================
# Purpose: Verify backup integrity, check file existence, report backup age
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following verification tasks:
# 1. Check backup files exist in expected locations
# 2. Verify archive integrity (test extraction)
# 3. Report latest backup age
# 4. Alert if backups are too old
# 5. Check backup sizes against expected ranges
# 6. Generate verification report
#
# Requirements:
# - Access to backup directories
# - Docker (for volume backup verification)
# - gzip, tar utilities
#
# Usage:
#   ./verify-backup.sh              # Run full verification
#   ./verify-backup.sh --quick      # Quick check (no integrity tests)
#   ./verify-backup.sh --alert      # Only report issues
#   ./verify-backup.sh --json       # Output in JSON format
#
# Exit Codes:
#   0 - All verifications passed
#   1 - Warning (backups old but exist)
#   2 - Error (backups missing or corrupt)
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

readonly VDS_BACKUP_DIR="/var/backups/buhbot"
readonly SUPABASE_BACKUP_DIR="/var/backups/buhbot/supabase"
readonly LOG_FILE="/var/log/buhbot-backup-verify-$(date +%Y%m%d).log"

# Thresholds (in days)
readonly WARNING_THRESHOLD_VDS=8      # Warn if VDS backup > 8 days old
readonly ERROR_THRESHOLD_VDS=15       # Error if VDS backup > 15 days old
readonly WARNING_THRESHOLD_SUPABASE=2 # Warn if Supabase backup > 2 days old
readonly ERROR_THRESHOLD_SUPABASE=3   # Error if Supabase backup > 3 days old

# Minimum expected backup sizes (in KB)
readonly MIN_VDS_BACKUP_SIZE=100      # 100KB minimum for VDS backup
readonly MIN_SUPABASE_BACKUP_SIZE=10  # 10KB minimum for Supabase backup

# Options
QUICK_MODE=false
ALERT_ONLY=false
JSON_OUTPUT=false

# Verification results
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0
ISSUES=()

# Color codes for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# ============================================================================
# Logging Functions
# ============================================================================

setup_logging() {
    local log_dir
    log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir" 2>/dev/null || true

    if [ "$JSON_OUTPUT" = false ]; then
        exec 1> >(tee -a "$LOG_FILE")
        exec 2>&1
    fi
}

log_info() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${COLOR_BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [INFO]${COLOR_RESET} $*"
    fi
}

log_success() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${COLOR_GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] [PASS]${COLOR_RESET} $*"
    fi
}

log_warning() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${COLOR_YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN]${COLOR_RESET} $*"
    fi
}

log_error() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${COLOR_RED}[$(date +'%Y-%m-%d %H:%M:%S')] [FAIL]${COLOR_RESET} $*" >&2
    fi
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --alert)
                ALERT_ONLY=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
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
BuhBot Backup Verification Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --quick       Quick check (skip integrity tests)
  --alert       Only report issues (quiet mode)
  --json        Output results in JSON format
  -h, --help    Show this help message

Verification Checks:
  - VDS backup existence and age
  - Supabase backup existence and age
  - Archive integrity (unless --quick)
  - Backup file sizes
  - Metadata validation

Thresholds:
  - VDS backup:      Warning > ${WARNING_THRESHOLD_VDS} days, Error > ${ERROR_THRESHOLD_VDS} days
  - Supabase backup: Warning > ${WARNING_THRESHOLD_SUPABASE} days, Error > ${ERROR_THRESHOLD_SUPABASE} days

Exit Codes:
  0 - All verifications passed
  1 - Warnings present (backups exist but old)
  2 - Errors present (backups missing or corrupt)

Examples:
  $0                  # Full verification
  $0 --quick          # Quick check
  $0 --json           # JSON output for monitoring
  $0 --alert          # Only show issues

EOF
}

# ============================================================================
# Result Recording
# ============================================================================

record_pass() {
    local check_name="$1"
    local details="${2:-}"

    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))

    if [ "$ALERT_ONLY" = false ]; then
        log_success "$check_name: $details"
    fi
}

record_warning() {
    local check_name="$1"
    local details="${2:-}"

    ((TOTAL_CHECKS++))
    ((WARNING_CHECKS++))
    ISSUES+=("WARNING: $check_name - $details")

    log_warning "$check_name: $details"
}

record_fail() {
    local check_name="$1"
    local details="${2:-}"

    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    ISSUES+=("ERROR: $check_name - $details")

    log_error "$check_name: $details"
}

# ============================================================================
# Helper Functions
# ============================================================================

get_latest_backup_dir() {
    local base_dir="$1"

    if [ ! -d "$base_dir" ]; then
        echo ""
        return
    fi

    find "$base_dir" -maxdepth 1 -type d -not -path "$base_dir" | sort -r | head -1
}

get_backup_age_days() {
    local backup_dir="$1"

    if [ ! -d "$backup_dir" ]; then
        echo "-1"
        return
    fi

    local backup_timestamp
    backup_timestamp=$(stat -c %Y "$backup_dir" 2>/dev/null || echo "0")
    local current_timestamp
    current_timestamp=$(date +%s)

    local age_seconds=$((current_timestamp - backup_timestamp))
    local age_days=$((age_seconds / 86400))

    echo "$age_days"
}

get_backup_size_kb() {
    local path="$1"

    if [ -f "$path" ]; then
        du -k "$path" 2>/dev/null | cut -f1 || echo "0"
    elif [ -d "$path" ]; then
        du -sk "$path" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# ============================================================================
# VDS Backup Verification
# ============================================================================

verify_vds_backup_exists() {
    log_info "Checking VDS backup existence..."

    if [ ! -d "$VDS_BACKUP_DIR" ]; then
        record_fail "VDS Backup Directory" "Directory does not exist: $VDS_BACKUP_DIR"
        return 1
    fi

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$VDS_BACKUP_DIR")

    if [ -z "$latest_backup" ] || [ ! -d "$latest_backup" ]; then
        record_fail "VDS Backup" "No backups found in $VDS_BACKUP_DIR"
        return 1
    fi

    local backup_name
    backup_name=$(basename "$latest_backup")
    record_pass "VDS Backup Exists" "Latest: $backup_name"

    return 0
}

verify_vds_backup_age() {
    log_info "Checking VDS backup age..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$VDS_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 1
    fi

    local age_days
    age_days=$(get_backup_age_days "$latest_backup")

    if [ "$age_days" -lt 0 ]; then
        record_fail "VDS Backup Age" "Unable to determine backup age"
        return 1
    fi

    if [ "$age_days" -gt "$ERROR_THRESHOLD_VDS" ]; then
        record_fail "VDS Backup Age" "Backup is $age_days days old (threshold: $ERROR_THRESHOLD_VDS)"
        return 1
    elif [ "$age_days" -gt "$WARNING_THRESHOLD_VDS" ]; then
        record_warning "VDS Backup Age" "Backup is $age_days days old (threshold: $WARNING_THRESHOLD_VDS)"
        return 0
    else
        record_pass "VDS Backup Age" "$age_days days old"
        return 0
    fi
}

verify_vds_backup_size() {
    log_info "Checking VDS backup size..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$VDS_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 1
    fi

    local backup_size_kb
    backup_size_kb=$(get_backup_size_kb "$latest_backup")

    if [ "$backup_size_kb" -lt "$MIN_VDS_BACKUP_SIZE" ]; then
        record_warning "VDS Backup Size" "Backup is ${backup_size_kb}KB (minimum: ${MIN_VDS_BACKUP_SIZE}KB)"
        return 0
    fi

    local backup_size_human
    backup_size_human=$(du -sh "$latest_backup" 2>/dev/null | cut -f1 || echo "${backup_size_kb}KB")
    record_pass "VDS Backup Size" "$backup_size_human"

    return 0
}

verify_vds_backup_integrity() {
    if [ "$QUICK_MODE" = true ]; then
        log_info "Skipping VDS backup integrity check (quick mode)"
        return 0
    fi

    log_info "Verifying VDS backup integrity..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$VDS_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 1
    fi

    local volumes_dir="$latest_backup/volumes"
    local errors=0

    if [ -d "$volumes_dir" ]; then
        for archive in "$volumes_dir"/*.tar.gz; do
            if [ -f "$archive" ]; then
                local archive_name
                archive_name=$(basename "$archive")

                if ! gzip -t "$archive" &>/dev/null; then
                    record_fail "VDS Volume Integrity" "Corrupt archive: $archive_name"
                    ((errors++))
                else
                    if [ "$ALERT_ONLY" = false ]; then
                        log_info "Volume archive OK: $archive_name"
                    fi
                fi
            fi
        done
    fi

    # Check configs archive
    local configs_archive="$latest_backup/configs.tar.gz"
    if [ -f "$configs_archive" ]; then
        if ! gzip -t "$configs_archive" &>/dev/null; then
            record_fail "VDS Config Integrity" "Corrupt archive: configs.tar.gz"
            ((errors++))
        else
            if [ "$ALERT_ONLY" = false ]; then
                log_info "Config archive OK: configs.tar.gz"
            fi
        fi
    fi

    if [ $errors -eq 0 ]; then
        record_pass "VDS Backup Integrity" "All archives valid"
        return 0
    else
        return 1
    fi
}

verify_vds_backup_metadata() {
    log_info "Checking VDS backup metadata..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$VDS_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 1
    fi

    local metadata_file="$latest_backup/backup-metadata.json"

    if [ ! -f "$metadata_file" ]; then
        record_warning "VDS Backup Metadata" "No metadata file found"
        return 0
    fi

    # Validate JSON
    if command -v jq &>/dev/null; then
        if ! jq empty "$metadata_file" &>/dev/null; then
            record_warning "VDS Backup Metadata" "Invalid JSON in metadata file"
            return 0
        fi

        local backup_timestamp
        backup_timestamp=$(jq -r '.timestamp // "unknown"' "$metadata_file")
        record_pass "VDS Backup Metadata" "Created: $backup_timestamp"
    else
        record_pass "VDS Backup Metadata" "Metadata file exists (jq not available for validation)"
    fi

    return 0
}

# ============================================================================
# Supabase Backup Verification
# ============================================================================

verify_supabase_backup_exists() {
    log_info "Checking Supabase backup existence..."

    if [ ! -d "$SUPABASE_BACKUP_DIR" ]; then
        record_warning "Supabase Backup Directory" "Directory does not exist: $SUPABASE_BACKUP_DIR"
        return 0
    fi

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")

    if [ -z "$latest_backup" ] || [ ! -d "$latest_backup" ]; then
        record_warning "Supabase Backup" "No backups found in $SUPABASE_BACKUP_DIR"
        return 0
    fi

    local backup_name
    backup_name=$(basename "$latest_backup")
    record_pass "Supabase Backup Exists" "Latest: $backup_name"

    return 0
}

verify_supabase_backup_age() {
    log_info "Checking Supabase backup age..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 0
    fi

    local age_days
    age_days=$(get_backup_age_days "$latest_backup")

    if [ "$age_days" -lt 0 ]; then
        record_warning "Supabase Backup Age" "Unable to determine backup age"
        return 0
    fi

    if [ "$age_days" -gt "$ERROR_THRESHOLD_SUPABASE" ]; then
        record_fail "Supabase Backup Age" "Backup is $age_days days old (threshold: $ERROR_THRESHOLD_SUPABASE)"
        return 1
    elif [ "$age_days" -gt "$WARNING_THRESHOLD_SUPABASE" ]; then
        record_warning "Supabase Backup Age" "Backup is $age_days days old (threshold: $WARNING_THRESHOLD_SUPABASE)"
        return 0
    else
        record_pass "Supabase Backup Age" "$age_days days old"
        return 0
    fi
}

verify_supabase_backup_size() {
    log_info "Checking Supabase backup size..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 0
    fi

    local backup_size_kb
    backup_size_kb=$(get_backup_size_kb "$latest_backup")

    if [ "$backup_size_kb" -lt "$MIN_SUPABASE_BACKUP_SIZE" ]; then
        record_warning "Supabase Backup Size" "Backup is ${backup_size_kb}KB (minimum: ${MIN_SUPABASE_BACKUP_SIZE}KB)"
        return 0
    fi

    local backup_size_human
    backup_size_human=$(du -sh "$latest_backup" 2>/dev/null | cut -f1 || echo "${backup_size_kb}KB")
    record_pass "Supabase Backup Size" "$backup_size_human"

    return 0
}

verify_supabase_backup_integrity() {
    if [ "$QUICK_MODE" = true ]; then
        log_info "Skipping Supabase backup integrity check (quick mode)"
        return 0
    fi

    log_info "Verifying Supabase backup integrity..."

    local latest_backup
    latest_backup=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")

    if [ -z "$latest_backup" ]; then
        return 0
    fi

    local errors=0

    # Check .dump files
    for dump_file in "$latest_backup"/*.dump; do
        if [ -f "$dump_file" ]; then
            local file_name
            file_name=$(basename "$dump_file")
            local file_size
            file_size=$(stat -c %s "$dump_file" 2>/dev/null || echo "0")

            if [ "$file_size" -eq 0 ]; then
                record_fail "Supabase Dump Integrity" "Empty dump file: $file_name"
                ((errors++))
            else
                if [ "$ALERT_ONLY" = false ]; then
                    log_info "Dump file OK: $file_name ($(du -sh "$dump_file" | cut -f1))"
                fi
            fi
        fi
    done

    # Check .sql.gz files
    for sql_gz in "$latest_backup"/*.sql.gz; do
        if [ -f "$sql_gz" ]; then
            local file_name
            file_name=$(basename "$sql_gz")

            if ! gzip -t "$sql_gz" &>/dev/null; then
                record_fail "Supabase SQL Integrity" "Corrupt archive: $file_name"
                ((errors++))
            else
                if [ "$ALERT_ONLY" = false ]; then
                    log_info "SQL archive OK: $file_name"
                fi
            fi
        fi
    done

    if [ $errors -eq 0 ]; then
        record_pass "Supabase Backup Integrity" "All backup files valid"
        return 0
    else
        return 1
    fi
}

# ============================================================================
# Summary and Output
# ============================================================================

generate_json_output() {
    local status="ok"
    local exit_code=0

    if [ "$FAILED_CHECKS" -gt 0 ]; then
        status="error"
        exit_code=2
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        status="warning"
        exit_code=1
    fi

    local vds_latest
    vds_latest=$(get_latest_backup_dir "$VDS_BACKUP_DIR")
    local vds_age
    vds_age=$(get_backup_age_days "$vds_latest")

    local supabase_latest
    supabase_latest=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")
    local supabase_age
    supabase_age=$(get_backup_age_days "$supabase_latest")

    # Build issues array
    local issues_json=""
    for issue in "${ISSUES[@]}"; do
        if [ -n "$issues_json" ]; then
            issues_json+=","
        fi
        issues_json+="\"$issue\""
    done

    cat << EOF
{
    "timestamp": "$(date -Iseconds)",
    "status": "$status",
    "summary": {
        "total_checks": $TOTAL_CHECKS,
        "passed": $PASSED_CHECKS,
        "warnings": $WARNING_CHECKS,
        "failures": $FAILED_CHECKS
    },
    "vds_backup": {
        "latest": "$(basename "$vds_latest" 2>/dev/null || echo "none")",
        "age_days": $vds_age,
        "path": "$vds_latest"
    },
    "supabase_backup": {
        "latest": "$(basename "$supabase_latest" 2>/dev/null || echo "none")",
        "age_days": $supabase_age,
        "path": "$supabase_latest"
    },
    "issues": [$issues_json]
}
EOF

    return $exit_code
}

show_summary() {
    if [ "$JSON_OUTPUT" = true ]; then
        generate_json_output
        return $?
    fi

    log_info ""
    log_info "========================================"
    log_info "Backup Verification Summary"
    log_info "========================================"
    log_info ""
    log_info "Checks: $TOTAL_CHECKS total"
    log_success "Passed: $PASSED_CHECKS"

    if [ "$WARNING_CHECKS" -gt 0 ]; then
        log_warning "Warnings: $WARNING_CHECKS"
    fi

    if [ "$FAILED_CHECKS" -gt 0 ]; then
        log_error "Failed: $FAILED_CHECKS"
    fi

    log_info ""

    # Show latest backups
    local vds_latest
    vds_latest=$(get_latest_backup_dir "$VDS_BACKUP_DIR")
    local vds_age
    vds_age=$(get_backup_age_days "$vds_latest")

    local supabase_latest
    supabase_latest=$(get_latest_backup_dir "$SUPABASE_BACKUP_DIR")
    local supabase_age
    supabase_age=$(get_backup_age_days "$supabase_latest")

    log_info "Latest Backups:"
    log_info "  VDS:      $(basename "$vds_latest" 2>/dev/null || echo "none") (${vds_age} days ago)"
    log_info "  Supabase: $(basename "$supabase_latest" 2>/dev/null || echo "none") (${supabase_age} days ago)"

    if [ ${#ISSUES[@]} -gt 0 ]; then
        log_info ""
        log_info "Issues:"
        for issue in "${ISSUES[@]}"; do
            log_info "  - $issue"
        done
    fi

    log_info ""
    log_info "========================================"

    # Determine exit code
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        log_error "Verification FAILED"
        return 2
    elif [ "$WARNING_CHECKS" -gt 0 ]; then
        log_warning "Verification completed with WARNINGS"
        return 1
    else
        log_success "Verification PASSED"
        return 0
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments first (before logging setup for JSON mode)
    parse_arguments "$@"

    setup_logging

    if [ "$JSON_OUTPUT" = false ]; then
        log_info "========================================"
        log_info "BuhBot Backup Verification Script v$SCRIPT_VERSION"
        log_info "========================================"
        log_info ""
    fi

    # VDS Backup Verification
    verify_vds_backup_exists && {
        verify_vds_backup_age
        verify_vds_backup_size
        verify_vds_backup_integrity
        verify_vds_backup_metadata
    }

    if [ "$JSON_OUTPUT" = false ]; then
        log_info ""
    fi

    # Supabase Backup Verification
    verify_supabase_backup_exists && {
        verify_supabase_backup_age
        verify_supabase_backup_size
        verify_supabase_backup_integrity
    }

    # Show summary and return appropriate exit code
    show_summary
    exit $?
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

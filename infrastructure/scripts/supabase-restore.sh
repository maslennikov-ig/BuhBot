#!/usr/bin/env bash

# ============================================================================
# BuhBot Supabase Restore Script
# ============================================================================
# Purpose: Restore Supabase database from pg_dump backups
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Validate backup file integrity
# 2. Safety checks before restore
# 3. Restore database from dump file
# 4. Verify restore success
#
# Requirements:
# - PostgreSQL client (pg_restore, psql) installed
# - Supabase connection credentials
# - Valid backup file (.dump or .sql.gz)
#
# Usage:
#   ./supabase-restore.sh BACKUP_FILE           # Restore from file
#   ./supabase-restore.sh --latest              # Restore latest backup
#   ./supabase-restore.sh --list                # List available backups
#   ./supabase-restore.sh --dry-run BACKUP_FILE # Dry run
#
# CAUTION: This will OVERWRITE data in the target database!
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

readonly BACKUP_BASE_DIR="/var/backups/buhbot/supabase"
readonly LOG_FILE="/var/log/buhbot-supabase-restore-$(date +%Y%m%d-%H%M%S).log"
readonly LOCK_FILE="/tmp/buhbot-supabase-restore.lock"

# Restore options
DRY_RUN=false
SKIP_CONFIRMATION=false
CLEAN_RESTORE=false

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

    exec 1> >(tee -a "$LOG_FILE")
    exec 2>&1
}

log_info() {
    echo -e "${COLOR_BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [INFO]${COLOR_RESET} $*"
}

log_success() {
    echo -e "${COLOR_GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS]${COLOR_RESET} $*"
}

log_warning() {
    echo -e "${COLOR_YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING]${COLOR_RESET} $*"
}

log_error() {
    echo -e "${COLOR_RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR]${COLOR_RESET} $*" >&2
}

log_dry_run() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${COLOR_YELLOW}[DRY RUN]${COLOR_RESET} $*"
    fi
}

# ============================================================================
# Error Handling
# ============================================================================

cleanup() {
    local exit_code=$?

    # Remove lock file
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
    fi

    # Unset password from environment
    unset PGPASSWORD 2>/dev/null || true

    if [ $exit_code -ne 0 ]; then
        log_error "Supabase restore failed with exit code $exit_code"
        log_error "Check log file: $LOG_FILE"
        log_warning "Database may be in an inconsistent state!"
    fi
}

trap cleanup EXIT

# ============================================================================
# Lock Management
# ============================================================================

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE")

        if ps -p "$lock_pid" > /dev/null 2>&1; then
            log_error "Another restore operation is in progress (PID: $lock_pid)"
            exit 1
        else
            log_warning "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi

    echo $$ > "$LOCK_FILE"
}

# ============================================================================
# Argument Parsing
# ============================================================================

BACKUP_FILE=""

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE ENABLED - No changes will be made"
                shift
                ;;
            --latest)
                BACKUP_FILE="latest"
                shift
                ;;
            --list)
                list_backups
                exit 0
                ;;
            --clean)
                CLEAN_RESTORE=true
                shift
                ;;
            --force)
                SKIP_CONFIRMATION=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                BACKUP_FILE="$1"
                shift
                ;;
        esac
    done

    if [ -z "$BACKUP_FILE" ]; then
        log_error "No backup file specified"
        log_info "Use --list to see available backups"
        show_help
        exit 1
    fi
}

show_help() {
    cat << EOF
BuhBot Supabase Restore Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS] BACKUP_FILE

Arguments:
  BACKUP_FILE        Path to backup file (.dump or .sql.gz) or backup timestamp

Options:
  --latest           Restore from the most recent backup
  --list             List available backups and exit
  --dry-run          Perform a dry run without making changes
  --clean            Drop existing objects before restore
  --force            Skip confirmation prompts
  -h, --help         Show this help message

Environment Variables (required):
  SUPABASE_DB_HOST      Database host
  SUPABASE_DB_PORT      Database port (default: 5432)
  SUPABASE_DB_NAME      Database name (default: postgres)
  SUPABASE_DB_USER      Database user (default: postgres)
  SUPABASE_DB_PASSWORD  Database password

Examples:
  $0 /var/backups/buhbot/supabase/20251122_030000/supabase-full-20251122_030000.dump
  $0 --latest                         # Restore latest backup
  $0 --dry-run --latest               # Test restore process
  $0 --clean 20251122_030000          # Clean restore from timestamp

CAUTION: This will OVERWRITE data in the target database!

EOF
}

list_backups() {
    log_info "Available Supabase backups in $BACKUP_BASE_DIR:"
    echo ""

    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        log_warning "Backup directory does not exist: $BACKUP_BASE_DIR"
        return 0
    fi

    local count=0
    while IFS= read -r backup_dir; do
        if [ -n "$backup_dir" ] && [ -d "$backup_dir" ]; then
            local timestamp
            timestamp=$(basename "$backup_dir")
            local size
            size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1 || echo "?")
            local date_formatted
            date_formatted=$(echo "$timestamp" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')

            # Show backup files
            echo "  $timestamp ($date_formatted)"
            for f in "$backup_dir"/*.dump "$backup_dir"/*.sql.gz; do
                if [ -f "$f" ]; then
                    local file_size
                    file_size=$(du -sh "$f" | cut -f1)
                    echo "    - $(basename "$f") ($file_size)"
                fi
            done
            echo ""
            ((count++))
        fi
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -not -path "$BACKUP_BASE_DIR" | sort -r)

    echo ""
    log_info "Total backup sets: $count"
}

# ============================================================================
# Environment Setup
# ============================================================================

load_environment() {
    local env_files=(
        "${PROJECT_ROOT}/backend/.env"
        "${PROJECT_ROOT}/.env"
        "${PROJECT_ROOT}/infrastructure/.env"
    )

    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            log_info "Loading environment from: $env_file"
            set -a
            # shellcheck disable=SC1090
            source "$env_file"
            set +a
            break
        fi
    done
}

validate_environment() {
    log_info "Validating Supabase connection settings..."

    SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
    SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
    SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"

    local missing_vars=()

    if [ -z "${SUPABASE_DB_HOST:-}" ]; then
        missing_vars+=("SUPABASE_DB_HOST")
    fi

    if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
        missing_vars+=("SUPABASE_DB_PASSWORD")
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        exit 1
    fi

    log_success "Environment validated"
    log_info "Host: $SUPABASE_DB_HOST"
    log_info "Database: $SUPABASE_DB_NAME"
}

# ============================================================================
# Backup Resolution
# ============================================================================

resolve_backup_file() {
    if [ "$BACKUP_FILE" = "latest" ]; then
        # Find latest backup directory
        local latest_dir
        latest_dir=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -not -path "$BACKUP_BASE_DIR" | sort -r | head -1)

        if [ -z "$latest_dir" ]; then
            log_error "No backups found in $BACKUP_BASE_DIR"
            exit 1
        fi

        # Find full dump file in latest backup
        BACKUP_FILE=$(find "$latest_dir" -name "*.dump" | head -1)

        if [ -z "$BACKUP_FILE" ]; then
            log_error "No .dump file found in latest backup: $latest_dir"
            exit 1
        fi

        log_info "Using latest backup: $BACKUP_FILE"
        return 0
    fi

    # Check if it's a timestamp (directory name)
    if [[ "$BACKUP_FILE" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
        local backup_dir="${BACKUP_BASE_DIR}/${BACKUP_FILE}"

        if [ ! -d "$backup_dir" ]; then
            log_error "Backup directory not found: $backup_dir"
            exit 1
        fi

        BACKUP_FILE=$(find "$backup_dir" -name "*.dump" | head -1)

        if [ -z "$BACKUP_FILE" ]; then
            log_error "No .dump file found in backup: $backup_dir"
            exit 1
        fi

        log_info "Using backup: $BACKUP_FILE"
        return 0
    fi

    # Check if it's a direct file path
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_pg_tools() {
    local tools=("pg_restore" "psql")

    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed"
            log_info "Install PostgreSQL client: sudo apt install postgresql-client"
            exit 1
        fi
    done

    log_success "PostgreSQL tools available"
}

validate_backup_file() {
    log_info "Validating backup file..."

    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    local file_size
    file_size=$(du -sh "$BACKUP_FILE" | cut -f1)
    log_info "Backup file: $BACKUP_FILE"
    log_info "File size: $file_size"

    # Check file type
    local file_type
    file_type=$(file "$BACKUP_FILE")

    if [[ "$BACKUP_FILE" == *.dump ]]; then
        if [[ ! "$file_type" == *"PostgreSQL"* ]] && [[ ! "$file_type" == *"data"* ]]; then
            log_warning "File may not be a valid PostgreSQL custom dump"
            log_info "File type: $file_type"
        else
            log_success "Backup file validated (custom format)"
        fi
    elif [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        if [[ ! "$file_type" == *"gzip"* ]]; then
            log_error "File is not a valid gzip archive"
            exit 1
        fi
        log_success "Backup file validated (compressed SQL)"
    elif [[ "$BACKUP_FILE" == *.sql ]]; then
        log_success "Backup file validated (SQL)"
    else
        log_warning "Unknown backup file format: $BACKUP_FILE"
    fi
}

test_database_connection() {
    log_info "Testing database connection..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would test connection to $SUPABASE_DB_HOST"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    if ! psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -c "SELECT 1" &>/dev/null; then
        log_error "Failed to connect to database"
        exit 1
    fi

    log_success "Database connection successful"
}

# ============================================================================
# Safety Checks
# ============================================================================

get_database_stats() {
    log_info "Getting current database statistics..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would get database statistics"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    # Get database size
    local db_size
    db_size=$(psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$SUPABASE_DB_NAME'));" 2>/dev/null | tr -d ' ' || echo "unknown")

    # Get table count in public schema
    local table_count
    table_count=$(psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    log_info "Current database size: $db_size"
    log_info "Current public tables: $table_count"
}

confirm_restore() {
    if [ "$SKIP_CONFIRMATION" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log_warning ""
    log_warning "========================================"
    log_warning "WARNING: DATABASE RESTORE OPERATION"
    log_warning "========================================"
    log_warning ""
    log_warning "This will restore the database from:"
    log_warning "  $BACKUP_FILE"
    log_warning ""
    log_warning "Target database:"
    log_warning "  Host: $SUPABASE_DB_HOST"
    log_warning "  Database: $SUPABASE_DB_NAME"
    log_warning ""

    if [ "$CLEAN_RESTORE" = true ]; then
        log_warning "CLEAN MODE: Existing objects will be DROPPED!"
    fi

    log_warning ""
    read -p "Type 'RESTORE' to confirm: " -r

    if [[ ! "$REPLY" = "RESTORE" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi

    log_success "Restore confirmed"
}

# ============================================================================
# Restore Operations
# ============================================================================

restore_from_dump() {
    log_info "Restoring database from custom dump..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would restore from: $BACKUP_FILE"
        log_dry_run "pg_restore options: --no-owner --no-privileges"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    local restore_args=(
        -h "$SUPABASE_DB_HOST"
        -p "$SUPABASE_DB_PORT"
        -U "$SUPABASE_DB_USER"
        -d "$SUPABASE_DB_NAME"
        --no-owner
        --no-privileges
        --verbose
    )

    if [ "$CLEAN_RESTORE" = true ]; then
        restore_args+=(--clean --if-exists)
    fi

    log_info "Running pg_restore..."

    if pg_restore "${restore_args[@]}" "$BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database restored successfully"
    else
        local exit_code=$?
        # pg_restore often returns non-zero even on "success" with warnings
        if [ $exit_code -eq 1 ]; then
            log_warning "pg_restore completed with warnings (exit code 1)"
            log_info "This is often normal due to pre-existing objects"
        else
            log_error "pg_restore failed with exit code $exit_code"
            return 1
        fi
    fi
}

restore_from_sql() {
    local sql_file="$BACKUP_FILE"

    # Check if file is gzipped
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        log_info "Decompressing SQL file..."

        if [ "$DRY_RUN" = true ]; then
            log_dry_run "Would decompress: $BACKUP_FILE"
        else
            local temp_sql
            temp_sql=$(mktemp)
            gunzip -c "$BACKUP_FILE" > "$temp_sql"
            sql_file="$temp_sql"
        fi
    fi

    log_info "Restoring database from SQL file..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would restore from: $sql_file"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    if psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -f "$sql_file" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database restored successfully"
    else
        log_error "SQL restore failed"
        return 1
    fi

    # Cleanup temp file if used
    if [[ "$sql_file" != "$BACKUP_FILE" ]]; then
        rm -f "$sql_file"
    fi
}

restore_database() {
    if [[ "$BACKUP_FILE" == *.dump ]]; then
        restore_from_dump
    elif [[ "$BACKUP_FILE" == *.sql ]] || [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        restore_from_sql
    else
        log_error "Unknown backup file format: $BACKUP_FILE"
        log_info "Supported formats: .dump, .sql, .sql.gz"
        exit 1
    fi
}

# ============================================================================
# Verification
# ============================================================================

verify_restore() {
    log_info "Verifying restore..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would verify restore"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    # Test connection
    if ! psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -c "SELECT 1" &>/dev/null; then
        log_error "Database connection test failed after restore"
        return 1
    fi

    # Get post-restore stats
    local db_size
    db_size=$(psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -t -c "SELECT pg_size_pretty(pg_database_size('$SUPABASE_DB_NAME'));" 2>/dev/null | tr -d ' ' || echo "unknown")

    local table_count
    table_count=$(psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    log_success "Restore verification passed"
    log_info "Post-restore database size: $db_size"
    log_info "Post-restore public tables: $table_count"
}

# ============================================================================
# Summary
# ============================================================================

show_restore_summary() {
    log_info ""
    log_info "========================================"
    log_info "Supabase Restore Summary"
    log_info "========================================"

    if [ "$DRY_RUN" = true ]; then
        log_warning "This was a DRY RUN - no changes were made"
        return 0
    fi

    log_info "Backup restored: $BACKUP_FILE"
    log_info "Target database: $SUPABASE_DB_NAME"
    log_info "Clean restore: $CLEAN_RESTORE"
    log_info ""
    log_info "Log file: $LOG_FILE"
    log_info "========================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    setup_logging

    log_info "========================================"
    log_info "BuhBot Supabase Restore Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info "Log file: $LOG_FILE"
    log_info ""

    # Parse arguments
    parse_arguments "$@"

    # Acquire lock
    if [ "$DRY_RUN" = false ]; then
        acquire_lock
    fi

    # Load and validate environment
    load_environment
    validate_environment

    # Pre-flight checks
    check_pg_tools
    resolve_backup_file
    validate_backup_file
    test_database_connection

    # Safety checks
    get_database_stats
    confirm_restore

    # Perform restore
    restore_database

    # Verify
    verify_restore

    # Show summary
    show_restore_summary

    log_info ""
    log_success "========================================"
    log_success "Supabase restore completed successfully!"
    log_success "========================================"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

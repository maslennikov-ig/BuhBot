#!/usr/bin/env bash

# ============================================================================
# BuhBot Supabase Backup Script
# ============================================================================
# Purpose: Create database backups via pg_dump from Supabase
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Connect to Supabase PostgreSQL database
# 2. Create full database dump using pg_dump
# 3. Create schema-only dump for reference
# 4. Compress and store backups
# 5. Apply retention policy
#
# Requirements:
# - PostgreSQL client (pg_dump) installed
# - Supabase connection credentials in environment or .env file
# - Sufficient disk space
#
# Environment Variables (required):
#   SUPABASE_DB_HOST     - Database host (db.xxx.supabase.co)
#   SUPABASE_DB_PORT     - Database port (default: 5432)
#   SUPABASE_DB_NAME     - Database name (default: postgres)
#   SUPABASE_DB_USER     - Database user (default: postgres)
#   SUPABASE_DB_PASSWORD - Database password
#
# Usage:
#   ./supabase-backup.sh              # Full backup
#   ./supabase-backup.sh --dry-run    # Dry run
#   ./supabase-backup.sh --schema-only # Schema only
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
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
readonly LOG_FILE="/var/log/buhbot-supabase-backup-$(date +%Y%m%d).log"
readonly LOCK_FILE="/tmp/buhbot-supabase-backup.lock"

# Default settings
RETENTION_DAYS=28
DRY_RUN=false
SCHEMA_ONLY=false
INCLUDE_DATA=true

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
        log_error "Supabase backup failed with exit code $exit_code"
        log_error "Check log file: $LOG_FILE"

        # Cleanup incomplete backup
        if [ "$DRY_RUN" = false ] && [ -d "$BACKUP_DIR" ]; then
            log_warning "Cleaning up incomplete backup directory..."
            rm -rf "$BACKUP_DIR"
        fi
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
            log_error "Another Supabase backup is in progress (PID: $lock_pid)"
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

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE ENABLED - No changes will be made"
                shift
                ;;
            --schema-only)
                SCHEMA_ONLY=true
                INCLUDE_DATA=false
                shift
                ;;
            --retention)
                RETENTION_DAYS="$2"
                shift 2
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
BuhBot Supabase Backup Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --dry-run          Perform a dry run without making changes
  --schema-only      Backup schema only (no data)
  --retention DAYS   Override retention days (default: 28)
  -h, --help         Show this help message

Environment Variables (required):
  SUPABASE_DB_HOST      Database host (db.xxx.supabase.co)
  SUPABASE_DB_PORT      Database port (default: 5432)
  SUPABASE_DB_NAME      Database name (default: postgres)
  SUPABASE_DB_USER      Database user (default: postgres)
  SUPABASE_DB_PASSWORD  Database password

Examples:
  $0                      # Full database backup
  $0 --dry-run            # Test backup without changes
  $0 --schema-only        # Backup schema only
  $0 --retention 14       # Use 2-week retention

Backup includes:
  - Full database dump (custom format)
  - Schema-only dump (SQL format)
  - Backup metadata

EOF
}

# ============================================================================
# Environment Setup
# ============================================================================

load_environment() {
    # Try to load from .env files
    local env_files=(
        "${PROJECT_ROOT}/backend/.env"
        "${PROJECT_ROOT}/.env"
        "${PROJECT_ROOT}/infrastructure/.env"
    )

    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            log_info "Loading environment from: $env_file"
            # shellcheck disable=SC1090
            set -a
            source "$env_file"
            set +a
            break
        fi
    done
}

validate_environment() {
    log_info "Validating Supabase connection settings..."

    # Set defaults
    SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
    SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
    SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"

    # Check required variables
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
        log_info ""
        log_info "Set these variables in your environment or .env file"
        exit 1
    fi

    log_success "Environment variables validated"
    log_info "Host: $SUPABASE_DB_HOST"
    log_info "Port: $SUPABASE_DB_PORT"
    log_info "Database: $SUPABASE_DB_NAME"
    log_info "User: $SUPABASE_DB_USER"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_pg_dump() {
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump is not installed"
        log_info "Install PostgreSQL client: sudo apt install postgresql-client"
        exit 1
    fi

    local pg_version
    pg_version=$(pg_dump --version | head -1)
    log_success "pg_dump available: $pg_version"
}

check_disk_space() {
    mkdir -p "$BACKUP_BASE_DIR" 2>/dev/null || true

    local backup_mount
    backup_mount=$(df "$BACKUP_BASE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")

    # Require at least 1GB free space
    local min_space_kb=1048576

    if [ "$backup_mount" -lt "$min_space_kb" ]; then
        log_error "Insufficient disk space. Available: $((backup_mount / 1024))MB, Required: 1024MB"
        exit 1
    fi

    log_success "Disk space check passed: $((backup_mount / 1024))MB available"
}

test_database_connection() {
    log_info "Testing database connection..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would test connection to $SUPABASE_DB_HOST:$SUPABASE_DB_PORT"
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
        log_error "Check your connection settings and credentials"
        exit 1
    fi

    log_success "Database connection successful"
}

create_backup_directory() {
    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create backup directory: $BACKUP_DIR"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"
    log_success "Backup directory created: $BACKUP_DIR"
}

# ============================================================================
# Backup Operations
# ============================================================================

backup_full_database() {
    if [ "$SCHEMA_ONLY" = true ]; then
        log_info "Skipping full backup (--schema-only mode)"
        return 0
    fi

    log_info "Creating full database backup..."

    local backup_file="$BACKUP_DIR/supabase-full-${TIMESTAMP}.dump"

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create full backup: $backup_file"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    # Use custom format for efficient storage and selective restore
    pg_dump \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        --format=custom \
        --compress=9 \
        --no-owner \
        --no-privileges \
        --exclude-schema='extensions' \
        --exclude-schema='graphql' \
        --exclude-schema='graphql_public' \
        --exclude-schema='pgbouncer' \
        --exclude-schema='realtime' \
        --exclude-schema='supabase_functions' \
        --exclude-schema='supabase_migrations' \
        --exclude-schema='vault' \
        --file="$backup_file"

    local file_size
    file_size=$(du -sh "$backup_file" | cut -f1)
    log_success "Full backup created: $backup_file ($file_size)"
}

backup_schema_only() {
    log_info "Creating schema-only backup..."

    local schema_file="$BACKUP_DIR/supabase-schema-${TIMESTAMP}.sql"

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create schema backup: $schema_file"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    pg_dump \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        --schema-only \
        --no-owner \
        --no-privileges \
        --exclude-schema='extensions' \
        --exclude-schema='graphql' \
        --exclude-schema='graphql_public' \
        --exclude-schema='pgbouncer' \
        --exclude-schema='realtime' \
        --exclude-schema='supabase_functions' \
        --exclude-schema='supabase_migrations' \
        --exclude-schema='vault' \
        --file="$schema_file"

    # Compress schema file
    gzip "$schema_file"

    local file_size
    file_size=$(du -sh "${schema_file}.gz" | cut -f1)
    log_success "Schema backup created: ${schema_file}.gz ($file_size)"
}

backup_specific_tables() {
    log_info "Creating backup of key application tables..."

    local tables_file="$BACKUP_DIR/supabase-tables-${TIMESTAMP}.sql"

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create tables backup: $tables_file"
        return 0
    fi

    export PGPASSWORD="$SUPABASE_DB_PASSWORD"

    # Backup public schema tables (application data)
    pg_dump \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        --schema='public' \
        --data-only \
        --no-owner \
        --no-privileges \
        --file="$tables_file" 2>/dev/null || {
            log_warning "No public schema tables found or backup failed"
            return 0
        }

    # Compress if file exists and has content
    if [ -s "$tables_file" ]; then
        gzip "$tables_file"
        local file_size
        file_size=$(du -sh "${tables_file}.gz" | cut -f1)
        log_success "Tables backup created: ${tables_file}.gz ($file_size)"
    else
        rm -f "$tables_file"
        log_warning "No table data to backup"
    fi
}

save_backup_metadata() {
    log_info "Saving backup metadata..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would save backup metadata"
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

    # Get table count
    local table_count
    table_count=$(psql \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    cat > "$BACKUP_DIR/backup-metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "backup_version": "$SCRIPT_VERSION",
    "backup_type": "$([ "$SCHEMA_ONLY" = true ] && echo "schema_only" || echo "full")",
    "retention_days": $RETENTION_DAYS,
    "database": {
        "host": "$SUPABASE_DB_HOST",
        "name": "$SUPABASE_DB_NAME",
        "size": "$db_size",
        "public_tables": $table_count
    },
    "project_root": "$PROJECT_ROOT"
}
EOF

    log_success "Backup metadata saved"
    log_info "Database size: $db_size"
    log_info "Public tables: $table_count"
}

# ============================================================================
# Retention Policy
# ============================================================================

apply_retention_policy() {
    log_info "Applying ${RETENTION_DAYS}-day retention policy..."

    if [ "$DRY_RUN" = true ]; then
        local old_backups
        old_backups=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -path "$BACKUP_BASE_DIR" 2>/dev/null | wc -l)
        log_dry_run "Would delete $old_backups old backup(s)"
        return 0
    fi

    local deleted=0

    while IFS= read -r old_backup; do
        if [ -n "$old_backup" ] && [ -d "$old_backup" ]; then
            log_info "Deleting old backup: $old_backup"
            rm -rf "$old_backup"
            ((deleted++))
        fi
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -path "$BACKUP_BASE_DIR" 2>/dev/null)

    log_success "Retention policy applied: $deleted old backup(s) deleted"
}

# ============================================================================
# Summary
# ============================================================================

show_backup_summary() {
    log_info ""
    log_info "========================================"
    log_info "Supabase Backup Summary"
    log_info "========================================"

    if [ "$DRY_RUN" = true ]; then
        log_warning "This was a DRY RUN - no changes were made"
        return 0
    fi

    log_info "Backup location: $BACKUP_DIR"
    log_info "Backup type: $([ "$SCHEMA_ONLY" = true ] && echo "Schema only" || echo "Full")"
    log_info "Retention policy: ${RETENTION_DAYS} days"
    log_info ""

    # Show backup files and sizes
    log_info "Backup files:"
    if [ -d "$BACKUP_DIR" ]; then
        du -sh "$BACKUP_DIR"/* 2>/dev/null || true
    fi

    # Show total size
    local total_size
    total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    log_info ""
    log_info "Total backup size: $total_size"

    # Show existing backups count
    local backup_count
    backup_count=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -not -path "$BACKUP_BASE_DIR" 2>/dev/null | wc -l)
    log_info "Total Supabase backups stored: $backup_count"

    log_info "========================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    setup_logging

    log_info "========================================"
    log_info "BuhBot Supabase Backup Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info "Timestamp: $TIMESTAMP"
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
    check_pg_dump
    check_disk_space
    test_database_connection

    # Create backup directory
    create_backup_directory

    # Perform backups
    backup_full_database
    backup_schema_only
    backup_specific_tables
    save_backup_metadata

    # Apply retention policy
    apply_retention_policy

    # Show summary
    show_backup_summary

    log_info ""
    log_success "========================================"
    log_success "Supabase backup completed successfully!"
    log_success "========================================"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

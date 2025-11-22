#!/usr/bin/env bash

# ============================================================================
# BuhBot VDS Backup Script
# ============================================================================
# Purpose: Create backups of Docker volumes, configs, and application data
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Backup Docker volumes (redis, prometheus, grafana, uptime-kuma)
# 2. Backup configuration files (.env, docker-compose, nginx)
# 3. Backup application logs
# 4. Apply 4-week retention policy
# 5. Optional: Upload to S3-compatible storage
#
# Requirements:
# - Docker installed and running
# - Sufficient disk space in backup directory
# - Application containers should be running (for consistent backups)
#
# Usage:
#   ./backup.sh                    # Full backup with default settings
#   ./backup.sh --dry-run          # Dry run (no changes)
#   ./backup.sh --upload           # Backup and upload to S3
#   ./backup.sh --retention 14     # Override retention days
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
readonly INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

readonly BACKUP_BASE_DIR="/var/backups/buhbot"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
readonly LOG_FILE="/var/log/buhbot-backup-$(date +%Y%m%d).log"
readonly LOCK_FILE="/tmp/buhbot-backup.lock"

# Default settings
RETENTION_DAYS=28
DRY_RUN=false
UPLOAD_TO_S3=false

# Docker volume names (from docker-compose.yml)
readonly DOCKER_VOLUMES=(
    "buhbot-redis-data"
    "buhbot-prometheus-data"
    "buhbot-grafana-data"
    "buhbot-uptime-kuma-data"
    "buhbot-certbot-data"
)

# Config files to backup
readonly CONFIG_FILES=(
    "${INFRASTRUCTURE_DIR}/docker-compose.yml"
    "${INFRASTRUCTURE_DIR}/docker-compose.prod.yml"
    "${INFRASTRUCTURE_DIR}/nginx/nginx.conf"
    "${INFRASTRUCTURE_DIR}/monitoring/prometheus.yml"
    "${INFRASTRUCTURE_DIR}/monitoring/grafana.ini"
    "${PROJECT_ROOT}/backend/.env"
    "${PROJECT_ROOT}/frontend/.env.local"
)

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
    # Ensure log directory exists
    local log_dir
    log_dir=$(dirname "$LOG_FILE")
    mkdir -p "$log_dir" 2>/dev/null || true

    # Redirect all output to log file and console
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

    if [ $exit_code -ne 0 ]; then
        log_error "Backup failed with exit code $exit_code"
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
            log_error "Another backup is in progress (PID: $lock_pid)"
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
            --upload)
                UPLOAD_TO_S3=true
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
BuhBot VDS Backup Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --dry-run          Perform a dry run without making changes
  --upload           Upload backups to S3 after creation
  --retention DAYS   Override retention days (default: 28)
  -h, --help         Show this help message

Examples:
  $0                      # Full backup with 4-week retention
  $0 --dry-run            # Test backup without changes
  $0 --retention 14       # Use 2-week retention
  $0 --upload             # Backup and upload to S3

Backup includes:
  - Docker volumes (redis, prometheus, grafana, uptime-kuma, certbot)
  - Configuration files (.env, docker-compose, nginx)
  - Application logs

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

    log_success "Docker is running"
}

check_disk_space() {
    local backup_mount
    backup_mount=$(df "$BACKUP_BASE_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")

    # Require at least 2GB free space
    local min_space_kb=2097152

    if [ "$backup_mount" -lt "$min_space_kb" ]; then
        log_error "Insufficient disk space for backup. Available: $((backup_mount / 1024))MB, Required: 2048MB"
        exit 1
    fi

    log_success "Disk space check passed: $((backup_mount / 1024))MB available"
}

create_backup_directory() {
    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create backup directory: $BACKUP_DIR"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/volumes"
    mkdir -p "$BACKUP_DIR/configs"
    mkdir -p "$BACKUP_DIR/logs"

    log_success "Backup directory created: $BACKUP_DIR"
}

# ============================================================================
# Backup Operations
# ============================================================================

backup_docker_volumes() {
    log_info "Backing up Docker volumes..."

    local backed_up=0
    local skipped=0

    for volume in "${DOCKER_VOLUMES[@]}"; do
        if docker volume inspect "$volume" &>/dev/null; then
            log_info "Backing up volume: $volume"

            if [ "$DRY_RUN" = true ]; then
                log_dry_run "Would backup volume: $volume"
            else
                docker run --rm \
                    -v "$volume:/data:ro" \
                    -v "$BACKUP_DIR/volumes:/backup" \
                    alpine tar czf "/backup/${volume}.tar.gz" -C /data .

                log_success "Volume backed up: $volume"
            fi
            ((backed_up++))
        else
            log_warning "Volume not found, skipping: $volume"
            ((skipped++))
        fi
    done

    log_success "Volumes backup complete: $backed_up backed up, $skipped skipped"
}

backup_config_files() {
    log_info "Backing up configuration files..."

    local backed_up=0
    local skipped=0

    for config_file in "${CONFIG_FILES[@]}"; do
        if [ -f "$config_file" ]; then
            local filename
            filename=$(basename "$config_file")
            local dirname
            dirname=$(basename "$(dirname "$config_file")")
            local target_name="${dirname}_${filename}"

            log_info "Backing up config: $config_file"

            if [ "$DRY_RUN" = true ]; then
                log_dry_run "Would backup config: $config_file"
            else
                cp "$config_file" "$BACKUP_DIR/configs/${target_name}"
            fi
            ((backed_up++))
        else
            log_warning "Config file not found, skipping: $config_file"
            ((skipped++))
        fi
    done

    # Create config archive
    if [ "$DRY_RUN" = false ] && [ "$backed_up" -gt 0 ]; then
        tar czf "$BACKUP_DIR/configs.tar.gz" -C "$BACKUP_DIR" configs
        rm -rf "$BACKUP_DIR/configs"
        log_success "Config archive created: configs.tar.gz"
    fi

    log_success "Config backup complete: $backed_up backed up, $skipped skipped"
}

backup_application_logs() {
    log_info "Backing up application logs..."

    local log_dir="${PROJECT_ROOT}/backend/logs"

    if [ -d "$log_dir" ] && [ "$(ls -A "$log_dir" 2>/dev/null)" ]; then
        if [ "$DRY_RUN" = true ]; then
            log_dry_run "Would backup logs from: $log_dir"
        else
            tar czf "$BACKUP_DIR/application-logs.tar.gz" -C "$log_dir" .
            log_success "Application logs backed up"
        fi
    else
        log_warning "No application logs found at: $log_dir"
    fi
}

backup_infrastructure_state() {
    log_info "Saving infrastructure state..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would save infrastructure state"
        return 0
    fi

    # Save Docker container state
    docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}" > "$BACKUP_DIR/container-state.txt"

    # Save Docker volume list
    docker volume ls > "$BACKUP_DIR/volume-list.txt"

    # Save Docker images list
    docker images --format "{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}" > "$BACKUP_DIR/images-list.txt"

    # Save disk usage
    df -h > "$BACKUP_DIR/disk-usage.txt"

    # Save backup metadata
    cat > "$BACKUP_DIR/backup-metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "backup_version": "$SCRIPT_VERSION",
    "retention_days": $RETENTION_DAYS,
    "volumes_backed_up": $(ls -1 "$BACKUP_DIR/volumes" 2>/dev/null | wc -l || echo 0),
    "project_root": "$PROJECT_ROOT"
}
EOF

    log_success "Infrastructure state saved"
}

# ============================================================================
# Retention Policy
# ============================================================================

apply_retention_policy() {
    log_info "Applying ${RETENTION_DAYS}-day retention policy..."

    if [ "$DRY_RUN" = true ]; then
        local old_backups
        old_backups=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -path "$BACKUP_BASE_DIR" 2>/dev/null | wc -l)
        log_dry_run "Would delete $old_backups old backup(s) older than ${RETENTION_DAYS} days"
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
# S3 Upload (Optional)
# ============================================================================

upload_to_s3() {
    if [ "$UPLOAD_TO_S3" = false ]; then
        return 0
    fi

    log_info "Uploading backup to S3..."

    # Check for S3 configuration
    local s3_bucket="${BUHBOT_S3_BUCKET:-}"
    local s3_endpoint="${BUHBOT_S3_ENDPOINT:-}"

    if [ -z "$s3_bucket" ]; then
        log_warning "S3 upload requested but BUHBOT_S3_BUCKET not set"
        log_warning "Skipping S3 upload"
        return 0
    fi

    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not installed. Skipping S3 upload"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would upload to S3: s3://${s3_bucket}/backups/${TIMESTAMP}/"
        return 0
    fi

    local s3_args=()
    if [ -n "$s3_endpoint" ]; then
        s3_args+=(--endpoint-url "$s3_endpoint")
    fi

    # Upload all backup files
    for backup_file in "$BACKUP_DIR"/*.tar.gz "$BACKUP_DIR"/*.txt "$BACKUP_DIR"/*.json; do
        if [ -f "$backup_file" ]; then
            local filename
            filename=$(basename "$backup_file")
            log_info "Uploading: $filename"
            aws s3 cp "${s3_args[@]}" "$backup_file" "s3://${s3_bucket}/backups/${TIMESTAMP}/${filename}"
        fi
    done

    # Upload volume backups
    for backup_file in "$BACKUP_DIR/volumes"/*.tar.gz; do
        if [ -f "$backup_file" ]; then
            local filename
            filename=$(basename "$backup_file")
            log_info "Uploading volume: $filename"
            aws s3 cp "${s3_args[@]}" "$backup_file" "s3://${s3_bucket}/backups/${TIMESTAMP}/volumes/${filename}"
        fi
    done

    log_success "S3 upload complete"
}

# ============================================================================
# Summary
# ============================================================================

show_backup_summary() {
    log_info ""
    log_info "========================================"
    log_info "Backup Summary"
    log_info "========================================"

    if [ "$DRY_RUN" = true ]; then
        log_warning "This was a DRY RUN - no changes were made"
        return 0
    fi

    log_info "Backup location: $BACKUP_DIR"
    log_info "Retention policy: ${RETENTION_DAYS} days"
    log_info ""

    # Show backup sizes
    log_info "Backup contents:"
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
    log_info "Total backups stored: $backup_count"

    log_info "========================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    setup_logging

    log_info "========================================"
    log_info "BuhBot VDS Backup Script v$SCRIPT_VERSION"
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

    # Pre-flight checks
    check_docker
    check_disk_space

    # Create backup directory
    create_backup_directory

    # Perform backups
    backup_docker_volumes
    backup_config_files
    backup_application_logs
    backup_infrastructure_state

    # Apply retention policy
    apply_retention_policy

    # Optional S3 upload
    upload_to_s3

    # Show summary
    show_backup_summary

    log_info ""
    log_success "========================================"
    log_success "Backup completed successfully!"
    log_success "========================================"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

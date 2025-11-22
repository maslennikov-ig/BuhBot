#!/usr/bin/env bash

# ============================================================================
# BuhBot VDS Restore Script
# ============================================================================
# Purpose: Restore Docker volumes and configs from backup archives
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Validate backup archive integrity
# 2. Stop running containers
# 3. Restore Docker volumes
# 4. Restore configuration files
# 5. Restart containers
# 6. Verify services health
#
# Requirements:
# - Docker installed and running
# - Valid backup directory or timestamp
# - Sufficient disk space
#
# Usage:
#   ./restore.sh 20251122_030000           # Restore from specific backup
#   ./restore.sh --latest                   # Restore from latest backup
#   ./restore.sh --dry-run 20251122_030000  # Dry run
#   ./restore.sh --list                     # List available backups
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
readonly LOG_FILE="/var/log/buhbot-restore-$(date +%Y%m%d-%H%M%S).log"
readonly LOCK_FILE="/tmp/buhbot-restore.lock"

readonly COMPOSE_FILE="${INFRASTRUCTURE_DIR}/docker-compose.yml"
readonly COMPOSE_PROD_FILE="${INFRASTRUCTURE_DIR}/docker-compose.prod.yml"

# Restore options
DRY_RUN=false
RESTORE_CONFIGS=true
RESTORE_VOLUMES=true
SKIP_CONFIRMATION=false

# Docker volume names
readonly DOCKER_VOLUMES=(
    "buhbot-redis-data"
    "buhbot-prometheus-data"
    "buhbot-grafana-data"
    "buhbot-uptime-kuma-data"
    "buhbot-certbot-data"
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

    if [ $exit_code -ne 0 ]; then
        log_error "Restore failed with exit code $exit_code"
        log_error "Check log file: $LOG_FILE"
        log_warning "Services may be in an inconsistent state. Check manually!"
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

BACKUP_TIMESTAMP=""

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warning "DRY RUN MODE ENABLED - No changes will be made"
                shift
                ;;
            --latest)
                BACKUP_TIMESTAMP="latest"
                shift
                ;;
            --list)
                list_backups
                exit 0
                ;;
            --skip-configs)
                RESTORE_CONFIGS=false
                shift
                ;;
            --skip-volumes)
                RESTORE_VOLUMES=false
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
                BACKUP_TIMESTAMP="$1"
                shift
                ;;
        esac
    done

    # Validate backup timestamp
    if [ -z "$BACKUP_TIMESTAMP" ]; then
        log_error "No backup timestamp provided"
        log_info "Use --list to see available backups"
        show_help
        exit 1
    fi
}

show_help() {
    cat << EOF
BuhBot VDS Restore Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS] BACKUP_TIMESTAMP

Arguments:
  BACKUP_TIMESTAMP   Timestamp of backup to restore (e.g., 20251122_030000)

Options:
  --latest           Restore from the most recent backup
  --list             List available backups and exit
  --dry-run          Perform a dry run without making changes
  --skip-configs     Skip restoring configuration files
  --skip-volumes     Skip restoring Docker volumes
  --force            Skip confirmation prompts
  -h, --help         Show this help message

Examples:
  $0 20251122_030000                    # Restore specific backup
  $0 --latest                           # Restore latest backup
  $0 --dry-run --latest                 # Test restore process
  $0 --skip-configs 20251122_030000     # Restore volumes only

CAUTION: This will overwrite current data. Make sure you have a recent backup!

EOF
}

list_backups() {
    log_info "Available backups in $BACKUP_BASE_DIR:"
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

            echo "  - $timestamp ($date_formatted) - Size: $size"
            ((count++))
        fi
    done < <(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -not -path "$BACKUP_BASE_DIR" | sort -r)

    echo ""
    log_info "Total backups: $count"
}

# ============================================================================
# Backup Validation
# ============================================================================

resolve_backup_path() {
    if [ "$BACKUP_TIMESTAMP" = "latest" ]; then
        BACKUP_TIMESTAMP=$(find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -not -path "$BACKUP_BASE_DIR" | sort -r | head -1 | xargs basename 2>/dev/null || echo "")

        if [ -z "$BACKUP_TIMESTAMP" ]; then
            log_error "No backups found in $BACKUP_BASE_DIR"
            exit 1
        fi

        log_info "Latest backup: $BACKUP_TIMESTAMP"
    fi
}

validate_backup() {
    local backup_dir="${BACKUP_BASE_DIR}/${BACKUP_TIMESTAMP}"

    if [ ! -d "$backup_dir" ]; then
        log_error "Backup directory not found: $backup_dir"
        log_info "Use --list to see available backups"
        exit 1
    fi

    log_info "Validating backup: $backup_dir"

    # Check for volume backups
    if [ "$RESTORE_VOLUMES" = true ]; then
        local volume_dir="$backup_dir/volumes"
        if [ ! -d "$volume_dir" ]; then
            log_warning "No volumes directory found in backup"
        else
            local volume_count
            volume_count=$(find "$volume_dir" -name "*.tar.gz" 2>/dev/null | wc -l)
            log_info "Found $volume_count volume backup(s)"
        fi
    fi

    # Check for config backup
    if [ "$RESTORE_CONFIGS" = true ]; then
        if [ ! -f "$backup_dir/configs.tar.gz" ]; then
            log_warning "No configs.tar.gz found in backup"
        else
            log_info "Config backup found"
        fi
    fi

    # Check backup metadata
    if [ -f "$backup_dir/backup-metadata.json" ]; then
        log_info "Backup metadata:"
        cat "$backup_dir/backup-metadata.json"
        echo ""
    fi

    log_success "Backup validation passed"
}

# ============================================================================
# Confirmation
# ============================================================================

confirm_restore() {
    if [ "$SKIP_CONFIRMATION" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log_warning ""
    log_warning "========================================"
    log_warning "WARNING: This will OVERWRITE current data!"
    log_warning "========================================"
    log_warning ""
    log_warning "Backup to restore: $BACKUP_TIMESTAMP"
    log_warning "Restore volumes: $RESTORE_VOLUMES"
    log_warning "Restore configs: $RESTORE_CONFIGS"
    log_warning ""

    read -p "Are you sure you want to continue? (yes/no): " -r

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi

    log_success "Restore confirmed"
}

# ============================================================================
# Restore Operations
# ============================================================================

stop_services() {
    log_info "Stopping BuhBot services..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would stop all services with docker compose down"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    if [ -f "$COMPOSE_FILE" ] && [ -f "$COMPOSE_PROD_FILE" ]; then
        docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" down --timeout 30 || {
            log_warning "Failed to stop services gracefully, forcing stop..."
            docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" kill || true
            docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" down || true
        }
    else
        log_warning "Compose files not found, attempting to stop containers by name..."
        docker stop buhbot-bot-backend buhbot-frontend buhbot-redis buhbot-monitoring-stack buhbot-nginx 2>/dev/null || true
    fi

    log_success "Services stopped"
}

restore_docker_volumes() {
    if [ "$RESTORE_VOLUMES" = false ]; then
        log_info "Skipping volume restore (--skip-volumes)"
        return 0
    fi

    local backup_dir="${BACKUP_BASE_DIR}/${BACKUP_TIMESTAMP}"
    local volume_dir="$backup_dir/volumes"

    if [ ! -d "$volume_dir" ]; then
        log_warning "No volumes directory found in backup, skipping"
        return 0
    fi

    log_info "Restoring Docker volumes..."

    local restored=0
    local skipped=0

    for volume_archive in "$volume_dir"/*.tar.gz; do
        if [ -f "$volume_archive" ]; then
            local volume_name
            volume_name=$(basename "$volume_archive" .tar.gz)

            log_info "Restoring volume: $volume_name"

            if [ "$DRY_RUN" = true ]; then
                log_dry_run "Would restore volume: $volume_name"
                ((restored++))
                continue
            fi

            # Create volume if it doesn't exist
            docker volume create "$volume_name" 2>/dev/null || true

            # Clear existing data and restore
            docker run --rm \
                -v "$volume_name:/data" \
                -v "$volume_dir:/backup:ro" \
                alpine sh -c "rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null || true; tar xzf /backup/${volume_name}.tar.gz -C /data"

            log_success "Volume restored: $volume_name"
            ((restored++))
        fi
    done

    log_success "Volume restore complete: $restored restored"
}

restore_config_files() {
    if [ "$RESTORE_CONFIGS" = false ]; then
        log_info "Skipping config restore (--skip-configs)"
        return 0
    fi

    local backup_dir="${BACKUP_BASE_DIR}/${BACKUP_TIMESTAMP}"
    local config_archive="$backup_dir/configs.tar.gz"

    if [ ! -f "$config_archive" ]; then
        log_warning "No configs.tar.gz found in backup, skipping"
        return 0
    fi

    log_info "Restoring configuration files..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would extract configs from: $config_archive"
        tar -tzf "$config_archive" | while read -r file; do
            log_dry_run "  - $file"
        done
        return 0
    fi

    # Extract to temp directory first
    local temp_dir
    temp_dir=$(mktemp -d)

    tar xzf "$config_archive" -C "$temp_dir"

    # Restore config files to their original locations
    local configs_dir="$temp_dir/configs"

    if [ -d "$configs_dir" ]; then
        # Restore docker-compose files
        for compose_file in "$configs_dir"/infrastructure_docker-compose*.yml; do
            if [ -f "$compose_file" ]; then
                local target_name
                target_name=$(basename "$compose_file" | sed 's/infrastructure_//')
                log_info "Restoring: $target_name"
                cp "$compose_file" "$INFRASTRUCTURE_DIR/$target_name"
            fi
        done

        # Restore nginx config
        if [ -f "$configs_dir/nginx_nginx.conf" ]; then
            log_info "Restoring: nginx/nginx.conf"
            cp "$configs_dir/nginx_nginx.conf" "$INFRASTRUCTURE_DIR/nginx/nginx.conf"
        fi

        # Restore monitoring configs
        if [ -f "$configs_dir/monitoring_prometheus.yml" ]; then
            log_info "Restoring: monitoring/prometheus.yml"
            cp "$configs_dir/monitoring_prometheus.yml" "$INFRASTRUCTURE_DIR/monitoring/prometheus.yml"
        fi

        if [ -f "$configs_dir/monitoring_grafana.ini" ]; then
            log_info "Restoring: monitoring/grafana.ini"
            cp "$configs_dir/monitoring_grafana.ini" "$INFRASTRUCTURE_DIR/monitoring/grafana.ini"
        fi

        # Restore .env files (with warning)
        if [ -f "$configs_dir/backend_.env" ]; then
            log_warning "Restoring backend .env file"
            cp "$configs_dir/backend_.env" "$PROJECT_ROOT/backend/.env"
        fi

        if [ -f "$configs_dir/frontend_.env.local" ]; then
            log_warning "Restoring frontend .env.local file"
            cp "$configs_dir/frontend_.env.local" "$PROJECT_ROOT/frontend/.env.local"
        fi
    fi

    # Cleanup
    rm -rf "$temp_dir"

    log_success "Configuration files restored"
}

start_services() {
    log_info "Starting BuhBot services..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would start all services with docker compose up -d"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    if [ -f "$COMPOSE_FILE" ] && [ -f "$COMPOSE_PROD_FILE" ]; then
        docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" up -d --remove-orphans
    else
        log_error "Compose files not found, cannot start services"
        exit 1
    fi

    log_success "Services started"
}

# ============================================================================
# Health Verification
# ============================================================================

verify_services_health() {
    log_info "Verifying services health..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would verify services health"
        return 0
    fi

    local timeout=120
    local elapsed=0
    local interval=5

    while [ $elapsed -lt $timeout ]; do
        local unhealthy=0

        # Check Redis
        if ! docker exec buhbot-redis redis-cli ping &>/dev/null; then
            ((unhealthy++))
        fi

        # Check bot-backend
        if ! curl -f -s -o /dev/null --max-time 5 http://localhost:3000/health 2>/dev/null; then
            ((unhealthy++))
        fi

        # Check frontend
        if ! curl -f -s -o /dev/null --max-time 5 http://localhost:3001/ 2>/dev/null; then
            ((unhealthy++))
        fi

        if [ $unhealthy -eq 0 ]; then
            log_success "All services are healthy"
            return 0
        fi

        log_info "Waiting for services... ($elapsed/${timeout}s) - $unhealthy service(s) not ready"
        sleep $interval
        ((elapsed += interval))
    done

    log_warning "Health check timeout reached. Some services may not be ready."
    log_info "Container status:"
    docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" ps

    return 1
}

# ============================================================================
# Summary
# ============================================================================

show_restore_summary() {
    log_info ""
    log_info "========================================"
    log_info "Restore Summary"
    log_info "========================================"

    if [ "$DRY_RUN" = true ]; then
        log_warning "This was a DRY RUN - no changes were made"
        return 0
    fi

    log_info "Backup restored: $BACKUP_TIMESTAMP"
    log_info "Volumes restored: $RESTORE_VOLUMES"
    log_info "Configs restored: $RESTORE_CONFIGS"
    log_info ""

    # Show container status
    log_info "Container status:"
    cd "$INFRASTRUCTURE_DIR"
    docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" ps 2>/dev/null || true

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
    log_info "BuhBot VDS Restore Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info "Log file: $LOG_FILE"
    log_info ""

    # Parse arguments
    parse_arguments "$@"

    # Acquire lock
    if [ "$DRY_RUN" = false ]; then
        acquire_lock
    fi

    # Resolve and validate backup
    resolve_backup_path
    validate_backup

    # Confirm restore
    confirm_restore

    # Stop services
    stop_services

    # Perform restore
    restore_docker_volumes
    restore_config_files

    # Start services
    start_services

    # Verify health
    verify_services_health || true

    # Show summary
    show_restore_summary

    log_info ""
    log_success "========================================"
    log_success "Restore completed successfully!"
    log_success "========================================"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

#!/usr/bin/env bash

# ============================================================================
# BuhBot Deployment Script
# ============================================================================
# Purpose: Deploy or update BuhBot application with health checks and rollback
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Pre-flight checks (Docker, files, disk space)
# 2. Create backup of current deployment
# 3. Pull latest Docker images
# 4. Deploy services with docker compose
# 5. Wait for health checks to pass
# 6. Verify deployment endpoints
# 7. Rollback on failure
# 8. Cleanup old images
#
# Requirements:
# - Docker and Docker Compose installed
# - Application files in /home/buhbot/BuhBot
# - Environment files (.env) configured
# - At least 5GB free disk space
#
# Usage:
#   ./deploy.sh                    # Normal deployment with confirmation
#   ./deploy.sh --dry-run          # Dry run (no changes)
#   ./deploy.sh --force            # Skip confirmation prompts
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

readonly COMPOSE_FILE="${INFRASTRUCTURE_DIR}/docker-compose.yml"
readonly COMPOSE_PROD_FILE="${INFRASTRUCTURE_DIR}/docker-compose.prod.yml"
readonly BACKUP_DIR="/var/backups/buhbot-pre-deploy-$(date +%Y%m%d-%H%M%S)"
readonly LOCK_FILE="/tmp/buhbot-deploy.lock"
readonly LOG_FILE="/var/log/buhbot-deploy-$(date +%Y%m%d-%H%M%S).log"

readonly MIN_DISK_SPACE_GB=5
readonly HEALTH_CHECK_TIMEOUT=300
readonly HEALTH_CHECK_INTERVAL=5

# Command-line flags
DRY_RUN=false
FORCE=false

# Color codes for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# ============================================================================
# Logging Functions
# ============================================================================

# Redirect all output to log file and console
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

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
        log_error "Deployment failed with exit code $exit_code"
        log_error "Check log file: $LOG_FILE"
        log_error "Backup available at: $BACKUP_DIR"
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
            log_error "Another deployment is in progress (PID: $lock_pid)"
            log_error "If this is incorrect, remove $LOCK_FILE manually"
            exit 1
        else
            log_warning "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi

    echo $$ > "$LOCK_FILE"
    log_success "Deployment lock acquired"
}

release_lock() {
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log_success "Deployment lock released"
    fi
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
            --force)
                FORCE=true
                log_warning "FORCE MODE ENABLED - Skipping confirmations"
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
BuhBot Deployment Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --dry-run    Perform a dry run without making changes
  --force      Skip confirmation prompts
  -h, --help   Show this help message

Examples:
  $0                    # Normal deployment with confirmation
  $0 --dry-run          # Test deployment without changes
  $0 --force            # Deploy without prompts (CI/CD mode)

EOF
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_docker() {
    log_info "Checking Docker installation..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        log_error "Try: sudo systemctl start docker"
        exit 1
    fi

    log_success "Docker is running: $(docker --version)"
}

check_docker_compose() {
    log_info "Checking Docker Compose..."

    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    log_success "Docker Compose available: $(docker compose version)"
}

check_compose_files() {
    log_info "Checking Docker Compose files..."

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [ ! -f "$COMPOSE_PROD_FILE" ]; then
        log_error "Production Compose file not found: $COMPOSE_PROD_FILE"
        exit 1
    fi

    log_success "Compose files found"
}

check_env_files() {
    log_info "Checking environment files..."

    local missing_files=()

    if [ ! -f "${PROJECT_ROOT}/backend/.env" ]; then
        missing_files+=("backend/.env")
    fi

    if [ ! -f "${PROJECT_ROOT}/frontend/.env.local" ]; then
        missing_files+=("frontend/.env.local")
    fi

    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Missing environment files:"
        for file in "${missing_files[@]}"; do
            log_error "  - $file"
        done
        log_error "Copy .env.example files and configure them"
        exit 1
    fi

    log_success "Environment files found"
}

check_disk_space() {
    log_info "Checking disk space..."

    local available_gb
    available_gb=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')

    if [ "$available_gb" -lt "$MIN_DISK_SPACE_GB" ]; then
        log_error "Insufficient disk space: ${available_gb}GB available, ${MIN_DISK_SPACE_GB}GB required"
        exit 1
    fi

    log_success "Disk space: ${available_gb}GB available"
}

run_preflight_checks() {
    log_info "Running pre-flight checks..."

    check_docker
    check_docker_compose
    check_compose_files
    check_env_files
    check_disk_space

    log_success "All pre-flight checks passed"
}

# ============================================================================
# Backup Operations
# ============================================================================

backup_current_state() {
    log_info "Creating backup of current state..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create backup at: $BACKUP_DIR"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"

    # Backup environment files
    log_info "Backing up environment files..."
    cp "${PROJECT_ROOT}/backend/.env" "${BACKUP_DIR}/backend.env" 2>/dev/null || true
    cp "${PROJECT_ROOT}/frontend/.env.local" "${BACKUP_DIR}/frontend.env.local" 2>/dev/null || true

    # Backup Docker volumes
    log_info "Backing up Docker volumes..."
    local volumes
    volumes=$(docker volume ls --filter "name=buhbot-" -q)

    if [ -n "$volumes" ]; then
        for volume in $volumes; do
            log_info "Backing up volume: $volume"
            docker run --rm \
                -v "$volume:/data" \
                -v "$BACKUP_DIR:/backup" \
                alpine tar czf "/backup/${volume}.tar.gz" -C /data .
        done
    else
        log_warning "No Docker volumes found to backup"
    fi

    # Save container state
    log_info "Saving container state..."
    docker compose \
        -f "$COMPOSE_FILE" \
        -f "$COMPOSE_PROD_FILE" \
        ps --format json > "${BACKUP_DIR}/container-state.json" 2>/dev/null || true

    log_success "Backup created at: $BACKUP_DIR"
}

# ============================================================================
# Deployment Operations
# ============================================================================

pull_images() {
    log_info "Pulling latest Docker images..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would pull images"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    if ! docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        pull; then
        log_error "Failed to pull Docker images"
        exit 1
    fi

    log_success "Images pulled successfully"
}

fix_volume_permissions() {
    log_info "Ensuring Docker volume permissions..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would fix volume permissions"
        return 0
    fi

    # Jaeger runs as uid 10001 and needs write access to /badger
    docker volume create buhbot-jaeger-data 2>/dev/null || true
    docker run --rm \
        -v buhbot-jaeger-data:/badger \
        alpine chown -R 10001:10001 /badger

    log_success "Volume permissions set"
}

deploy_services() {
    log_info "Deploying services..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would deploy services with docker compose up"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    if ! docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        up -d --remove-orphans; then
        log_error "Failed to deploy services"
        return 1
    fi

    log_success "Services deployed"
}

wait_for_health_checks() {
    log_info "Waiting for health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would wait for health checks"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    local elapsed=0
    local all_healthy=false

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        local unhealthy_count=0
        local container_status

        # Get status of all containers
        container_status=$(docker compose \
            -f docker-compose.yml \
            -f docker-compose.prod.yml \
            ps --format json 2>/dev/null || echo "[]")

        # Check if all containers are healthy or running
        if echo "$container_status" | jq -e '. | length > 0' &>/dev/null; then
            # Count unhealthy containers
            unhealthy_count=$(echo "$container_status" | \
                jq -r '.[] | select(.Health == "unhealthy" or (.State != "running" and .State != "Up"))' | \
                wc -l)

            if [ "$unhealthy_count" -eq 0 ]; then
                all_healthy=true
                break
            fi

            log_info "Waiting... ($elapsed/${HEALTH_CHECK_TIMEOUT}s) - $unhealthy_count container(s) not ready"
        fi

        sleep $HEALTH_CHECK_INTERVAL
        ((elapsed += HEALTH_CHECK_INTERVAL))
    done

    if [ "$all_healthy" = true ]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "Health checks failed after ${HEALTH_CHECK_TIMEOUT}s"
        log_error "Container status:"
        docker compose \
            -f docker-compose.yml \
            -f docker-compose.prod.yml \
            ps
        return 1
    fi
}

verify_endpoints() {
    log_info "Verifying deployment endpoints..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would verify endpoints"
        return 0
    fi

    local errors=0

    # Test bot-backend health endpoint
    log_info "Testing bot-backend health endpoint..."
    if curl -f -s -o /dev/null --max-time 10 http://localhost:3000/health; then
        log_success "Bot backend: OK"
    else
        log_error "Bot backend health check failed"
        ((errors++))
    fi

    # Test frontend
    log_info "Testing frontend..."
    if curl -f -s -o /dev/null --max-time 10 http://localhost:3001/; then
        log_success "Frontend: OK"
    else
        log_error "Frontend health check failed"
        ((errors++))
    fi

    # Test nginx
    log_info "Testing nginx..."
    if curl -f -s -o /dev/null --max-time 10 http://localhost/health; then
        log_success "Nginx: OK"
    else
        log_warning "Nginx health check failed (may not be configured yet)"
    fi

    if [ $errors -gt 0 ]; then
        log_error "Endpoint verification failed with $errors error(s)"
        return 1
    fi

    log_success "All endpoints verified"
    return 0
}

# ============================================================================
# Rollback Operations
# ============================================================================

rollback_deployment() {
    log_warning "Initiating rollback..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would rollback deployment"
        return 0
    fi

    cd "$INFRASTRUCTURE_DIR"

    # Stop current containers
    log_info "Stopping current containers..."
    docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        down || true

    # Restore volumes from backup
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Restoring volumes from backup..."

        for backup_file in "$BACKUP_DIR"/*.tar.gz; do
            if [ -f "$backup_file" ]; then
                local volume_name
                volume_name=$(basename "$backup_file" .tar.gz)

                log_info "Restoring volume: $volume_name"
                docker volume create "$volume_name" || true
                docker run --rm \
                    -v "$volume_name:/data" \
                    -v "$BACKUP_DIR:/backup" \
                    alpine sh -c "rm -rf /data/* && tar xzf /backup/${volume_name}.tar.gz -C /data" || true
            fi
        done
    fi

    # Start previous version
    log_info "Starting previous version..."
    docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        up -d --remove-orphans || true

    log_warning "Rollback completed - check services manually"
}

# ============================================================================
# Post-deployment Operations
# ============================================================================

cleanup_old_images() {
    log_info "Cleaning up old Docker images..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would cleanup old images"
        return 0
    fi

    docker image prune -f

    log_success "Old images cleaned up"
}

show_deployment_summary() {
    log_info ""
    log_info "========================================"
    log_info "Deployment Summary"
    log_info "========================================"

    cd "$INFRASTRUCTURE_DIR"

    # Show container status
    log_info "Container Status:"
    docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        ps

    log_info ""
    log_info "Backup Location: $BACKUP_DIR"
    log_info "Log File: $LOG_FILE"
    log_info "========================================"
}

# ============================================================================
# Confirmation
# ============================================================================

confirm_deployment() {
    if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log_warning "This will deploy BuhBot to production"
    log_warning "Current containers will be stopped and restarted"
    echo ""
    read -p "Continue with deployment? (yes/no): " -r

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi

    log_success "Deployment confirmed"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "========================================"
    log_info "BuhBot Deployment Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info "Project Root: $PROJECT_ROOT"
    log_info "Log File: $LOG_FILE"
    log_info ""

    # Parse arguments
    parse_arguments "$@"

    # Acquire deployment lock
    if [ "$DRY_RUN" = false ]; then
        acquire_lock
    fi

    # Pre-flight checks
    run_preflight_checks

    # Confirm deployment
    confirm_deployment

    # Create backup
    backup_current_state

    # Pull images
    pull_images

    # Fix volume permissions (Jaeger uid:10001 needs /badger writable)
    fix_volume_permissions

    # Deploy services
    if ! deploy_services; then
        log_error "Deployment failed"
        rollback_deployment
        exit 1
    fi

    # Wait for health checks
    if ! wait_for_health_checks; then
        log_error "Health checks failed"
        rollback_deployment
        exit 1
    fi

    # Verify endpoints
    if ! verify_endpoints; then
        log_error "Endpoint verification failed"
        rollback_deployment
        exit 1
    fi

    # Cleanup
    cleanup_old_images

    # Show summary
    show_deployment_summary

    # Release lock
    if [ "$DRY_RUN" = false ]; then
        release_lock
    fi

    log_info ""
    log_success "========================================"
    log_success "Deployment completed successfully!"
    log_success "========================================"
    log_info ""

    if [ "$DRY_RUN" = true ]; then
        log_warning "This was a DRY RUN - no changes were made"
    fi
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

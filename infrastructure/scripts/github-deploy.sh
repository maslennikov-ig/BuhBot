#!/usr/bin/env bash

# ============================================================================
# BuhBot GitHub Actions Deployment Script
# ============================================================================
# Purpose: Deploy BuhBot from GitHub Actions with zero-downtime and rollback
# Version: 1.0.0
#
# This script is called by GitHub Actions CD workflow to:
# 1. Create backup of current state
# 2. Tag images with the deployment commit
# 3. Deploy services with docker compose
# 4. Wait for health checks
# 5. Rollback on failure
#
# Usage:
#   ./github-deploy.sh --commit <sha> --version <version>
#   ./github-deploy.sh --rollback
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
readonly BACKUP_DIR="/var/backups/buhbot"
readonly STATE_FILE="/var/lib/buhbot/deployment-state.json"
readonly LOCK_FILE="/tmp/buhbot-github-deploy.lock"

readonly HEALTH_CHECK_TIMEOUT=180
readonly HEALTH_CHECK_INTERVAL=10
readonly GRACEFUL_SHUTDOWN_TIMEOUT=30

# Command-line arguments
COMMIT_SHA=""
VERSION=""
ROLLBACK_MODE=false

# Color codes
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# ============================================================================
# Logging Functions
# ============================================================================

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
    fi
}

trap cleanup EXIT

# ============================================================================
# Lock Management
# ============================================================================

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")

        if [ -n "$lock_pid" ] && ps -p "$lock_pid" > /dev/null 2>&1; then
            log_error "Another deployment is in progress (PID: $lock_pid)"
            exit 1
        else
            log_warning "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi

    echo $$ > "$LOCK_FILE"
    log_info "Deployment lock acquired"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

preflight_checks() {
    log_info "Running pre-flight checks..."
    local errors=0

    # Check required commands
    local required_commands=("jq" "docker" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            errors=$((errors + 1))
        fi
    done

    # Check if ports 80/443 are available or used by our containers
    for port in 80 443; do
        local port_user
        port_user=$(sudo lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)

        if [ -n "$port_user" ]; then
            local process_name
            process_name=$(ps -p "$port_user" -o comm= 2>/dev/null || echo "unknown")

            # Allow if it's docker-proxy (our containers)
            if [[ "$process_name" != "docker-proxy" ]]; then
                log_error "Port $port is in use by '$process_name' (PID: $port_user). Stop it before deploying."
                errors=$((errors + 1))
            fi
        fi
    done

    # Check docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        errors=$((errors + 1))
    fi

    # Backend .env is required (workflow does not sync .env for security)
    local backend_env="${PROJECT_ROOT}/backend/.env"
    if [ ! -f "$backend_env" ]; then
        log_error "backend/.env is required on the server but not found at: $backend_env"
        log_error "Create it from backend/.env.example and set at least DATABASE_URL and TELEGRAM_BOT_TOKEN"
        errors=$((errors + 1))
    else
        if ! grep -qE '^DATABASE_URL=' "$backend_env" 2>/dev/null; then
            log_error "backend/.env must contain DATABASE_URL"
            errors=$((errors + 1))
        fi
        if ! grep -qE '^TELEGRAM_BOT_TOKEN=' "$backend_env" 2>/dev/null; then
            log_error "backend/.env must contain TELEGRAM_BOT_TOKEN"
            errors=$((errors + 1))
        fi
    fi

    if [ $errors -gt 0 ]; then
        log_error "Pre-flight checks failed with $errors error(s)"
        exit 1
    fi

    log_success "Pre-flight checks passed"
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --commit)
                COMMIT_SHA="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --rollback)
                ROLLBACK_MODE=true
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

    if [ "$ROLLBACK_MODE" = false ]; then
        if [ -z "$COMMIT_SHA" ]; then
            log_error "Missing required argument: --commit"
            exit 1
        fi
    fi
}

show_help() {
    cat << EOF
BuhBot GitHub Actions Deployment Script v$SCRIPT_VERSION

Usage:
  $0 --commit <sha> [--version <version>]   Deploy specified commit
  $0 --rollback                              Rollback to previous state
  $0 -h|--help                               Show this help

Options:
  --commit <sha>     Git commit SHA to deploy
  --version <ver>    Version string (optional)
  --rollback         Rollback to previous deployment state

Examples:
  $0 --commit abc1234 --version 1.0.0
  $0 --rollback

EOF
}

# ============================================================================
# State Management
# ============================================================================

save_deployment_state() {
    local commit=$1
    local version=$2
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    mkdir -p "$(dirname "$STATE_FILE")"

    # Save current state before overwriting
    if [ -f "$STATE_FILE" ]; then
        cp "$STATE_FILE" "${STATE_FILE}.previous"
    fi

    cat > "$STATE_FILE" << EOF
{
  "commit": "$commit",
  "version": "$version",
  "deployed_at": "$timestamp",
  "deployed_by": "github-actions"
}
EOF

    log_info "Deployment state saved"
}

get_previous_state() {
    if [ -f "${STATE_FILE}.previous" ]; then
        cat "${STATE_FILE}.previous"
    else
        echo "{}"
    fi
}

# ============================================================================
# Backup Operations
# ============================================================================

backup_current_state() {
    local backup_timestamp
    backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local current_backup_dir="${BACKUP_DIR}/${backup_timestamp}"

    log_info "Creating backup at: $current_backup_dir"

    mkdir -p "$current_backup_dir"

    # Backup current state file
    if [ -f "$STATE_FILE" ]; then
        cp "$STATE_FILE" "$current_backup_dir/deployment-state.json"
    fi

    # Backup docker compose state
    cd "$INFRASTRUCTURE_DIR"
    docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --format json > "$current_backup_dir/container-state.json" 2>/dev/null || true

    # Save current image tags
    docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "^buhbot-" > "$current_backup_dir/image-tags.txt" || true

    # Keep only last 5 backups
    ls -dt "${BACKUP_DIR}"/*/ 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

    log_success "Backup created: $current_backup_dir"
    echo "$current_backup_dir"
}

# ============================================================================
# Docker Operations
# ============================================================================

tag_images() {
    local commit=$1

    log_info "Tagging images with deployment markers..."

    # Tag backend image
    if docker images -q "buhbot-backend:${commit}" &>/dev/null; then
        docker tag "buhbot-backend:${commit}" "buhbot-backend:latest" || true
        docker tag "buhbot-backend:${commit}" "buhbot-backend:deployed" || true
    fi

    # Tag frontend image
    if docker images -q "buhbot-frontend:${commit}" &>/dev/null; then
        docker tag "buhbot-frontend:${commit}" "buhbot-frontend:latest" || true
        docker tag "buhbot-frontend:${commit}" "buhbot-frontend:deployed" || true
    fi

    # Tag monitoring image
    if docker images -q "buhbot-monitoring:${commit}" &>/dev/null; then
        docker tag "buhbot-monitoring:${commit}" "buhbot-monitoring:latest" || true
        docker tag "buhbot-monitoring:${commit}" "buhbot-monitoring:deployed" || true
    fi

    log_success "Images tagged"
}

graceful_stop() {
    log_info "Performing graceful shutdown (timeout: ${GRACEFUL_SHUTDOWN_TIMEOUT}s)..."

    cd "$INFRASTRUCTURE_DIR"

    # Send SIGTERM to allow graceful shutdown
    docker compose -f docker-compose.yml -f docker-compose.prod.yml stop \
        --timeout "$GRACEFUL_SHUTDOWN_TIMEOUT" || true

    log_success "Graceful shutdown completed"
}

fix_volume_permissions() {
    log_info "Ensuring Docker volume permissions..."

    # Jaeger v1.54 runs as uid 10001 and needs write access to /badger
    docker volume create buhbot-jaeger-data 2>/dev/null || true
    docker run --rm \
        -v buhbot-jaeger-data:/badger \
        alpine chown -R 10001:10001 /badger

    log_success "Volume permissions set"
}

deploy_services() {
    log_info "Deploying services..."

    cd "$INFRASTRUCTURE_DIR"

    # Build or use pre-built images
    if ! docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans; then
        log_error "Failed to deploy services"
        return 1
    fi

    log_success "Services deployed"
    return 0
}

# ============================================================================
# Database Migrations
# ============================================================================

run_migrations() {
    log_info "Running Prisma migrations..."

    if docker exec buhbot-bot-backend npx prisma migrate deploy 2>&1; then
        log_success "Migrations applied successfully"
        return 0
    else
        log_error "Migration failed!"
        return 1
    fi
}

# ============================================================================
# Health Checks
# ============================================================================

wait_for_health_checks() {
    log_info "Waiting for health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    local elapsed=0
    local all_healthy=false

    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        local backend_healthy=false
        local frontend_healthy=false
        local redis_healthy=false

        # Check bot-backend
        if curl -f -s -o /dev/null --max-time 5 http://localhost:3000/health 2>/dev/null; then
            backend_healthy=true
        fi

        # Check frontend
        if curl -f -s -o /dev/null --max-time 5 http://localhost:3001/ 2>/dev/null; then
            frontend_healthy=true
        fi

        # Check Redis
        if docker exec buhbot-redis redis-cli ping 2>/dev/null | grep -q PONG; then
            redis_healthy=true
        fi

        if [ "$backend_healthy" = true ] && [ "$frontend_healthy" = true ] && [ "$redis_healthy" = true ]; then
            all_healthy=true
            break
        fi

        log_info "Health check ($elapsed/${HEALTH_CHECK_TIMEOUT}s): backend=$backend_healthy, frontend=$frontend_healthy, redis=$redis_healthy"

        sleep $HEALTH_CHECK_INTERVAL
        ((elapsed += HEALTH_CHECK_INTERVAL))
    done

    if [ "$all_healthy" = true ]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "Health checks failed after ${HEALTH_CHECK_TIMEOUT}s"
        return 1
    fi
}

# ============================================================================
# Rollback Operations
# ============================================================================

rollback() {
    log_warning "Initiating rollback..."

    cd "$INFRASTRUCTURE_DIR"

    # Get previous state
    local previous_state
    previous_state=$(get_previous_state)

    if [ "$previous_state" = "{}" ]; then
        log_warning "No previous state found, performing basic rollback..."
    else
        local previous_commit
        previous_commit=$(echo "$previous_state" | jq -r '.commit // ""')

        if [ -n "$previous_commit" ] && [ "$previous_commit" != "null" ]; then
            log_info "Rolling back to commit: $previous_commit"

            # Re-tag previous images if available
            if docker images -q "buhbot-backend:${previous_commit}" &>/dev/null; then
                docker tag "buhbot-backend:${previous_commit}" "buhbot-backend:latest" || true
            fi
            if docker images -q "buhbot-frontend:${previous_commit}" &>/dev/null; then
                docker tag "buhbot-frontend:${previous_commit}" "buhbot-frontend:latest" || true
            fi
            if docker images -q "buhbot-monitoring:${previous_commit}" &>/dev/null; then
                docker tag "buhbot-monitoring:${previous_commit}" "buhbot-monitoring:latest" || true
            fi
        fi
    fi

    # Restart services with previous/available images
    graceful_stop

    if docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans; then
        log_info "Waiting for rollback services to stabilize..."
        sleep 30

        if wait_for_health_checks; then
            # Restore previous state file
            if [ -f "${STATE_FILE}.previous" ]; then
                cp "${STATE_FILE}.previous" "$STATE_FILE"
            fi

            log_success "Rollback completed successfully"
            return 0
        fi
    fi

    log_error "Rollback failed - manual intervention required"
    return 1
}

# ============================================================================
# Cleanup Operations
# ============================================================================

cleanup_old_images() {
    log_info "Cleaning up old Docker images..."

    # Remove dangling images
    docker image prune -f 2>/dev/null || true

    # Keep only last 3 versions of each image
    for image in buhbot-backend buhbot-frontend buhbot-monitoring; do
        docker images "$image" --format "{{.ID}}" | tail -n +4 | xargs -r docker rmi -f 2>/dev/null || true
    done

    log_success "Old images cleaned up"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "========================================"
    log_info "BuhBot GitHub Actions Deployment v$SCRIPT_VERSION"
    log_info "========================================"

    # Parse arguments
    parse_arguments "$@"

    # Run pre-flight checks (skip for rollback)
    if [ "$ROLLBACK_MODE" != true ]; then
        preflight_checks
    fi

    # Acquire lock
    acquire_lock

    # Handle rollback mode
    if [ "$ROLLBACK_MODE" = true ]; then
        rollback
        exit $?
    fi

    log_info "Deploying commit: $COMMIT_SHA"
    log_info "Version: ${VERSION:-unknown}"

    # Create backup
    local backup_path
    backup_path=$(backup_current_state)

    # Tag images with deployment markers
    tag_images "$COMMIT_SHA"

    # Fix volume permissions (Jaeger uid:10001 needs /badger writable)
    fix_volume_permissions

    # Graceful stop of current services
    graceful_stop

    # Deploy new services
    if ! deploy_services; then
        log_error "Deployment failed, initiating rollback..."
        rollback
        exit 1
    fi

    # Run database migrations after containers are up
    if ! run_migrations; then
        log_error "Migration failed, initiating rollback..."
        rollback
        exit 1
    fi

    # Wait for health checks
    if ! wait_for_health_checks; then
        log_error "Health checks failed, initiating rollback..."
        rollback
        exit 1
    fi

    # Save deployment state
    save_deployment_state "$COMMIT_SHA" "${VERSION:-unknown}"

    # Cleanup old images
    cleanup_old_images

    log_info ""
    log_success "========================================"
    log_success "Deployment completed successfully!"
    log_success "========================================"
    log_info "Commit: $COMMIT_SHA"
    log_info "Version: ${VERSION:-unknown}"
    log_info "Backup: $backup_path"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

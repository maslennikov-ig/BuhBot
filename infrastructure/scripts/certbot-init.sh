#!/usr/bin/env bash

# ============================================================================
# BuhBot Let's Encrypt Certificate Acquisition Script
# ============================================================================
# Purpose: Initial SSL certificate acquisition using Certbot Docker container
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Validates required configuration (domain, email)
# 2. Creates necessary directories and volumes
# 3. Requests SSL certificate from Let's Encrypt
# 4. Stores certificates in Docker volume for Nginx
# 5. Verifies certificate acquisition
#
# Requirements:
# - Docker installed and running
# - Domain DNS configured (A record pointing to VDS IP)
# - Port 80 accessible from internet (for ACME challenge)
# - Nginx container running with ACME challenge location configured
#
# Usage:
#   ./certbot-init.sh                           # Interactive mode
#   ./certbot-init.sh --domain example.com      # Specify domain
#   ./certbot-init.sh --staging                 # Use staging environment
#   ./certbot-init.sh --dry-run                 # Test without changes
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration - EDIT THESE VALUES
# ============================================================================

# Domain name for SSL certificate (override with --domain flag)
DOMAIN="${BUHBOT_DOMAIN:-}"

# Email for Let's Encrypt notifications (override with --email flag)
EMAIL="${BUHBOT_EMAIL:-admin@example.com}"

# RSA key size (2048 or 4096)
RSA_KEY_SIZE=4096

# ============================================================================
# Script Configuration (do not edit unless you know what you're doing)
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly INFRASTRUCTURE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker image for Certbot
readonly CERTBOT_IMAGE="certbot/certbot:v2.7.4"

# Volume names (must match docker-compose.yml)
readonly CERTBOT_DATA_VOLUME="buhbot-certbot-data"
readonly LETSENCRYPT_VOLUME="buhbot-letsencrypt"

# Webroot path (must match nginx.conf)
readonly WEBROOT_PATH="/var/www/certbot"

# Nginx container name (from docker-compose.yml)
readonly NGINX_CONTAINER="buhbot-nginx"

# Command-line flags
STAGING=false
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
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --staging)
                STAGING=true
                log_warning "STAGING MODE ENABLED - Using Let's Encrypt staging environment"
                shift
                ;;
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
BuhBot Let's Encrypt Certificate Acquisition Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --domain DOMAIN    Domain name for SSL certificate (required)
  --email EMAIL      Email for Let's Encrypt notifications (default: admin@example.com)
  --staging          Use Let's Encrypt staging environment (for testing)
  --dry-run          Perform a dry run without requesting certificate
  --force            Skip confirmation prompts
  -h, --help         Show this help message

Environment Variables:
  BUHBOT_DOMAIN      Domain name (alternative to --domain flag)
  BUHBOT_EMAIL       Email address (alternative to --email flag)

Examples:
  # Request certificate for domain
  $0 --domain buhbot.example.com --email admin@example.com

  # Test with staging environment first
  $0 --domain buhbot.example.com --staging

  # Dry run to verify configuration
  $0 --domain buhbot.example.com --dry-run

  # Using environment variables
  BUHBOT_DOMAIN=buhbot.example.com BUHBOT_EMAIL=admin@example.com $0

Prerequisites:
  1. DNS A record must point domain to VDS IP (185.200.177.180)
  2. Port 80 must be accessible from internet
  3. Nginx must be running with ACME challenge location configured

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

check_domain() {
    log_info "Validating domain configuration..."

    if [ -z "$DOMAIN" ]; then
        log_error "Domain name is required"
        log_error "Use --domain flag or set BUHBOT_DOMAIN environment variable"
        log_error "Example: $0 --domain buhbot.example.com"
        exit 1
    fi

    # Validate domain format (basic check)
    if ! echo "$DOMAIN" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'; then
        log_error "Invalid domain format: $DOMAIN"
        exit 1
    fi

    log_success "Domain: $DOMAIN"
}

check_email() {
    log_info "Validating email configuration..."

    if [ -z "$EMAIL" ] || [ "$EMAIL" = "admin@example.com" ]; then
        log_warning "Using default email: $EMAIL"
        log_warning "Consider providing a real email for certificate expiry notifications"
    fi

    # Validate email format (basic check)
    if ! echo "$EMAIL" | grep -qE '^[^@]+@[^@]+\.[^@]+$'; then
        log_error "Invalid email format: $EMAIL"
        exit 1
    fi

    log_success "Email: $EMAIL"
}

check_nginx_running() {
    log_info "Checking if Nginx container is running..."

    if ! docker ps --format '{{.Names}}' | grep -q "^${NGINX_CONTAINER}$"; then
        log_warning "Nginx container ($NGINX_CONTAINER) is not running"
        log_warning "ACME challenge may fail if Nginx is not serving port 80"
        log_warning "Start Nginx: cd $INFRASTRUCTURE_DIR && docker compose up -d nginx"

        if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
            read -p "Continue anyway? (y/n): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Aborted by user"
                exit 0
            fi
        fi
    else
        log_success "Nginx container is running"
    fi
}

check_port_80() {
    log_info "Checking if port 80 is accessible..."

    # Check if port 80 is open locally
    if command -v nc &> /dev/null; then
        if ! nc -z localhost 80 2>/dev/null; then
            log_warning "Port 80 does not appear to be open locally"
            log_warning "Ensure Nginx is running and port 80 is not blocked by firewall"
        else
            log_success "Port 80 is accessible locally"
        fi
    else
        log_warning "netcat (nc) not available, skipping port check"
    fi
}

check_existing_certificates() {
    log_info "Checking for existing certificates..."

    # Check if Let's Encrypt volume exists and has certificates
    if docker volume ls --format '{{.Name}}' | grep -q "^${LETSENCRYPT_VOLUME}$"; then
        local cert_exists
        cert_exists=$(docker run --rm \
            -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
            alpine sh -c "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem && echo 'yes' || echo 'no'" 2>/dev/null || echo "no")

        if [ "$cert_exists" = "yes" ]; then
            log_warning "Certificate for $DOMAIN already exists!"
            log_warning "Use certbot-renew.sh for renewal instead"

            if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
                read -p "Request new certificate anyway? This will replace existing cert. (y/n): " -r
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log_info "Aborted by user"
                    exit 0
                fi
            fi
        fi
    fi

    log_success "Certificate check completed"
}

run_preflight_checks() {
    log_info "Running pre-flight checks..."

    check_docker
    check_domain
    check_email
    check_nginx_running
    check_port_80
    check_existing_certificates

    log_success "All pre-flight checks passed"
}

# ============================================================================
# Volume Setup
# ============================================================================

setup_volumes() {
    log_info "Setting up Docker volumes..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create Docker volumes: $CERTBOT_DATA_VOLUME, $LETSENCRYPT_VOLUME"
        return 0
    fi

    # Create certbot webroot volume (for ACME challenges)
    if ! docker volume ls --format '{{.Name}}' | grep -q "^${CERTBOT_DATA_VOLUME}$"; then
        log_info "Creating certbot webroot volume: $CERTBOT_DATA_VOLUME"
        docker volume create "$CERTBOT_DATA_VOLUME" \
            --label "com.buhbot.volume=certbot-data" \
            --label "com.buhbot.description=Let's Encrypt ACME challenge files"
    else
        log_info "Certbot webroot volume already exists: $CERTBOT_DATA_VOLUME"
    fi

    # Create Let's Encrypt volume (for certificates)
    if ! docker volume ls --format '{{.Name}}' | grep -q "^${LETSENCRYPT_VOLUME}$"; then
        log_info "Creating Let's Encrypt volume: $LETSENCRYPT_VOLUME"
        docker volume create "$LETSENCRYPT_VOLUME" \
            --label "com.buhbot.volume=letsencrypt" \
            --label "com.buhbot.description=Let's Encrypt SSL certificates and config"
    else
        log_info "Let's Encrypt volume already exists: $LETSENCRYPT_VOLUME"
    fi

    log_success "Docker volumes ready"
}

# ============================================================================
# Certificate Acquisition
# ============================================================================

request_certificate() {
    log_info "Requesting SSL certificate from Let's Encrypt..."

    # Build certbot command
    local certbot_cmd="certonly --webroot"
    certbot_cmd+=" --webroot-path=$WEBROOT_PATH"
    certbot_cmd+=" --email $EMAIL"
    certbot_cmd+=" --agree-tos"
    certbot_cmd+=" --non-interactive"
    certbot_cmd+=" --rsa-key-size $RSA_KEY_SIZE"
    certbot_cmd+=" -d $DOMAIN"

    # Add www subdomain if not already a subdomain
    if [[ ! "$DOMAIN" =~ ^www\. ]] && [[ $(echo "$DOMAIN" | tr -cd '.' | wc -c) -eq 1 ]]; then
        certbot_cmd+=" -d www.$DOMAIN"
        log_info "Also requesting certificate for www.$DOMAIN"
    fi

    # Use staging environment if requested
    if [ "$STAGING" = true ]; then
        certbot_cmd+=" --staging"
        log_warning "Using Let's Encrypt STAGING environment"
        log_warning "Certificates will NOT be trusted by browsers!"
    fi

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: docker run certbot/certbot $certbot_cmd"
        log_dry_run "Volumes:"
        log_dry_run "  - ${CERTBOT_DATA_VOLUME}:${WEBROOT_PATH}"
        log_dry_run "  - ${LETSENCRYPT_VOLUME}:/etc/letsencrypt"
        return 0
    fi

    log_info "Running Certbot container..."
    log_info "Command: certbot $certbot_cmd"

    # Run Certbot in Docker container
    if docker run --rm \
        -v "${CERTBOT_DATA_VOLUME}:${WEBROOT_PATH}" \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt" \
        --name "buhbot-certbot-init" \
        "$CERTBOT_IMAGE" \
        $certbot_cmd; then
        log_success "Certificate acquisition completed"
    else
        log_error "Certificate acquisition failed"
        log_error "Check the following:"
        log_error "  1. DNS A record points $DOMAIN to VDS IP"
        log_error "  2. Port 80 is accessible from internet"
        log_error "  3. Nginx is serving ACME challenge location"
        log_error ""
        log_error "To debug, try:"
        log_error "  curl -I http://$DOMAIN/.well-known/acme-challenge/test"
        exit 1
    fi
}

# ============================================================================
# Verification
# ============================================================================

verify_certificate() {
    log_info "Verifying certificate acquisition..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would verify certificate for $DOMAIN"
        return 0
    fi

    # Check certificate files exist
    local cert_check
    cert_check=$(docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        alpine sh -c "
            if [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ] && \
               [ -f /etc/letsencrypt/live/${DOMAIN}/privkey.pem ]; then
                echo 'success'
            else
                echo 'failed'
            fi
        ")

    if [ "$cert_check" != "success" ]; then
        log_error "Certificate files not found!"
        log_error "Expected files in /etc/letsencrypt/live/${DOMAIN}/"
        exit 1
    fi

    log_success "Certificate files verified"

    # Display certificate information
    log_info "Certificate details:"
    docker run --rm \
        -v "${LETSENCRYPT_VOLUME}:/etc/letsencrypt:ro" \
        "$CERTBOT_IMAGE" \
        certificates --cert-name "$DOMAIN" 2>/dev/null || true
}

# ============================================================================
# Post-acquisition Instructions
# ============================================================================

show_next_steps() {
    log_info ""
    log_info "========================================"
    log_info "Certificate Acquisition Complete"
    log_info "========================================"
    log_info ""
    log_info "Certificate Location (in Docker volume):"
    log_info "  Volume: $LETSENCRYPT_VOLUME"
    log_info "  Path:   /etc/letsencrypt/live/$DOMAIN/"
    log_info "  Files:  fullchain.pem, privkey.pem, chain.pem, cert.pem"
    log_info ""
    log_info "Next Steps:"
    log_info ""
    log_info "1. Update docker-compose.yml to mount Let's Encrypt volume to Nginx:"
    log_info "   Add to nginx service volumes:"
    log_info "     - buhbot-letsencrypt:/etc/letsencrypt:ro"
    log_info ""
    log_info "2. Update nginx.conf to enable HTTPS server block:"
    log_info "   See: infrastructure/nginx/nginx.conf (HTTPS section)"
    log_info ""
    log_info "3. Restart Nginx to apply changes:"
    log_info "   cd $INFRASTRUCTURE_DIR && docker compose restart nginx"
    log_info ""
    log_info "4. Set up automatic renewal:"
    log_info "   ./certbot-renew.sh --setup-cron"
    log_info ""

    if [ "$STAGING" = true ]; then
        log_warning "========================================"
        log_warning "STAGING CERTIFICATES"
        log_warning "========================================"
        log_warning "You used staging environment for testing."
        log_warning "These certificates are NOT trusted by browsers!"
        log_warning ""
        log_warning "To get production certificates, run:"
        log_warning "  $0 --domain $DOMAIN --email $EMAIL --force"
        log_warning "========================================"
    fi

    log_info ""
    log_success "SSL certificate setup complete!"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "========================================"
    log_info "BuhBot Let's Encrypt Certificate Init v$SCRIPT_VERSION"
    log_info "========================================"
    log_info ""

    # Parse command-line arguments
    parse_arguments "$@"

    # Run pre-flight checks
    run_preflight_checks

    # Confirmation prompt
    if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
        log_info ""
        log_info "Configuration Summary:"
        log_info "  Domain:      $DOMAIN"
        log_info "  Email:       $EMAIL"
        log_info "  Environment: $([ "$STAGING" = true ] && echo 'STAGING' || echo 'PRODUCTION')"
        log_info "  RSA Key:     $RSA_KEY_SIZE bits"
        log_info ""
        read -p "Proceed with certificate request? (y/n): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Aborted by user"
            exit 0
        fi
    fi

    # Setup volumes
    setup_volumes

    # Request certificate
    request_certificate

    # Verify certificate
    verify_certificate

    # Show next steps
    show_next_steps
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

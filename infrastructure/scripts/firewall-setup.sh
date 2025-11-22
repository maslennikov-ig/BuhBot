#!/usr/bin/env bash

# ============================================================================
# BuhBot Firewall Setup Script
# ============================================================================
# Purpose: Configure UFW firewall with secure defaults for BuhBot infrastructure
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Check and install UFW if missing
# 2. Backup existing firewall rules
# 3. Configure default deny/allow policies
# 4. Open required ports (SSH, HTTP, HTTPS, Grafana, Prometheus)
# 5. Verify configuration before enabling
# 6. Enable firewall with confirmation
#
# Required Ports:
# - 22/tcp   : SSH access
# - 80/tcp   : HTTP (Let's Encrypt, redirects to HTTPS)
# - 443/tcp  : HTTPS (main traffic)
# - 3002/tcp : Grafana monitoring dashboard
# - 9090/tcp : Prometheus metrics (internal)
#
# Requirements:
# - Ubuntu 22.04 LTS or Debian-based system
# - Root privileges (or sudo)
# - Internet connection (for UFW installation if missing)
#
# Usage:
#   sudo ./firewall-setup.sh [OPTIONS]
#
# Options:
#   --dry-run     Show what would be done without making changes
#   --force       Skip confirmation prompts (non-interactive mode)
#   --no-enable   Configure rules but don't enable firewall
#   --help        Show this help message
#
# Recovery:
#   If firewall blocks your SSH connection:
#   1. Access VDS via cloud provider console (VNC/Serial)
#   2. Run: sudo ufw disable
#   3. Run: sudo ufw reset
#   4. Reconfigure with: sudo ./firewall-setup.sh
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/buhbot-firewall-$(date +%Y%m%d-%H%M%S).log"
readonly BACKUP_DIR="/var/backups/ufw"

# Ports to open
declare -A FIREWALL_RULES=(
    ["22/tcp"]="SSH access"
    ["80/tcp"]="HTTP (Let's Encrypt)"
    ["443/tcp"]="HTTPS (main traffic)"
    ["3002/tcp"]="Grafana monitoring"
    ["9090/tcp"]="Prometheus metrics"
)

# Script options
DRY_RUN=false
FORCE_MODE=false
NO_ENABLE=false

# Color codes for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_RESET='\033[0m'

# ============================================================================
# Logging Functions
# ============================================================================

setup_logging() {
    # Only redirect to log file if not dry run and we have write access
    if [ "$DRY_RUN" = false ] && [ -w "/var/log" ]; then
        exec 1> >(tee -a "$LOG_FILE")
        exec 2>&1
    fi
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
    echo -e "${COLOR_CYAN}[DRY-RUN]${COLOR_RESET} $*"
}

# ============================================================================
# Help and Usage
# ============================================================================

show_help() {
    cat << EOF
BuhBot Firewall Setup Script v${SCRIPT_VERSION}

Usage: sudo $SCRIPT_NAME [OPTIONS]

Options:
  --dry-run     Show what would be done without making changes
  --force       Skip confirmation prompts (non-interactive mode)
  --no-enable   Configure rules but don't enable firewall
  --help        Show this help message

Ports that will be opened:
  22/tcp    SSH access
  80/tcp    HTTP (for Let's Encrypt certificate renewal)
  443/tcp   HTTPS (main application traffic)
  3002/tcp  Grafana monitoring dashboard
  9090/tcp  Prometheus metrics endpoint

Examples:
  # Preview changes without applying
  sudo $SCRIPT_NAME --dry-run

  # Apply changes with confirmation prompts
  sudo $SCRIPT_NAME

  # Apply changes without prompts (CI/CD)
  sudo $SCRIPT_NAME --force

  # Configure rules only, enable manually later
  sudo $SCRIPT_NAME --no-enable

Recovery (if locked out):
  1. Access VDS via cloud provider console (VNC/Serial)
  2. Run: sudo ufw disable
  3. Run: sudo ufw reset
  4. Reconfigure with: sudo $SCRIPT_NAME

EOF
    exit 0
}

# ============================================================================
# Error Handling
# ============================================================================

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Firewall setup failed with exit code $exit_code"
        if [ "$DRY_RUN" = false ]; then
            log_error "Check log file: $LOG_FILE"
            log_warning ""
            log_warning "RECOVERY: If you're locked out:"
            log_warning "  1. Access VDS via cloud provider console"
            log_warning "  2. Run: sudo ufw disable"
            log_warning "  3. Run: sudo ufw reset"
        fi
    fi
}

trap cleanup EXIT

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE_MODE=true
                shift
                ;;
            --no-enable)
                NO_ENABLE=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                log_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root"
        log_error "Usage: sudo $SCRIPT_NAME [OPTIONS]"
        exit 1
    fi
    log_success "Root privileges confirmed"
}

check_os() {
    if [ ! -f /etc/os-release ]; then
        log_error "Cannot determine OS version"
        exit 1
    fi

    # shellcheck source=/dev/null
    source /etc/os-release
    if [[ ! "$ID" =~ ^(ubuntu|debian)$ ]]; then
        log_warning "This script is designed for Ubuntu/Debian. Current OS: $ID"
        if [ "$FORCE_MODE" = false ]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
    log_success "OS check passed: $ID ${VERSION_ID:-}"
}

# ============================================================================
# UFW Installation
# ============================================================================

check_ufw_installed() {
    if command -v ufw &> /dev/null; then
        log_success "UFW is installed: $(ufw --version 2>/dev/null || echo 'version unknown')"
        return 0
    else
        return 1
    fi
}

install_ufw() {
    log_info "UFW is not installed. Installing..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: apt-get update && apt-get install -y ufw"
        return 0
    fi

    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw

    if check_ufw_installed; then
        log_success "UFW installed successfully"
    else
        log_error "Failed to install UFW"
        exit 1
    fi
}

# ============================================================================
# Backup Functions
# ============================================================================

backup_rules() {
    log_info "Backing up existing firewall rules..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create backup directory: $BACKUP_DIR"
        log_dry_run "Would backup UFW rules to: $BACKUP_DIR/ufw-backup-$(date +%Y%m%d-%H%M%S).rules"
        return 0
    fi

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    local backup_file="${BACKUP_DIR}/ufw-backup-$(date +%Y%m%d-%H%M%S).rules"

    # Check if UFW has any rules to backup
    if ufw status verbose &> /dev/null; then
        ufw status verbose > "$backup_file"

        # Also backup UFW configuration files
        if [ -f /etc/ufw/user.rules ]; then
            cp /etc/ufw/user.rules "${backup_file}.user.rules"
        fi
        if [ -f /etc/ufw/user6.rules ]; then
            cp /etc/ufw/user6.rules "${backup_file}.user6.rules"
        fi

        log_success "Firewall rules backed up to: $backup_file"
    else
        log_info "No existing UFW rules to backup"
    fi
}

# ============================================================================
# Firewall Configuration
# ============================================================================

show_current_status() {
    log_info "Current UFW status:"
    echo ""
    if ufw status verbose 2>/dev/null; then
        echo ""
    else
        log_info "UFW is not configured or inactive"
        echo ""
    fi
}

show_proposed_changes() {
    log_info "Proposed firewall configuration:"
    echo ""
    echo "  Default policies:"
    echo "    - Incoming: DENY"
    echo "    - Outgoing: ALLOW"
    echo ""
    echo "  Ports to be opened:"
    for port in "${!FIREWALL_RULES[@]}"; do
        printf "    - %-12s : %s\n" "$port" "${FIREWALL_RULES[$port]}"
    done
    echo ""
}

configure_defaults() {
    log_info "Configuring default policies..."

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: ufw default deny incoming"
        log_dry_run "Would run: ufw default allow outgoing"
        return 0
    fi

    ufw default deny incoming
    ufw default allow outgoing

    log_success "Default policies configured (deny incoming, allow outgoing)"
}

configure_rules() {
    log_info "Configuring firewall rules..."

    for port in "${!FIREWALL_RULES[@]}"; do
        local comment="${FIREWALL_RULES[$port]}"

        if [ "$DRY_RUN" = true ]; then
            log_dry_run "Would run: ufw allow $port comment '$comment'"
        else
            # Check if rule already exists
            if ufw status | grep -q "$port"; then
                log_info "Rule for $port already exists, skipping..."
            else
                ufw allow "$port" comment "$comment"
                log_success "Added rule: $port ($comment)"
            fi
        fi
    done

    if [ "$DRY_RUN" = false ]; then
        log_success "All firewall rules configured"
    fi
}

verify_rules() {
    log_info "Verifying firewall rules..."

    local missing_rules=0

    for port in "${!FIREWALL_RULES[@]}"; do
        # Extract just the port number for checking
        local port_num="${port%/*}"

        if [ "$DRY_RUN" = true ]; then
            log_dry_run "Would verify rule for port $port"
        else
            if ufw status | grep -qE "^$port_num"; then
                log_success "Verified: $port"
            else
                log_error "Missing rule: $port"
                ((missing_rules++))
            fi
        fi
    done

    if [ "$DRY_RUN" = false ] && [ $missing_rules -gt 0 ]; then
        log_error "Verification failed: $missing_rules rule(s) missing"
        return 1
    fi

    if [ "$DRY_RUN" = false ]; then
        log_success "All rules verified successfully"
    fi
    return 0
}

enable_firewall() {
    if [ "$NO_ENABLE" = true ]; then
        log_warning "Skipping firewall enable (--no-enable specified)"
        log_info "Enable manually with: sudo ufw enable"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would run: ufw --force enable"
        return 0
    fi

    # Check if already enabled
    if ufw status | grep -q "Status: active"; then
        log_info "UFW is already enabled"
        return 0
    fi

    # Confirm before enabling
    if [ "$FORCE_MODE" = false ]; then
        log_warning ""
        log_warning "=================================================="
        log_warning "IMPORTANT: You are about to enable the firewall!"
        log_warning "=================================================="
        log_warning ""
        log_warning "Make sure SSH (port 22) is in the allowed list."
        log_warning "If you get locked out:"
        log_warning "  1. Access VDS via cloud provider console"
        log_warning "  2. Run: sudo ufw disable"
        log_warning ""

        read -p "Enable firewall now? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Firewall not enabled (rules are configured but inactive)"
            log_info "Enable manually with: sudo ufw enable"
            return 0
        fi
    fi

    ufw --force enable
    log_success "Firewall enabled successfully"
}

show_final_status() {
    log_info "Final firewall status:"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would show: ufw status verbose"
        echo ""
        log_info "Dry run summary:"
        echo "  - Default incoming: DENY"
        echo "  - Default outgoing: ALLOW"
        echo "  - Rules configured for ${#FIREWALL_RULES[@]} ports"
        echo ""
    else
        ufw status verbose
        echo ""
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse command line arguments
    parse_arguments "$@"

    # Setup logging (unless dry run)
    setup_logging

    log_info "========================================"
    log_info "BuhBot Firewall Setup Script v$SCRIPT_VERSION"
    log_info "========================================"

    if [ "$DRY_RUN" = true ]; then
        log_info "Mode: DRY RUN (no changes will be made)"
    else
        log_info "Log file: $LOG_FILE"
    fi

    if [ "$FORCE_MODE" = true ]; then
        log_info "Mode: FORCE (no prompts)"
    fi

    log_info ""

    # Pre-flight checks
    check_root
    check_os

    # Show current status
    show_current_status

    # Install UFW if needed
    if ! check_ufw_installed; then
        install_ufw
    fi

    # Backup existing rules
    backup_rules

    # Show proposed changes
    show_proposed_changes

    # Confirm changes (unless force mode or dry run)
    if [ "$FORCE_MODE" = false ] && [ "$DRY_RUN" = false ]; then
        read -p "Apply these firewall rules? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Aborted by user"
            exit 0
        fi
    fi

    # Configure firewall
    configure_defaults
    configure_rules

    # Verify rules before enabling
    verify_rules

    # Enable firewall
    enable_firewall

    # Show final status
    show_final_status

    log_info ""
    log_success "========================================"
    log_success "Firewall setup completed successfully!"
    log_success "========================================"
    log_info ""

    if [ "$DRY_RUN" = true ]; then
        log_info "This was a DRY RUN. No changes were made."
        log_info "Run without --dry-run to apply changes."
    else
        log_info "Backup location: $BACKUP_DIR"
        log_info "Log file: $LOG_FILE"
        log_info ""
        log_info "Recovery instructions (if locked out):"
        log_info "  1. Access VDS via cloud provider console (VNC/Serial)"
        log_info "  2. Run: sudo ufw disable"
        log_info "  3. Run: sudo ufw reset"
        log_info "  4. Reconfigure with: sudo $SCRIPT_NAME"
    fi
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

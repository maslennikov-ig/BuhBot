#!/usr/bin/env bash

# ============================================================================
# BuhBot VDS Bootstrap Script
# ============================================================================
# Purpose: Initial VDS setup - install Docker, configure firewall, create user
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script performs the following tasks:
# 1. Update system packages
# 2. Install Docker CE and Docker Compose
# 3. Configure UFW firewall (ports 22, 80, 443)
# 4. Create buhbot system user with Docker access
# 5. Setup SSH key authentication
# 6. Harden SSH security (disable root login)
# 7. Verify installation
#
# Requirements:
# - Ubuntu 22.04 LTS
# - Root privileges
# - Internet connection
#
# Usage:
#   sudo ./bootstrap-vds.sh
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly BUHBOT_USER="buhbot"
readonly BUHBOT_HOME="/home/${BUHBOT_USER}"
readonly APP_DIR="${BUHBOT_HOME}/BuhBot"
readonly LOG_FILE="/var/log/buhbot-bootstrap-$(date +%Y%m%d-%H%M%S).log"

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

# ============================================================================
# Error Handling
# ============================================================================

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Bootstrap failed with exit code $exit_code"
        log_error "Check log file: $LOG_FILE"
    fi
}

trap cleanup EXIT

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root"
        log_error "Usage: sudo $0"
        exit 1
    fi
    log_success "Root privileges confirmed"
}

check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        log_error "Cannot determine OS version"
        exit 1
    fi

    source /etc/os-release
    if [[ ! "$ID" =~ ^(ubuntu|debian)$ ]]; then
        log_warning "This script is designed for Ubuntu/Debian. Current OS: $ID"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    log_success "OS check passed: $ID $VERSION_ID"
}

# ============================================================================
# System Update
# ============================================================================

update_system() {
    log_info "Updating system packages..."

    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        software-properties-common \
        ufw \
        fail2ban

    log_success "System packages updated"
}

# ============================================================================
# Docker Installation
# ============================================================================

install_docker() {
    log_info "Installing Docker..."

    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        local docker_version
        docker_version=$(docker --version)
        log_warning "Docker is already installed: $docker_version"
        read -p "Reinstall Docker? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping Docker installation"
            return 0
        fi

        log_info "Removing old Docker versions..."
        apt-get remove -y docker docker-engine docker.io containerd runc || true
    fi

    # Add Docker's official GPG key
    log_info "Adding Docker GPG key..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    log_info "Adding Docker repository..."
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    log_info "Installing Docker Engine..."
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    # Start and enable Docker service
    systemctl start docker
    systemctl enable docker

    log_success "Docker installed successfully: $(docker --version)"
}

verify_docker() {
    log_info "Verifying Docker installation..."

    if ! docker run --rm hello-world &> /dev/null; then
        log_error "Docker verification failed"
        exit 1
    fi

    log_success "Docker verification passed"
}

# ============================================================================
# Firewall Configuration
# ============================================================================

configure_firewall() {
    log_info "Configuring UFW firewall..."

    # Reset UFW to default (if needed)
    if ufw status | grep -q "Status: active"; then
        log_warning "UFW is already active"
        read -p "Reset firewall rules? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ufw --force reset
        fi
    fi

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (port 22)
    ufw allow 22/tcp comment 'SSH'

    # Allow HTTP (port 80)
    ufw allow 80/tcp comment 'HTTP'

    # Allow HTTPS (port 443)
    ufw allow 443/tcp comment 'HTTPS'

    # Enable UFW
    ufw --force enable

    log_success "Firewall configured successfully"
    ufw status verbose
}

# ============================================================================
# User Management
# ============================================================================

create_buhbot_user() {
    log_info "Creating buhbot user..."

    # Check if user already exists
    if id "$BUHBOT_USER" &>/dev/null; then
        log_warning "User $BUHBOT_USER already exists"
        return 0
    fi

    # Create system user with home directory
    useradd -m -s /bin/bash -c "BuhBot Application User" "$BUHBOT_USER"

    # Add to docker group
    usermod -aG docker "$BUHBOT_USER"

    # Create application directory
    mkdir -p "$APP_DIR"
    chown -R "${BUHBOT_USER}:${BUHBOT_USER}" "$BUHBOT_HOME"

    log_success "User $BUHBOT_USER created successfully"
}

setup_ssh_keys() {
    log_info "Setting up SSH key authentication for $BUHBOT_USER..."

    local ssh_dir="${BUHBOT_HOME}/.ssh"
    local authorized_keys="${ssh_dir}/authorized_keys"

    # Create .ssh directory
    mkdir -p "$ssh_dir"
    chmod 700 "$ssh_dir"

    # Copy SSH keys from current user (if running via sudo)
    if [ -n "${SUDO_USER:-}" ]; then
        local sudo_ssh_dir="/home/${SUDO_USER}/.ssh"
        if [ -f "${sudo_ssh_dir}/authorized_keys" ]; then
            cp "${sudo_ssh_dir}/authorized_keys" "$authorized_keys"
            log_success "Copied SSH keys from $SUDO_USER"
        else
            log_warning "No authorized_keys found for $SUDO_USER"
            log_info "You will need to manually add SSH keys to $authorized_keys"
        fi
    else
        log_warning "Not running via sudo, skipping SSH key copy"
        log_info "You will need to manually add SSH keys to $authorized_keys"
    fi

    # Set correct permissions
    if [ -f "$authorized_keys" ]; then
        chmod 600 "$authorized_keys"
    fi
    chown -R "${BUHBOT_USER}:${BUHBOT_USER}" "$ssh_dir"

    log_success "SSH key setup complete"
}

# ============================================================================
# SSH Hardening
# ============================================================================

harden_ssh() {
    log_info "Hardening SSH configuration..."

    local sshd_config="/etc/ssh/sshd_config"
    local backup_config="${sshd_config}.backup-$(date +%Y%m%d-%H%M%S)"

    # Backup current config
    cp "$sshd_config" "$backup_config"
    log_info "SSH config backed up to $backup_config"

    # Disable root login
    if grep -q "^PermitRootLogin" "$sshd_config"; then
        sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' "$sshd_config"
    else
        echo "PermitRootLogin no" >> "$sshd_config"
    fi

    # Disable password authentication
    if grep -q "^PasswordAuthentication" "$sshd_config"; then
        sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "$sshd_config"
    else
        echo "PasswordAuthentication no" >> "$sshd_config"
    fi

    # Enable public key authentication
    if grep -q "^PubkeyAuthentication" "$sshd_config"; then
        sed -i 's/^PubkeyAuthentication.*/PubkeyAuthentication yes/' "$sshd_config"
    else
        echo "PubkeyAuthentication yes" >> "$sshd_config"
    fi

    # Restart SSH service
    log_info "Restarting SSH service..."
    systemctl restart sshd

    log_success "SSH hardening complete"
    log_warning "Root login is now DISABLED. Ensure you can login as $BUHBOT_USER before closing this session!"
}

# ============================================================================
# Security Configuration
# ============================================================================

configure_fail2ban() {
    log_info "Configuring fail2ban..."

    # Enable and start fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban

    log_success "fail2ban configured and started"
}

# ============================================================================
# Final Verification
# ============================================================================

verify_installation() {
    log_info "Verifying installation..."

    local errors=0

    # Check Docker
    if ! docker --version &> /dev/null; then
        log_error "Docker verification failed"
        ((errors++))
    else
        log_success "Docker: $(docker --version)"
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose verification failed"
        ((errors++))
    else
        log_success "Docker Compose: $(docker compose version)"
    fi

    # Check firewall
    if ! ufw status | grep -q "Status: active"; then
        log_error "UFW firewall is not active"
        ((errors++))
    else
        log_success "Firewall: Active"
    fi

    # Check buhbot user
    if ! id "$BUHBOT_USER" &>/dev/null; then
        log_error "User $BUHBOT_USER not found"
        ((errors++))
    else
        log_success "User: $BUHBOT_USER exists"
    fi

    # Check buhbot in docker group
    if ! groups "$BUHBOT_USER" | grep -q docker; then
        log_error "User $BUHBOT_USER not in docker group"
        ((errors++))
    else
        log_success "User: $BUHBOT_USER in docker group"
    fi

    # Check application directory
    if [ ! -d "$APP_DIR" ]; then
        log_error "Application directory $APP_DIR not found"
        ((errors++))
    else
        log_success "Application directory: $APP_DIR exists"
    fi

    if [ $errors -gt 0 ]; then
        log_error "Verification failed with $errors error(s)"
        return 1
    fi

    log_success "All verification checks passed"
    return 0
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "========================================"
    log_info "BuhBot VDS Bootstrap Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info "Log file: $LOG_FILE"
    log_info ""

    # Pre-flight checks
    check_root
    check_ubuntu

    # System setup
    update_system

    # Install Docker
    install_docker
    verify_docker

    # Configure firewall
    configure_firewall

    # Create user and setup access
    create_buhbot_user
    setup_ssh_keys

    # Security hardening
    harden_ssh
    configure_fail2ban

    # Final verification
    verify_installation

    log_info ""
    log_success "========================================"
    log_success "Bootstrap completed successfully!"
    log_success "========================================"
    log_info ""
    log_info "Next steps:"
    log_info "1. Test SSH access as $BUHBOT_USER BEFORE closing this session"
    log_info "2. Clone BuhBot repository to $APP_DIR"
    log_info "3. Configure environment variables (.env files)"
    log_info "4. Run deployment script: ./infrastructure/scripts/deploy.sh"
    log_info ""
    log_info "Application directory: $APP_DIR"
    log_info "Log file: $LOG_FILE"
    log_info ""
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

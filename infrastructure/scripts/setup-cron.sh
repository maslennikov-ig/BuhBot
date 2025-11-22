#!/usr/bin/env bash

# ============================================================================
# BuhBot Cron Job Setup Script
# ============================================================================
# Purpose: Configure automated backup and maintenance cron jobs
# Author: BuhBot Infrastructure Team
# Version: 1.0.0
# ============================================================================
#
# This script configures the following cron jobs:
# 1. VDS backup - Weekly on Sunday at 3:00 AM Moscow time
# 2. Supabase backup - Daily at 4:00 AM Moscow time
# 3. Backup verification - Daily at 6:00 AM Moscow time
# 4. Log rotation - Weekly on Monday at 2:00 AM
# 5. Docker cleanup - Weekly on Saturday at 5:00 AM
#
# Requirements:
# - Root privileges or user with crontab access
# - Backup scripts available in /home/me/code/bobabuh/infrastructure/scripts/
#
# Usage:
#   ./setup-cron.sh               # Setup cron jobs for current user
#   sudo ./setup-cron.sh          # Setup cron jobs for root
#   ./setup-cron.sh --remove      # Remove BuhBot cron jobs
#   ./setup-cron.sh --list        # Show current BuhBot cron jobs
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

readonly LOG_DIR="/var/log"
readonly CRON_MARKER="# BUHBOT_CRON"

# Moscow timezone offset (UTC+3)
# Cron jobs are scheduled in server time
# Adjust these if your server is not in Moscow timezone
# Sunday 3:00 AM Moscow = Sunday 00:00 UTC (if server is UTC)
# For Moscow timezone server, use local times directly

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

# ============================================================================
# Argument Parsing
# ============================================================================

ACTION="setup"

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --remove)
                ACTION="remove"
                shift
                ;;
            --list)
                ACTION="list"
                shift
                ;;
            --dry-run)
                ACTION="dry-run"
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
BuhBot Cron Job Setup Script v$SCRIPT_VERSION

Usage: $0 [OPTIONS]

Options:
  --remove      Remove all BuhBot cron jobs
  --list        List current BuhBot cron jobs
  --dry-run     Show what would be configured without making changes
  -h, --help    Show this help message

Cron Jobs Configured:
  - VDS backup:       Weekly on Sunday at 3:00 AM (Moscow time)
  - Supabase backup:  Daily at 4:00 AM (Moscow time)
  - Backup verify:    Daily at 6:00 AM (Moscow time)
  - Log rotation:     Weekly on Monday at 2:00 AM
  - Docker cleanup:   Weekly on Saturday at 5:00 AM

Log Files:
  - VDS backup:       $LOG_DIR/buhbot-backup.log
  - Supabase backup:  $LOG_DIR/buhbot-supabase-backup.log
  - Backup verify:    $LOG_DIR/buhbot-backup-verify.log

Examples:
  $0                  # Setup cron jobs
  $0 --list           # Show current cron jobs
  $0 --remove         # Remove cron jobs
  sudo $0             # Setup for root user

EOF
}

# ============================================================================
# Validation
# ============================================================================

check_scripts_exist() {
    log_info "Checking backup scripts..."

    local scripts=(
        "$SCRIPT_DIR/backup.sh"
        "$SCRIPT_DIR/supabase-backup.sh"
        "$SCRIPT_DIR/verify-backup.sh"
    )

    local missing=0

    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            log_success "Found: $(basename "$script")"
        else
            log_error "Missing: $script"
            ((missing++))
        fi
    done

    if [ $missing -gt 0 ]; then
        log_error "$missing script(s) missing. Please create them first."
        exit 1
    fi

    # Check execute permissions
    for script in "${scripts[@]}"; do
        if [ -f "$script" ] && [ ! -x "$script" ]; then
            log_warning "Script not executable: $(basename "$script")"
            log_info "Adding execute permission..."
            chmod +x "$script"
        fi
    done
}

check_log_directory() {
    log_info "Checking log directory..."

    if [ ! -d "$LOG_DIR" ]; then
        log_error "Log directory does not exist: $LOG_DIR"
        exit 1
    fi

    if [ ! -w "$LOG_DIR" ]; then
        log_warning "Log directory not writable by current user"
        log_info "Cron jobs may fail to write logs"
    fi

    log_success "Log directory: $LOG_DIR"
}

# ============================================================================
# Cron Job Management
# ============================================================================

get_cron_jobs() {
    # Define cron jobs
    # Format: "schedule command description"
    cat << EOF
# BuhBot Automated Backup and Maintenance Jobs
# Configured by setup-cron.sh v$SCRIPT_VERSION
# ============================================

# VDS Backup - Weekly on Sunday at 3:00 AM Moscow time
# Backs up Docker volumes and configuration files
0 3 * * 0 $SCRIPT_DIR/backup.sh >> $LOG_DIR/buhbot-backup.log 2>&1 $CRON_MARKER

# Supabase Backup - Daily at 4:00 AM Moscow time
# Backs up PostgreSQL database via pg_dump
0 4 * * * $SCRIPT_DIR/supabase-backup.sh >> $LOG_DIR/buhbot-supabase-backup.log 2>&1 $CRON_MARKER

# Backup Verification - Daily at 6:00 AM Moscow time
# Verifies backup integrity and reports issues
0 6 * * * $SCRIPT_DIR/verify-backup.sh >> $LOG_DIR/buhbot-backup-verify.log 2>&1 $CRON_MARKER

# Log Rotation - Weekly on Monday at 2:00 AM
# Compresses and rotates old log files
0 2 * * 1 find $LOG_DIR -name 'buhbot-*.log' -mtime +7 -exec gzip {} \; $CRON_MARKER

# Old Log Cleanup - Weekly on Monday at 2:30 AM
# Removes logs older than 90 days
30 2 * * 1 find $LOG_DIR -name 'buhbot-*.log.gz' -mtime +90 -delete $CRON_MARKER

# Docker Cleanup - Weekly on Saturday at 5:00 AM
# Removes unused Docker images and containers
0 5 * * 6 docker system prune -f --filter "until=168h" >> $LOG_DIR/buhbot-docker-cleanup.log 2>&1 $CRON_MARKER
EOF
}

list_cron_jobs() {
    log_info "Current BuhBot cron jobs:"
    echo ""

    local current_cron
    current_cron=$(crontab -l 2>/dev/null || echo "")

    if echo "$current_cron" | grep -q "$CRON_MARKER"; then
        echo "$current_cron" | grep -E "(^#.*BUHBOT|$CRON_MARKER)" | while read -r line; do
            if [[ "$line" == \#* ]]; then
                echo -e "${COLOR_BLUE}$line${COLOR_RESET}"
            else
                echo "  $line"
            fi
        done
    else
        log_warning "No BuhBot cron jobs found"
    fi
    echo ""
}

setup_cron_jobs() {
    log_info "Setting up BuhBot cron jobs..."

    # Get current crontab (without BuhBot entries)
    local current_cron
    current_cron=$(crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | grep -v "# BuhBot" | grep -v "# Configured by setup-cron.sh" | grep -v "^# ====" || echo "")

    # Create new crontab
    local new_cron
    new_cron=$(echo "$current_cron"; echo ""; get_cron_jobs)

    if [ "$ACTION" = "dry-run" ]; then
        log_info "DRY RUN - Would configure the following cron jobs:"
        echo ""
        get_cron_jobs
        echo ""
        return 0
    fi

    # Install new crontab
    echo "$new_cron" | crontab -

    log_success "Cron jobs configured successfully"

    # Show what was configured
    echo ""
    log_info "Configured cron jobs:"
    list_cron_jobs
}

remove_cron_jobs() {
    log_info "Removing BuhBot cron jobs..."

    # Get current crontab without BuhBot entries
    local current_cron
    current_cron=$(crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | grep -v "# BuhBot" | grep -v "# Configured by setup-cron.sh" | grep -v "^# ====" || echo "")

    if [ "$ACTION" = "dry-run" ]; then
        log_info "DRY RUN - Would remove BuhBot cron jobs"
        return 0
    fi

    # Install cleaned crontab
    if [ -n "$current_cron" ]; then
        echo "$current_cron" | crontab -
    else
        crontab -r 2>/dev/null || true
    fi

    log_success "BuhBot cron jobs removed"
}

# ============================================================================
# Summary
# ============================================================================

show_summary() {
    log_info ""
    log_info "========================================"
    log_info "Cron Setup Summary"
    log_info "========================================"
    log_info ""
    log_info "Scheduled Tasks:"
    log_info "  - VDS Backup:       Sunday 3:00 AM"
    log_info "  - Supabase Backup:  Daily 4:00 AM"
    log_info "  - Backup Verify:    Daily 6:00 AM"
    log_info "  - Log Rotation:     Monday 2:00 AM"
    log_info "  - Docker Cleanup:   Saturday 5:00 AM"
    log_info ""
    log_info "Log Files:"
    log_info "  - $LOG_DIR/buhbot-backup.log"
    log_info "  - $LOG_DIR/buhbot-supabase-backup.log"
    log_info "  - $LOG_DIR/buhbot-backup-verify.log"
    log_info "  - $LOG_DIR/buhbot-docker-cleanup.log"
    log_info ""
    log_info "Commands:"
    log_info "  View cron jobs:    crontab -l"
    log_info "  View VDS backup log:    tail -f $LOG_DIR/buhbot-backup.log"
    log_info "  View Supabase backup log: tail -f $LOG_DIR/buhbot-supabase-backup.log"
    log_info "========================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "========================================"
    log_info "BuhBot Cron Job Setup Script v$SCRIPT_VERSION"
    log_info "========================================"
    log_info ""

    # Parse arguments
    parse_arguments "$@"

    case "$ACTION" in
        "list")
            list_cron_jobs
            ;;
        "remove")
            remove_cron_jobs
            ;;
        "setup"|"dry-run")
            check_scripts_exist
            check_log_directory
            setup_cron_jobs

            if [ "$ACTION" = "setup" ]; then
                show_summary
            fi
            ;;
    esac

    log_info ""
    log_success "Done!"
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

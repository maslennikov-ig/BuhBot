#!/usr/bin/env bash

# ============================================================================
# BuhBot Deployment Notification Script
# ============================================================================
# Purpose: Send deployment status notifications to Telegram
# Version: 1.0.0
#
# This script sends formatted notifications to a Telegram chat about
# deployment events including success, failure, and rollback operations.
#
# Usage:
#   ./notify-deployment.sh --status <success|failed|rollback> \
#                          --version <version> \
#                          --commit <sha> \
#                          [--message <custom_message>]
#
# Environment variables:
#   TELEGRAM_BOT_TOKEN   - Telegram bot API token (required)
#   TELEGRAM_CHAT_ID     - Target chat ID for notifications (required)
#
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# ============================================================================
# Configuration
# ============================================================================

readonly SCRIPT_VERSION="1.0.0"
readonly TELEGRAM_API_URL="https://api.telegram.org"

# Command-line arguments
STATUS=""
VERSION=""
COMMIT=""
CUSTOM_MESSAGE=""
ENVIRONMENT="production"
ACTOR="${GITHUB_ACTOR:-system}"
WORKFLOW_URL=""

# ============================================================================
# Logging Functions
# ============================================================================

log_info() {
    echo "[INFO] $*"
}

log_error() {
    echo "[ERROR] $*" >&2
}

log_success() {
    echo "[SUCCESS] $*"
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --status)
                STATUS="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --commit)
                COMMIT="$2"
                shift 2
                ;;
            --message)
                CUSTOM_MESSAGE="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --actor)
                ACTOR="$2"
                shift 2
                ;;
            --workflow-url)
                WORKFLOW_URL="$2"
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

    # Validate required arguments
    if [ -z "$STATUS" ]; then
        log_error "Missing required argument: --status"
        exit 1
    fi

    if [ -z "$VERSION" ]; then
        VERSION="unknown"
    fi

    if [ -z "$COMMIT" ]; then
        COMMIT="unknown"
    fi
}

show_help() {
    cat << EOF
BuhBot Deployment Notification Script v$SCRIPT_VERSION

Usage:
  $0 --status <status> [options]

Required:
  --status <status>     Deployment status: success, failed, rollback, started

Options:
  --version <version>   Deployed version string
  --commit <sha>        Git commit SHA
  --message <msg>       Custom message to include
  --environment <env>   Target environment (default: production)
  --actor <name>        Who triggered the deployment
  --workflow-url <url>  URL to GitHub Actions workflow run
  -h, --help            Show this help

Environment Variables:
  TELEGRAM_BOT_TOKEN    Telegram bot API token (required)
  TELEGRAM_CHAT_ID      Target chat ID (required)

Examples:
  $0 --status success --version 1.0.0 --commit abc1234
  $0 --status failed --commit abc1234 --message "Build failed"
  $0 --status rollback --version 0.9.0

EOF
}

# ============================================================================
# Validation
# ============================================================================

validate_environment() {
    if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
        log_error "TELEGRAM_BOT_TOKEN environment variable is not set"
        exit 1
    fi

    if [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        log_error "TELEGRAM_CHAT_ID environment variable is not set"
        exit 1
    fi

    # Validate status value
    case "$STATUS" in
        success|failed|rollback|started)
            ;;
        *)
            log_error "Invalid status: $STATUS (must be: success, failed, rollback, started)"
            exit 1
            ;;
    esac
}

# ============================================================================
# Message Formatting
# ============================================================================

format_status_emoji() {
    case "$STATUS" in
        success)
            echo "<b>[OK]</b>"
            ;;
        failed)
            echo "<b>[FAIL]</b>"
            ;;
        rollback)
            echo "<b>[ROLLBACK]</b>"
            ;;
        started)
            echo "<b>[DEPLOY]</b>"
            ;;
        *)
            echo "<b>[INFO]</b>"
            ;;
    esac
}

format_status_text() {
    case "$STATUS" in
        success)
            echo "Deployment Successful"
            ;;
        failed)
            echo "Deployment Failed"
            ;;
        rollback)
            echo "Rollback Executed"
            ;;
        started)
            echo "Deployment Started"
            ;;
        *)
            echo "Deployment Update"
            ;;
    esac
}

build_message() {
    local emoji
    local status_text
    local timestamp
    local commit_short

    emoji=$(format_status_emoji)
    status_text=$(format_status_text)
    timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
    commit_short="${COMMIT:0:7}"

    local message="${emoji} BuhBot ${status_text}

<b>Environment:</b> ${ENVIRONMENT}
<b>Version:</b> ${VERSION}
<b>Commit:</b> <code>${commit_short}</code>
<b>Deployed by:</b> ${ACTOR}
<b>Time:</b> ${timestamp}"

    # Add custom message if provided
    if [ -n "$CUSTOM_MESSAGE" ]; then
        message="${message}

<b>Details:</b>
${CUSTOM_MESSAGE}"
    fi

    # Add workflow URL if provided
    if [ -n "$WORKFLOW_URL" ]; then
        message="${message}

<a href=\"${WORKFLOW_URL}\">View Workflow Run</a>"
    fi

    # Add additional context for failures
    if [ "$STATUS" = "failed" ]; then
        message="${message}

<i>Please check the workflow logs for more details.</i>"
    fi

    # Add rollback notice
    if [ "$STATUS" = "rollback" ]; then
        message="${message}

<i>The system has been restored to the previous stable version.</i>"
    fi

    echo "$message"
}

# ============================================================================
# Telegram API
# ============================================================================

send_telegram_message() {
    local message="$1"

    log_info "Sending notification to Telegram..."

    local response
    response=$(curl -s -X POST "${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        -d "disable_web_page_preview=true")

    # Check if the request was successful
    local ok
    ok=$(echo "$response" | jq -r '.ok // false')

    if [ "$ok" = "true" ]; then
        log_success "Notification sent successfully"
        return 0
    else
        local error_description
        error_description=$(echo "$response" | jq -r '.description // "Unknown error"')
        log_error "Failed to send notification: $error_description"
        return 1
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "BuhBot Deployment Notification v$SCRIPT_VERSION"

    # Parse arguments
    parse_arguments "$@"

    # Validate environment
    validate_environment

    # Build message
    local message
    message=$(build_message)

    # Send notification
    if send_telegram_message "$message"; then
        log_success "Deployment notification sent"
        exit 0
    else
        log_error "Failed to send deployment notification"
        exit 1
    fi
}

# ============================================================================
# Script Entry Point
# ============================================================================

main "$@"

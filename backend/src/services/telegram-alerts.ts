/**
 * Telegram Alert Service
 *
 * Service for sending formatted alert notifications to admin Telegram chat.
 * Supports multiple severity levels and Prometheus Alertmanager webhook format.
 *
 * Features:
 * - Severity-based alert formatting (critical, warning, info)
 * - Russian language messages with visual indicators
 * - Prometheus Alertmanager webhook support
 * - Retry logic for failed sends
 * - Actionable details in alerts
 *
 * @module services/telegram-alerts
 */

import { Telegram } from 'telegraf';
import logger from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Alert details interface
 */
export interface AlertDetails {
  /** Alert severity level */
  severity: AlertSeverity;
  /** Alert title (short description) */
  title: string;
  /** Alert message (detailed description) */
  message: string;
  /** Current metric value (if applicable) */
  value?: string | number | undefined;
  /** Threshold that was exceeded */
  threshold?: string | number | undefined;
  /** Recommended actions */
  actions?: string | undefined;
  /** Additional context as key-value pairs */
  context?: Record<string, unknown> | undefined;
  /** Optional link to Grafana dashboard */
  grafanaUrl?: string | undefined;
}

/**
 * Prometheus Alertmanager webhook payload structure
 */
export interface AlertmanagerWebhookPayload {
  version: string;
  groupKey: string;
  truncatedAlerts?: number;
  status: 'firing' | 'resolved';
  receiver: string;
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  alerts: AlertmanagerAlert[];
}

/**
 * Individual Alertmanager alert
 */
export interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

/**
 * Severity configuration with visual indicators
 */
const SEVERITY_CONFIG = {
  critical: {
    emoji: '🔴',
    label: 'КРИТИЧЕСКАЯ ОШИБКА',
    priority: 3,
  },
  warning: {
    emoji: '🟡',
    label: 'ПРЕДУПРЕЖДЕНИЕ',
    priority: 2,
  },
  info: {
    emoji: '🔵',
    label: 'ИНФОРМАЦИЯ',
    priority: 1,
  },
} as const;

/**
 * Alertmanager severity mapping
 */
const ALERTMANAGER_SEVERITY_MAP: Record<string, AlertSeverity> = {
  critical: 'critical',
  error: 'critical',
  warning: 'warning',
  info: 'info',
  none: 'info',
};

/**
 * Telegram Alert Service
 *
 * Handles sending formatted alert notifications to admin Telegram chat
 */
export class TelegramAlertService {
  private telegram: Telegram;
  private adminChatId: string;
  private maxRetries: number;
  private retryDelayMs: number;

  /**
   * Create a new TelegramAlertService instance
   *
   * @param adminChatId - Telegram chat ID for admin notifications
   * @param options - Optional configuration
   */
  constructor(
    adminChatId?: string,
    options?: {
      maxRetries?: number;
      retryDelayMs?: number;
    }
  ) {
    this.telegram = new Telegram(env.TELEGRAM_BOT_TOKEN);
    this.adminChatId = adminChatId || env.TELEGRAM_ADMIN_CHAT_ID || '';
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;

    if (!this.adminChatId) {
      logger.warn('TelegramAlertService: TELEGRAM_ADMIN_CHAT_ID not configured');
    }
  }

  /**
   * Send an alert to the admin chat
   *
   * @param details - Alert details
   * @returns Promise resolving to success status
   */
  async sendAlert(details: AlertDetails): Promise<boolean> {
    if (!this.adminChatId) {
      logger.warn('Cannot send alert: admin chat ID not configured', {
        severity: details.severity,
        title: details.title,
      });
      return false;
    }

    const formattedMessage = this.formatAlertMessage(details);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.telegram.sendMessage(this.adminChatId, formattedMessage, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });

        logger.info('Alert sent successfully', {
          severity: details.severity,
          title: details.title,
          chatId: this.adminChatId,
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(`Failed to send alert (attempt ${attempt}/${this.maxRetries})`, {
          error: errorMessage,
          severity: details.severity,
          title: details.title,
          chatId: this.adminChatId,
        });

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * attempt);
        }
      }
    }

    logger.error('All retry attempts failed for alert', {
      severity: details.severity,
      title: details.title,
    });

    return false;
  }

  /**
   * Format an alert message with severity indicator and details
   *
   * @param details - Alert details
   * @returns Formatted HTML message string
   */
  formatAlertMessage(details: AlertDetails): string {
    const config = SEVERITY_CONFIG[details.severity];
    const timestamp = this.formatTimestamp(new Date());

    let message = '';

    // Header with severity
    message += `${config.emoji} <b>${config.label}</b>\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━\n';

    // Title
    message += `📌 <b>${this.escapeHtml(details.title)}</b>\n`;

    // Message/Description
    if (details.message) {
      message += `📝 ${this.escapeHtml(details.message)}\n`;
    }

    // Current value and threshold
    if (details.value !== undefined) {
      message += `📊 Текущее значение: <code>${this.escapeHtml(String(details.value))}</code>\n`;
    }

    if (details.threshold !== undefined) {
      message += `⚡ Порог: <code>${this.escapeHtml(String(details.threshold))}</code>\n`;
    }

    // Timestamp
    message += `🕐 Время: ${timestamp}\n`;

    // Recommended actions
    if (details.actions) {
      message += `\n📋 <b>Действия:</b> ${this.escapeHtml(details.actions)}\n`;
    }

    // Additional context
    if (details.context && Object.keys(details.context).length > 0) {
      message += '\n<b>Детали:</b>\n';
      for (const [key, value] of Object.entries(details.context)) {
        const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        message += `• ${this.escapeHtml(key)}: <code>${this.escapeHtml(formattedValue)}</code>\n`;
      }
    }

    // Grafana link
    if (details.grafanaUrl) {
      message += `\n🔗 <a href="${this.escapeHtml(details.grafanaUrl)}">Grafana Dashboard</a>`;
    }

    return message;
  }

  /**
   * Handle Prometheus Alertmanager webhook payload
   *
   * Parses the Alertmanager webhook format and sends formatted alerts.
   *
   * @param payload - Alertmanager webhook payload
   * @returns Promise resolving to array of send results
   */
  async handlePrometheusWebhook(
    payload: AlertmanagerWebhookPayload
  ): Promise<{ success: boolean; processed: number; failed: number }> {
    logger.info('Processing Alertmanager webhook', {
      status: payload.status,
      alertCount: payload.alerts.length,
      groupKey: payload.groupKey,
    });

    let processed = 0;
    let failed = 0;

    for (const alert of payload.alerts) {
      try {
        const details = this.parseAlertmanagerAlert(alert, payload);
        const success = await this.sendAlert(details);

        if (success) {
          processed++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error('Failed to process Alertmanager alert', {
          error: error instanceof Error ? error.message : String(error),
          fingerprint: alert.fingerprint,
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      processed,
      failed,
    };
  }

  /**
   * Parse an Alertmanager alert into our AlertDetails format
   *
   * @param alert - Alertmanager alert
   * @param payload - Parent webhook payload
   * @returns AlertDetails object
   */
  private parseAlertmanagerAlert(
    alert: AlertmanagerAlert,
    payload: AlertmanagerWebhookPayload
  ): AlertDetails {
    const severityLabel = alert.labels['severity'] || 'warning';
    const severity = ALERTMANAGER_SEVERITY_MAP[severityLabel.toLowerCase()] || 'warning';

    // Build title from alertname or summary
    const title = alert.annotations['summary'] || alert.labels['alertname'] || 'Prometheus Alert';

    // Build message from description
    const message = alert.annotations['description'] || `Alert ${alert.status}: ${title}`;

    // Add resolved status indicator
    const statusPrefix = alert.status === 'resolved' ? '[RESOLVED] ' : '';

    // Build context from labels
    const context: Record<string, unknown> = {};

    // Add important labels to context
    const importantLabels = ['instance', 'job', 'service', 'namespace', 'pod'];
    for (const label of importantLabels) {
      if (alert.labels[label]) {
        context[label] = alert.labels[label];
      }
    }

    // Add fingerprint for tracking
    context['fingerprint'] = alert.fingerprint;

    // Build the result object, only adding optional properties if they have values
    const result: AlertDetails = {
      severity: alert.status === 'resolved' ? 'info' : severity,
      title: `${statusPrefix}${title}`,
      message,
      context,
    };

    // Add optional properties only if they have values
    const valueAnnotation = alert.annotations['value'];
    if (valueAnnotation !== undefined) {
      result.value = valueAnnotation;
    }

    const runbookUrl = alert.annotations['runbook_url'];
    if (runbookUrl) {
      result.actions = `Runbook: ${runbookUrl}`;
    }

    const grafanaUrl = alert.annotations['grafana_url'] || payload.externalURL;
    if (grafanaUrl) {
      result.grafanaUrl = grafanaUrl;
    }

    return result;
  }

  /**
   * Send a simple text alert (convenience method)
   *
   * @param severity - Alert severity
   * @param title - Alert title
   * @param message - Alert message
   * @returns Promise resolving to success status
   */
  async sendSimpleAlert(severity: AlertSeverity, title: string, message: string): Promise<boolean> {
    return this.sendAlert({ severity, title, message });
  }

  /**
   * Send critical alert (convenience method)
   */
  async sendCritical(
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    const details: AlertDetails = { severity: 'critical', title, message };
    if (context !== undefined) {
      details.context = context;
    }
    return this.sendAlert(details);
  }

  /**
   * Send warning alert (convenience method)
   */
  async sendWarning(
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    const details: AlertDetails = { severity: 'warning', title, message };
    if (context !== undefined) {
      details.context = context;
    }
    return this.sendAlert(details);
  }

  /**
   * Send info alert (convenience method)
   */
  async sendInfo(
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<boolean> {
    const details: AlertDetails = { severity: 'info', title, message };
    if (context !== undefined) {
      details.context = context;
    }
    return this.sendAlert(details);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Format timestamp in Russian-friendly format
   */
  private formatTimestamp(date: Date): string {
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Moscow',
    });
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create Express request handler for Prometheus Alertmanager webhook
 *
 * @param alertService - TelegramAlertService instance
 * @returns Express request handler
 */
export function createAlertmanagerWebhookHandler(alertService: TelegramAlertService) {
  return async (
    req: { body: AlertmanagerWebhookPayload },
    res: { status: (code: number) => { json: (data: unknown) => void } }
  ) => {
    try {
      const result = await alertService.handlePrometheusWebhook(req.body);

      res.status(result.success ? 200 : 207).json({
        status: result.success ? 'success' : 'partial_success',
        processed: result.processed,
        failed: result.failed,
      });
    } catch (error) {
      logger.error('Alertmanager webhook handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        status: 'error',
        message: 'Failed to process alerts',
      });
    }
  };
}

/**
 * Singleton instance (lazy initialized)
 */
let alertServiceInstance: TelegramAlertService | null = null;

/**
 * Get or create the singleton TelegramAlertService instance
 */
export function getAlertService(): TelegramAlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new TelegramAlertService();
  }
  return alertServiceInstance;
}

export default TelegramAlertService;

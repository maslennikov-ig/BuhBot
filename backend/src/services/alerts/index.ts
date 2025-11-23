/**
 * Alerts Service Index
 *
 * Exports all alert-related services for SLA monitoring.
 *
 * @module services/alerts
 */

// Alert CRUD and lifecycle management
export {
  createAlert,
  resolveAlert,
  resolveAlertsForRequest,
  getActiveAlerts,
  getAlertById,
  updateDeliveryStatus,
  updateEscalationLevel,
  type CreateAlertParams,
  type ResolveAlertParams,
  type SlaAlert,
  type AlertType,
  type AlertAction,
  type AlertDeliveryStatus,
} from './alert.service.js';

// Alert message formatting
export {
  formatAlertMessage,
  formatShortNotification,
  formatAccountantNotification,
  formatResolutionConfirmation,
  escapeHtml,
  truncateText,
  type AlertMessageData,
} from './format.service.js';

// Escalation scheduling and management
export {
  scheduleNextEscalation,
  cancelEscalation,
  processEscalation,
  isEscalationOverdue,
  type EscalationConfig,
} from './escalation.service.js';

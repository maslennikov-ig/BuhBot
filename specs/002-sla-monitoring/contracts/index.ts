/**
 * SLA Monitoring - tRPC API Contracts
 *
 * Центральный экспорт всех API контрактов для SLA Monitoring System.
 *
 * @module contracts
 */

// SLA Operations
export * from './sla.router';

// Chat Management
export * from './chat.router';

// Alert Management
export * from './alert.router';

// Analytics & Dashboard
export * from './analytics.router';

// Global Settings
export * from './settings.router';

/**
 * Router Types Summary:
 *
 * slaRouter:
 *   - createRequest, classifyMessage, startTimer, stopTimer
 *   - getRequests, getRequestById, getActiveTimers
 *
 * chatRouter:
 *   - registerChat, updateChat, updateWorkingSchedule
 *   - addHoliday, removeHoliday
 *   - getChats, getChatById, getWorkingSchedule, getHolidays
 *
 * alertRouter:
 *   - createAlert, resolveAlert, notifyAccountant, updateDeliveryStatus
 *   - getAlerts, getAlertById, getActiveAlerts, getAlertStats
 *
 * analyticsRouter:
 *   - getDashboard, getAccountantStats, getSlaCompliance
 *   - getResponseTime, exportReport
 *
 * settingsRouter:
 *   - updateGlobalSettings, addGlobalHoliday, removeGlobalHoliday
 *   - bulkAddHolidays, seedRussianHolidays
 *   - getGlobalSettings, getGlobalHolidays
 */

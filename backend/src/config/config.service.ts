/**
 * Unified Configuration Service (gh-74)
 *
 * Provides cached, type-safe access to GlobalSettings with a TTL.
 * Eliminates repeated DB queries across 20+ call sites.
 *
 * Precedence hierarchy:
 *   Chat-level settings > GlobalSettings (DB) > Environment > Hardcoded defaults
 *
 * @module config/config.service
 */

import { prisma } from '../lib/prisma.js';
import logger from '../utils/logger.js';

/** Cached GlobalSettings type (matches Prisma model) */
export interface CachedGlobalSettings {
  // Working Hours
  defaultTimezone: string;
  defaultWorkingDays: number[];
  defaultStartTime: string;
  defaultEndTime: string;

  // SLA
  defaultSlaThreshold: number;
  maxEscalations: number;
  escalationIntervalMin: number;
  slaWarningPercent: number;

  // Manager Alerts
  globalManagerIds: string[];
  leadNotificationIds: string[];

  // AI Classification
  aiConfidenceThreshold: number;
  messagePreviewLength: number;
  openrouterApiKey: string | null;
  openrouterModel: string;

  // Data Retention
  dataRetentionYears: number;

  // Survey
  surveyValidityDays: number;
  surveyReminderDay: number;
  lowRatingThreshold: number;
  surveyQuarterDay: number;

  // Bot
  botToken: string | null;
  botUsername: string | null;
  botId: bigint | null;
}

/** Hardcoded defaults matching Prisma schema defaults */
const DEFAULTS: CachedGlobalSettings = {
  defaultTimezone: 'Europe/Moscow',
  defaultWorkingDays: [1, 2, 3, 4, 5],
  defaultStartTime: '09:00',
  defaultEndTime: '18:00',
  defaultSlaThreshold: 60,
  maxEscalations: 5,
  escalationIntervalMin: 30,
  slaWarningPercent: 80,
  globalManagerIds: [],
  leadNotificationIds: [],
  aiConfidenceThreshold: 0.7,
  messagePreviewLength: 500,
  openrouterApiKey: null,
  openrouterModel: 'xiaomi/mimo-v2-flash',
  dataRetentionYears: 3,
  surveyValidityDays: 7,
  surveyReminderDay: 2,
  lowRatingThreshold: 3,
  surveyQuarterDay: 1,
  botToken: null,
  botUsername: null,
  botId: null,
};

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedSettings: CachedGlobalSettings | null = null;
let cacheTimestamp = 0;

/**
 * Get GlobalSettings with caching.
 * Fetches from DB at most once per CACHE_TTL_MS.
 * Returns hardcoded defaults if DB is unreachable.
 */
export async function getGlobalSettings(): Promise<CachedGlobalSettings> {
  const now = Date.now();

  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      logger.warn('GlobalSettings row not found, using defaults', {
        service: 'config-service',
      });
      cachedSettings = { ...DEFAULTS };
    } else {
      cachedSettings = {
        defaultTimezone: settings.defaultTimezone,
        defaultWorkingDays: settings.defaultWorkingDays,
        defaultStartTime: settings.defaultStartTime,
        defaultEndTime: settings.defaultEndTime,
        defaultSlaThreshold: settings.defaultSlaThreshold,
        maxEscalations: settings.maxEscalations,
        escalationIntervalMin: settings.escalationIntervalMin,
        slaWarningPercent: settings.slaWarningPercent,
        globalManagerIds: settings.globalManagerIds,
        leadNotificationIds: settings.leadNotificationIds,
        aiConfidenceThreshold: settings.aiConfidenceThreshold,
        messagePreviewLength: settings.messagePreviewLength,
        openrouterApiKey: settings.openrouterApiKey,
        openrouterModel: settings.openrouterModel,
        dataRetentionYears: settings.dataRetentionYears,
        surveyValidityDays: settings.surveyValidityDays,
        surveyReminderDay: settings.surveyReminderDay,
        lowRatingThreshold: settings.lowRatingThreshold,
        surveyQuarterDay: settings.surveyQuarterDay,
        botToken: settings.botToken,
        botUsername: settings.botUsername,
        botId: settings.botId,
      };
    }

    cacheTimestamp = now;
    return cachedSettings;
  } catch (error) {
    logger.error('Failed to fetch GlobalSettings, using cache or defaults', {
      error: error instanceof Error ? error.message : String(error),
      hasCachedSettings: cachedSettings !== null,
      service: 'config-service',
    });

    // Return stale cache or defaults
    return cachedSettings ?? { ...DEFAULTS };
  }
}

/**
 * Invalidate the settings cache.
 * Call this after updating GlobalSettings via admin UI.
 */
export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
  logger.debug('GlobalSettings cache invalidated', {
    service: 'config-service',
  });
}

// --- Convenience getters for common config patterns ---

/** Default SLA thresholds per client tier (gh-76) */
const TIER_THRESHOLDS: Record<string, number> = {
  basic: 120,
  standard: 60,
  vip: 30,
  premium: 15,
};

/**
 * Get default SLA threshold for a client tier (gh-76).
 * Returns tier-specific default or global default.
 */
export function getTierDefaultThreshold(tier?: string | null): number {
  if (tier && tier in TIER_THRESHOLDS) {
    return TIER_THRESHOLDS[tier]!;
  }
  return 60; // standard default
}

/**
 * Get SLA threshold for a chat.
 * Precedence: Chat.slaThresholdMinutes > Tier default > GlobalSettings.defaultSlaThreshold > 60
 */
export async function getSlaThreshold(
  chatSlaThreshold?: number | null,
  clientTier?: string | null
): Promise<number> {
  if (chatSlaThreshold != null && chatSlaThreshold > 0) {
    return chatSlaThreshold;
  }
  if (clientTier && clientTier in TIER_THRESHOLDS) {
    return TIER_THRESHOLDS[clientTier]!;
  }
  const settings = await getGlobalSettings();
  return settings.defaultSlaThreshold;
}

/**
 * Get manager Telegram IDs for notifications.
 * Precedence: Chat.managerTelegramIds > Chat.accountantTelegramIds > GlobalSettings.globalManagerIds > []
 *
 * @deprecated Use getRecipientsByLevel for new SLA alert code
 */
export async function getManagerIds(
  chatManagerIds?: string[] | null,
  accountantTelegramIds?: bigint[] | null
): Promise<string[]> {
  if (chatManagerIds && chatManagerIds.length > 0) {
    return chatManagerIds;
  }
  if (accountantTelegramIds && accountantTelegramIds.length > 0) {
    return accountantTelegramIds.map((id) => id.toString());
  }
  const settings = await getGlobalSettings();
  return settings.globalManagerIds;
}

/**
 * Two-tier recipient resolution.
 * Level 1: accountants (falls back to managers if no accountants)
 * Level 2+: managers + accountants (both)
 *
 * @param chatManagerIds - Chat-specific manager Telegram IDs (or null to use global)
 * @param accountantTelegramIds - Accountant Telegram IDs for this chat
 * @param escalationLevel - Escalation level (1 = initial breach, 2+ = escalation)
 */
export async function getRecipientsByLevel(
  chatManagerIds?: string[] | null,
  accountantTelegramIds?: bigint[] | null,
  escalationLevel: number = 1
): Promise<{ recipients: string[]; tier: 'accountant' | 'manager' | 'both' | 'fallback' }> {
  const accountantIds = (accountantTelegramIds ?? []).map((id) => String(id));
  const managerIds = await getManagerIds(chatManagerIds);

  if (escalationLevel <= 1) {
    // Level 1: prefer accountants
    if (accountantIds.length > 0) {
      return { recipients: accountantIds, tier: 'accountant' };
    }
    // No accountants — fallback to managers
    if (managerIds.length > 0) {
      return { recipients: managerIds, tier: 'fallback' };
    }
    return { recipients: [], tier: 'fallback' };
  }

  // Level 2+: both managers and accountants
  const allRecipients = [...new Set([...managerIds, ...accountantIds])];
  if (allRecipients.length > 0) {
    const tier =
      accountantIds.length > 0 && managerIds.length > 0
        ? 'both'
        : accountantIds.length > 0
          ? 'accountant'
          : 'manager';
    return { recipients: allRecipients, tier };
  }
  return { recipients: [], tier: 'fallback' };
}

/**
 * Get escalation configuration.
 */
export async function getEscalationConfig(): Promise<{
  maxEscalations: number;
  escalationIntervalMin: number;
}> {
  const settings = await getGlobalSettings();
  return {
    maxEscalations: settings.maxEscalations,
    escalationIntervalMin: settings.escalationIntervalMin,
  };
}

/**
 * Get AI classification configuration.
 */
export async function getClassifierConfig(): Promise<{
  openrouterApiKey: string | null;
  openrouterModel: string;
  aiConfidenceThreshold: number;
}> {
  const settings = await getGlobalSettings();
  return {
    openrouterApiKey: settings.openrouterApiKey,
    openrouterModel: settings.openrouterModel,
    aiConfidenceThreshold: settings.aiConfidenceThreshold,
  };
}

/**
 * Get SLA warning percent threshold.
 * Returns the percentage (0-100) of SLA threshold at which a warning is sent.
 * 0 means warnings are disabled.
 */
export async function getSlaWarningPercent(): Promise<number> {
  const settings = await getGlobalSettings();
  return settings.slaWarningPercent;
}

/**
 * Get survey configuration.
 */
export async function getSurveyConfig(): Promise<{
  surveyValidityDays: number;
  surveyReminderDay: number;
  lowRatingThreshold: number;
  surveyQuarterDay: number;
}> {
  const settings = await getGlobalSettings();
  return {
    surveyValidityDays: settings.surveyValidityDays,
    surveyReminderDay: settings.surveyReminderDay,
    lowRatingThreshold: settings.lowRatingThreshold,
    surveyQuarterDay: settings.surveyQuarterDay,
  };
}

export default {
  getGlobalSettings,
  invalidateSettingsCache,
  getTierDefaultThreshold,
  getSlaThreshold,
  getManagerIds,
  getRecipientsByLevel,
  getEscalationConfig,
  getClassifierConfig,
  getSlaWarningPercent,
  getSurveyConfig,
};

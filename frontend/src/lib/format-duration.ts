/**
 * Adaptive duration formatting for Russian UI.
 *
 * gh-290 requires /violations show elapsed SLA excess in units that grow with
 * the value so a 3-day backlog does not render as "4320м". Thresholds (in
 * minutes):
 *   < 1 h        → `{m}м`
 *   < 24 h       → `{h}ч {m}м` (minute part omitted when 0)
 *   < 7 d        → `{d}д {h}ч`
 *   ≥ 7 d       → `{w}н {d}д`
 *
 * The "severity" flag is a derived signal for UI elements that want to show a
 * warning color/icon at long breaches. A request is flagged when it crosses
 * twice its configured SLA threshold.
 *
 * @module lib/format-duration
 */

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * 24;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

/**
 * Format a duration in minutes using adaptive units for Russian UI.
 * `null` or negative → `'-'`.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  if (!Number.isFinite(minutes) || minutes < 0) return '-';

  const mins = Math.floor(minutes);

  if (mins < MINUTES_PER_HOUR) {
    return `${mins}м`;
  }

  if (mins < MINUTES_PER_DAY) {
    const h = Math.floor(mins / MINUTES_PER_HOUR);
    const m = mins % MINUTES_PER_HOUR;
    return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
  }

  if (mins < MINUTES_PER_WEEK) {
    const d = Math.floor(mins / MINUTES_PER_DAY);
    const h = Math.floor((mins % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    return h > 0 ? `${d}д ${h}ч` : `${d}д`;
  }

  const w = Math.floor(mins / MINUTES_PER_WEEK);
  const d = Math.floor((mins % MINUTES_PER_WEEK) / MINUTES_PER_DAY);
  return d > 0 ? `${w}н ${d}д` : `${w}н`;
}

/**
 * Compute SLA excess (minutes beyond threshold) for a request.
 *
 * Reference point precedence (oldest is least accurate, freshest is best):
 *   1. `responseAt` — most accurate when present (breach resolved at that
 *      moment).
 *   2. `slaBreachedAt` — written by the worker when the SLA timer fires
 *      (gh-290; only present from migration `20260417000000_add_sla_breached_at`
 *      onwards, with backfill in `20260419000000_backfill_sla_breached_at`).
 *   3. `now` — for unanswered breaches with no recorded `slaBreachedAt`
 *      (legacy rows that fell through both migrations). Using `now` keeps
 *      the counter ticking on the /violations page so a 3-day old open
 *      breach renders as e.g. `3д 2ч` instead of `+0м`.
 *
 * Excess = (xMs − receivedAt) − slaMinutes, clamped to 0 and rounded.
 *
 * Caller contract: `slaMinutes` MUST be the configured SLA threshold (e.g.
 * `chat.slaThresholdMinutes`), NOT the elapsed working minutes. Passing
 * `slaWorkingMinutes` (which `stopSlaTimer` overwrites with the actual
 * response time on answer) would yield a spurious 0 because elapsed minus
 * elapsed is zero. See gh-290 / violations-row +0m bug.
 *
 * Returns `null` when `receivedAt` is missing so callers can render a
 * placeholder.
 */
export function computeSlaExcessMinutes(params: {
  receivedAt: Date | string | null | undefined;
  responseAt: Date | string | null | undefined;
  slaBreachedAt?: Date | string | null | undefined;
  slaMinutes: number;
  now: Date;
}): number | null {
  const { receivedAt, responseAt, slaBreachedAt, slaMinutes, now } = params;
  if (!receivedAt) return null;

  const receivedMs = toMs(receivedAt);
  if (receivedMs === null) return null;

  // For legacy rows where slaBreachedAt is null and there is no response,
  // fall back to `now` so unanswered open breaches keep ticking instead of
  // rendering as "+0м".
  const xMs = toMs(responseAt) ?? toMs(slaBreachedAt) ?? now.getTime();
  const elapsedMinutes = (xMs - receivedMs) / 60_000;
  const excess = elapsedMinutes - slaMinutes;

  return excess > 0 ? Math.round(excess) : 0;
}

/**
 * True when the SLA excess has crossed twice the configured threshold —
 * signals a long-running unanswered breach that deserves visual escalation.
 *
 * Defensive `slaMinutes <= 0` branch: the violations page coerces
 * `slaWorkingMinutes || 60` so in practice this branch is unreachable from
 * the main call site. It exists to prevent a nonsense `2 × 0 = 0` result
 * (which would flag every positive excess as severe) if a future caller
 * forgets the coercion. 1 h matches the default global SLA.
 */
export function isSlaExcessSevere(excessMinutes: number | null, slaMinutes: number): boolean {
  if (excessMinutes === null) return false;
  if (slaMinutes <= 0) return excessMinutes >= MINUTES_PER_HOUR;
  return excessMinutes >= slaMinutes * 2;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Working Hours Calculator Service
 *
 * Calculates SLA time considering working hours, holidays, and timezones.
 * Used for tracking response time SLA in BuhBot accounting communication platform.
 *
 * Features:
 * - Timezone-aware calculations (default: Europe/Moscow)
 * - Configurable working days (default: Mon-Fri)
 * - Configurable working hours (default: 09:00-18:00)
 * - Holiday support
 * - 24/7 mode bypass for critical clients
 *
 * @module services/sla/working-hours
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  getDay,
  addMinutes,
  addDays,
  differenceInMinutes,
  isSameDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns';
import logger from '../../utils/logger.js';

/**
 * Working schedule configuration for SLA calculations
 */
export interface WorkingSchedule {
  /** IANA timezone identifier (e.g., "Europe/Moscow") */
  timezone: string;
  /** Working days as numbers: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun */
  workingDays: number[];
  /** Working hours start time in HH:mm format (e.g., "09:00") */
  startTime: string;
  /** Working hours end time in HH:mm format (e.g., "18:00") */
  endTime: string;
  /** Array of holiday dates to exclude from working time */
  holidays: Date[];
  /** If true, all time counts as working time (bypasses schedule) */
  is24x7: boolean;
}

/**
 * Default working schedule for Moscow timezone
 * Monday-Friday, 09:00-18:00
 */
export const DEFAULT_WORKING_SCHEDULE: WorkingSchedule = {
  timezone: 'Europe/Moscow',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  startTime: '09:00',
  endTime: '18:00',
  holidays: [],
  is24x7: false,
};

/**
 * Parse time string (HH:mm) into hours and minutes
 *
 * @param timeStr - Time string in HH:mm format
 * @returns Object with hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours ?? 0, minutes: minutes ?? 0 };
}

/**
 * Set time on a date object
 *
 * @param date - Date to modify
 * @param hours - Hours to set
 * @param minutes - Minutes to set
 * @returns New date with specified time
 */
function setTime(date: Date, hours: number, minutes: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, hours), minutes), 0), 0);
}

/**
 * Convert JavaScript getDay() (0=Sun, 1=Mon, ..., 6=Sat) to ISO weekday (1=Mon, ..., 7=Sun)
 *
 * @param jsDay - JavaScript day number (0-6)
 * @returns ISO weekday number (1-7, where 1=Mon and 7=Sun)
 */
function jsToIsoWeekday(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Check if a date is a holiday
 *
 * @param date - Date to check (in schedule timezone)
 * @param holidays - Array of holiday dates
 * @returns True if date is a holiday
 */
function isHoliday(date: Date, holidays: Date[]): boolean {
  return holidays.some((holiday) => isSameDay(date, holiday));
}

/**
 * Check if the given timestamp is during working hours
 *
 * Takes into account:
 * - Timezone conversion
 * - Working days (Mon-Fri by default)
 * - Working hours (09:00-18:00 by default)
 * - Holidays
 * - 24/7 mode
 *
 * @param date - Date/time to check (can be any timezone, will be converted)
 * @param schedule - Working schedule configuration
 * @returns True if the timestamp falls within working hours
 *
 * @example
 * ```ts
 * // Check if current time is during working hours in Moscow
 * const isWorking = isWorkingTime(new Date(), DEFAULT_WORKING_SCHEDULE);
 *
 * // Check with custom schedule
 * const customSchedule = { ...DEFAULT_WORKING_SCHEDULE, is24x7: true };
 * const isAlwaysWorking = isWorkingTime(new Date(), customSchedule); // true
 * ```
 */
export function isWorkingTime(
  date: Date,
  schedule: WorkingSchedule = DEFAULT_WORKING_SCHEDULE
): boolean {
  // 24/7 mode bypasses all checks
  if (schedule.is24x7) {
    return true;
  }

  // Convert to schedule timezone
  const zonedDate = toZonedTime(date, schedule.timezone);

  // Check if working day (convert JS day to ISO format where 1=Mon)
  const jsDay = getDay(zonedDate);
  const isoDay = jsToIsoWeekday(jsDay);

  // workingDays uses 1=Mon format to match ISO weekday
  if (!schedule.workingDays.includes(isoDay === 7 ? 0 : isoDay)) {
    return false;
  }

  // Check if holiday
  if (isHoliday(zonedDate, schedule.holidays)) {
    return false;
  }

  // Parse working hours
  const startParsed = parseTime(schedule.startTime);
  const endParsed = parseTime(schedule.endTime);

  // Create working hours boundaries for this day
  const workStart = setTime(zonedDate, startParsed.hours, startParsed.minutes);
  const workEnd = setTime(zonedDate, endParsed.hours, endParsed.minutes);

  // Check if current time is within working hours
  // Using >= for start and < for end (work ends at 18:00, not at 18:01)
  return !isBefore(zonedDate, workStart) && isBefore(zonedDate, workEnd);
}

/**
 * Get the next working time from a given timestamp
 *
 * If the given time is during working hours, returns the same time.
 * Otherwise, finds the next working day/time.
 *
 * @param from - Starting date/time
 * @param schedule - Working schedule configuration
 * @returns Date representing next working time
 *
 * @example
 * ```ts
 * // Friday 17:55 -> returns Friday 17:55 (still working)
 * // Friday 18:05 -> returns Monday 09:00
 * // Saturday 12:00 -> returns Monday 09:00
 * const nextWorking = getNextWorkingTime(new Date(), DEFAULT_WORKING_SCHEDULE);
 * ```
 */
export function getNextWorkingTime(
  from: Date,
  schedule: WorkingSchedule = DEFAULT_WORKING_SCHEDULE
): Date {
  // 24/7 mode - current time is always working time
  if (schedule.is24x7) {
    return from;
  }

  // If already during working time, return as-is
  if (isWorkingTime(from, schedule)) {
    return from;
  }

  // Convert to schedule timezone
  const zonedFrom = toZonedTime(from, schedule.timezone);

  // Parse working hours
  const startParsed = parseTime(schedule.startTime);

  // Check if we're on a working day but outside hours
  const jsDay = getDay(zonedFrom);
  const isoDay = jsToIsoWeekday(jsDay);
  const dayInSchedule = schedule.workingDays.includes(isoDay === 7 ? 0 : isoDay);
  const notHoliday = !isHoliday(zonedFrom, schedule.holidays);

  // If on a working day, before work starts
  if (dayInSchedule && notHoliday) {
    const workStart = setTime(zonedFrom, startParsed.hours, startParsed.minutes);
    if (isBefore(zonedFrom, workStart)) {
      // Return work start time today
      return fromZonedTime(workStart, schedule.timezone);
    }
  }

  // Otherwise, find next working day
  let nextDay = addDays(startOfDay(zonedFrom), 1);
  const maxIterations = 365; // Prevent infinite loop

  for (let i = 0; i < maxIterations; i++) {
    const nextJsDay = getDay(nextDay);
    const nextIsoDay = jsToIsoWeekday(nextJsDay);
    const nextDayInSchedule = schedule.workingDays.includes(nextIsoDay === 7 ? 0 : nextIsoDay);
    const nextNotHoliday = !isHoliday(nextDay, schedule.holidays);

    if (nextDayInSchedule && nextNotHoliday) {
      // Found next working day
      const workStart = setTime(nextDay, startParsed.hours, startParsed.minutes);
      return fromZonedTime(workStart, schedule.timezone);
    }

    nextDay = addDays(nextDay, 1);
  }

  // Fallback (should never reach here with valid schedule)
  logger.warn('Could not find next working time within 365 days', {
    from: from.toISOString(),
    schedule: { ...schedule, holidays: schedule.holidays.length },
  });

  return from;
}

/**
 * Calculate working minutes between two timestamps
 *
 * Accounts for:
 * - Working hours (only counts time within working hours)
 * - Working days (skips weekends)
 * - Holidays (skips holiday dates)
 * - Timezone differences
 * - 24/7 mode (counts all minutes)
 *
 * @param start - Start date/time
 * @param end - End date/time
 * @param schedule - Working schedule configuration
 * @returns Number of working minutes between start and end
 *
 * @example
 * ```ts
 * // Friday 17:55 to Monday 09:05 = 10 working minutes
 * // (5 min on Friday + 5 min on Monday)
 * const minutes = calculateWorkingMinutes(
 *   new Date('2024-01-12T17:55:00+03:00'), // Friday
 *   new Date('2024-01-15T09:05:00+03:00'), // Monday
 *   DEFAULT_WORKING_SCHEDULE
 * );
 * // Result: 10
 * ```
 */
export function calculateWorkingMinutes(
  start: Date,
  end: Date,
  schedule: WorkingSchedule = DEFAULT_WORKING_SCHEDULE
): number {
  // Handle edge case: end before start
  if (isAfter(start, end)) {
    return 0;
  }

  // 24/7 mode - count all minutes
  if (schedule.is24x7) {
    return Math.max(0, differenceInMinutes(end, start));
  }

  // Convert to schedule timezone
  const zonedStart = toZonedTime(start, schedule.timezone);
  const zonedEnd = toZonedTime(end, schedule.timezone);

  // Parse working hours
  const startParsed = parseTime(schedule.startTime);
  const endParsed = parseTime(schedule.endTime);
  const workingMinutesPerDay =
    (endParsed.hours * 60 + endParsed.minutes) - (startParsed.hours * 60 + startParsed.minutes);

  let totalMinutes = 0;
  let currentDay = startOfDay(zonedStart);
  const endDay = startOfDay(zonedEnd);

  // Iterate day by day
  while (!isAfter(currentDay, endDay)) {
    const jsDay = getDay(currentDay);
    const isoDay = jsToIsoWeekday(jsDay);
    const dayInSchedule = schedule.workingDays.includes(isoDay === 7 ? 0 : isoDay);
    const notHoliday = !isHoliday(currentDay, schedule.holidays);

    if (dayInSchedule && notHoliday) {
      // This is a working day
      const dayWorkStart = setTime(currentDay, startParsed.hours, startParsed.minutes);
      const dayWorkEnd = setTime(currentDay, endParsed.hours, endParsed.minutes);

      // Determine effective start for this day
      let effectiveStart: Date;
      if (isSameDay(currentDay, zonedStart)) {
        // First day - start from actual start time or work start, whichever is later
        effectiveStart = isAfter(zonedStart, dayWorkStart) ? zonedStart : dayWorkStart;
      } else {
        effectiveStart = dayWorkStart;
      }

      // Determine effective end for this day
      let effectiveEnd: Date;
      if (isSameDay(currentDay, zonedEnd)) {
        // Last day - end at actual end time or work end, whichever is earlier
        effectiveEnd = isBefore(zonedEnd, dayWorkEnd) ? zonedEnd : dayWorkEnd;
      } else {
        effectiveEnd = dayWorkEnd;
      }

      // Only count if effective start is before effective end
      // and within working hours
      if (isBefore(effectiveStart, effectiveEnd)) {
        // Clamp to working hours
        const clampedStart = isBefore(effectiveStart, dayWorkStart) ? dayWorkStart : effectiveStart;
        const clampedEnd = isAfter(effectiveEnd, dayWorkEnd) ? dayWorkEnd : effectiveEnd;

        if (isBefore(clampedStart, clampedEnd)) {
          const dayMinutes = differenceInMinutes(clampedEnd, clampedStart);
          totalMinutes += Math.min(dayMinutes, workingMinutesPerDay);
        }
      }
    }

    currentDay = addDays(currentDay, 1);
  }

  return totalMinutes;
}

/**
 * Calculate delay in milliseconds until SLA breach would occur
 *
 * Used for scheduling BullMQ delayed jobs. Calculates how many milliseconds
 * from now until the SLA threshold would be exceeded, accounting for
 * working hours only.
 *
 * @param receivedAt - When the client request was received
 * @param thresholdMinutes - SLA threshold in working minutes
 * @param schedule - Working schedule configuration
 * @returns Delay in milliseconds until breach (0 if already breached)
 *
 * @example
 * ```ts
 * // Request received now with 60-minute SLA
 * const delay = calculateDelayUntilBreach(
 *   new Date(),
 *   60,
 *   DEFAULT_WORKING_SCHEDULE
 * );
 *
 * // Schedule BullMQ job with this delay
 * await queue.add('check-breach', { requestId }, { delay });
 * ```
 */
export function calculateDelayUntilBreach(
  receivedAt: Date,
  thresholdMinutes: number,
  schedule: WorkingSchedule = DEFAULT_WORKING_SCHEDULE
): number {
  // 24/7 mode - simple calculation
  if (schedule.is24x7) {
    const breachTime = addMinutes(receivedAt, thresholdMinutes);
    const delayMs = breachTime.getTime() - Date.now();
    return Math.max(0, delayMs);
  }

  // Find when breach would occur by adding working minutes
  const breachTime = addWorkingMinutes(receivedAt, thresholdMinutes, schedule);
  const delayMs = breachTime.getTime() - Date.now();

  logger.debug('Calculated delay until SLA breach', {
    receivedAt: receivedAt.toISOString(),
    thresholdMinutes,
    breachTime: breachTime.toISOString(),
    delayMs,
  });

  return Math.max(0, delayMs);
}

/**
 * Add working minutes to a date
 *
 * Internal helper that adds the specified number of working minutes
 * to a date, accounting for working hours, weekends, and holidays.
 *
 * @param date - Starting date
 * @param minutes - Number of working minutes to add
 * @param schedule - Working schedule configuration
 * @returns Date after adding working minutes
 */
function addWorkingMinutes(
  date: Date,
  minutes: number,
  schedule: WorkingSchedule
): Date {
  if (minutes <= 0) {
    return date;
  }

  // Convert to schedule timezone
  let current = toZonedTime(date, schedule.timezone);

  // Parse working hours (only need end time for calculating day boundaries)
  const endParsed = parseTime(schedule.endTime);

  let remainingMinutes = minutes;
  const maxIterations = 365 * 24 * 60; // Prevent infinite loop

  for (let i = 0; i < maxIterations && remainingMinutes > 0; i++) {
    // Move to next working time if not currently in working hours
    const nextWorkingStart = getNextWorkingTimeZoned(current, schedule);
    if (isAfter(nextWorkingStart, current)) {
      current = nextWorkingStart;
    }

    // Get today's work end
    const dayWorkEnd = setTime(current, endParsed.hours, endParsed.minutes);

    // Calculate remaining working minutes today
    const minutesUntilEndOfDay = differenceInMinutes(dayWorkEnd, current);

    if (minutesUntilEndOfDay >= remainingMinutes) {
      // Can complete within today
      current = addMinutes(current, remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Need to continue to next working day
      remainingMinutes -= minutesUntilEndOfDay;
      // Move to next day's work start
      const nextDay = addDays(startOfDay(current), 1);
      current = nextDay;
    }
  }

  return fromZonedTime(current, schedule.timezone);
}

/**
 * Get next working time from a zoned date (internal helper)
 * Works with dates already converted to the schedule timezone
 */
function getNextWorkingTimeZoned(
  zonedDate: Date,
  schedule: WorkingSchedule
): Date {
  const startParsed = parseTime(schedule.startTime);
  const endParsed = parseTime(schedule.endTime);

  // Check if currently in working time
  const jsDay = getDay(zonedDate);
  const isoDay = jsToIsoWeekday(jsDay);
  const dayInSchedule = schedule.workingDays.includes(isoDay === 7 ? 0 : isoDay);
  const notHoliday = !isHoliday(zonedDate, schedule.holidays);

  if (dayInSchedule && notHoliday) {
    const workStart = setTime(zonedDate, startParsed.hours, startParsed.minutes);
    const workEnd = setTime(zonedDate, endParsed.hours, endParsed.minutes);

    // Before work start - return work start
    if (isBefore(zonedDate, workStart)) {
      return workStart;
    }

    // During work hours - return current time
    if (isBefore(zonedDate, workEnd)) {
      return zonedDate;
    }
  }

  // After work hours or non-working day - find next working day
  let nextDay = addDays(startOfDay(zonedDate), 1);
  const maxIterations = 365;

  for (let i = 0; i < maxIterations; i++) {
    const nextJsDay = getDay(nextDay);
    const nextIsoDay = jsToIsoWeekday(nextJsDay);
    const nextDayInSchedule = schedule.workingDays.includes(nextIsoDay === 7 ? 0 : nextIsoDay);
    const nextNotHoliday = !isHoliday(nextDay, schedule.holidays);

    if (nextDayInSchedule && nextNotHoliday) {
      return setTime(nextDay, startParsed.hours, startParsed.minutes);
    }

    nextDay = addDays(nextDay, 1);
  }

  // Fallback
  return zonedDate;
}

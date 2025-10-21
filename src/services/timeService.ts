/**
 * Time Service
 *
 * Centralized time and date handling using date-fns and date-fns-tz.
 * Replaces Luxon to reduce bundle size.
 *
 * ⚠️ CRITICAL: ALL FUNCTIONS IN THIS FILE USE DUBAI TIMEZONE (Asia/Dubai)
 *
 * The application must always use Dubai timezone because:
 * - Room schedules are based on Dubai time
 * - Server time may be different (UTC, local, etc.)
 * - Consistency across all time operations is essential
 *
 * Every function that returns or processes time automatically converts
 * to/from Dubai timezone to ensure correctness.
 */

import {
  format,
  parse,
  isAfter,
  isBefore,
  isEqual,
  addMinutes as addMinutesToDate,
  differenceInMinutes,
  startOfDay,
  getDay as getDateFnsDay,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { DUBAI_TIMEZONE } from "@/constants";

/**
 * Get current date and time in Dubai timezone
 * Note: Returns a UTC Date object - use formatInTimeZone for display
 *
 * @returns Date object (UTC-based, use with formatInTimeZone)
 */
export function getCurrentDubaiTime(): Date {
  return new Date();
}

/**
 * Get current time string in HH:mm format (Dubai timezone)
 *
 * @returns Time string (e.g., "14:30")
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  return formatInTimeZone(now, DUBAI_TIMEZONE, "HH:mm");
}

/**
 * Get current day name in Dubai timezone
 *
 * @returns Day name (e.g., "Monday")
 */
export function getCurrentDayName(): string {
  const now = new Date();
  return formatInTimeZone(now, DUBAI_TIMEZONE, "EEEE");
}

/**
 * Get day name for a specific date in Dubai timezone
 *
 * @param date - Date object
 * @returns Day name (e.g., "Monday")
 */
export function getDayNameInDubai(date: Date): string {
  return formatInTimeZone(date, DUBAI_TIMEZONE, "EEEE");
}

/**
 * Get time string for a specific date in Dubai timezone
 *
 * @param date - Date object
 * @returns Time string in HH:mm format (e.g., "14:30")
 */
export function getTimeStringInDubai(date: Date): string {
  return formatInTimeZone(date, DUBAI_TIMEZONE, "HH:mm");
}

/**
 * Add minutes to current time and return future Date
 * Properly handles timezone and day rollovers
 *
 * @param minutes - Number of minutes to add
 * @returns Future Date object
 */
export function addMinutesToCurrentTime(minutes: number): Date {
  const now = new Date();
  return addMinutesToDate(now, minutes);
}

/**
 * Get adjusted day index (Monday = 0, Sunday = 6)
 * This matches the university timetable format
 *
 * @param date - Optional date (defaults to current Dubai time)
 * @returns Day index (0 = Monday, 6 = Sunday)
 */
export function getAdjustedDayIndex(date?: Date): number {
  const targetDate = date || getCurrentDubaiTime();
  const dayIndex = getDateFnsDay(targetDate);
  // Convert Sunday (0) to 6, and shift Monday-Saturday (1-6) to 0-5
  return dayIndex === 0 ? 6 : dayIndex - 1;
}

/**
 * Parse time string (HH:mm) to Date object for comparison
 *
 * @param timeString - Time in HH:mm format
 * @returns Date object with time set
 */
export function parseTimeString(timeString: string): Date {
  const today = startOfDay(new Date());
  return parse(timeString, "HH:mm", today);
}

/**
 * Check if time A is before time B
 *
 * @param timeA - First time in HH:mm format
 * @param timeB - Second time in HH:mm format
 * @returns True if timeA is before timeB
 */
export function isTimeBefore(timeA: string, timeB: string): boolean {
  const dateA = parseTimeString(timeA);
  const dateB = parseTimeString(timeB);
  return isBefore(dateA, dateB);
}

/**
 * Check if time A is after time B
 *
 * @param timeA - First time in HH:mm format
 * @param timeB - Second time in HH:mm format
 * @returns True if timeA is after timeB
 */
export function isTimeAfter(timeA: string, timeB: string): boolean {
  const dateA = parseTimeString(timeA);
  const dateB = parseTimeString(timeB);
  return isAfter(dateA, dateB);
}

/**
 * Check if time A equals time B
 *
 * @param timeA - First time in HH:mm format
 * @param timeB - Second time in HH:mm format
 * @returns True if times are equal
 */
export function isTimeEqual(timeA: string, timeB: string): boolean {
  const dateA = parseTimeString(timeA);
  const dateB = parseTimeString(timeB);
  return isEqual(dateA, dateB);
}

/**
 * Check if current time is between start and end times
 *
 * @param startTime - Start time in HH:mm format
 * @param endTime - End time in HH:mm format
 * @param currentTime - Optional current time (defaults to now)
 * @returns True if current time is in range
 */
export function isCurrentTimeBetween(
  startTime: string,
  endTime: string,
  currentTime?: string,
): boolean {
  const current = currentTime || getCurrentTimeString();
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const now = parseTimeString(current);

  // Handle case where range crosses midnight
  if (isAfter(start, end)) {
    return isAfter(now, start) || isBefore(now, end);
  }

  return (
    (isAfter(now, start) || isEqual(now, start)) &&
    (isBefore(now, end) || isEqual(now, end))
  );
}

/**
 * Add minutes to a time string
 *
 * @param timeString - Time in HH:mm format
 * @param minutes - Number of minutes to add
 * @returns New time string in HH:mm format
 */
export function addMinutesToTime(timeString: string, minutes: number): string {
  const date = parseTimeString(timeString);
  const newDate = addMinutesToDate(date, minutes);
  return format(newDate, "HH:mm");
}

/**
 * Calculate difference in minutes between two times
 *
 * @param startTime - Start time in HH:mm format
 * @param endTime - End time in HH:mm format
 * @returns Difference in minutes
 */
export function getTimeDifferenceInMinutes(
  startTime: string,
  endTime: string,
): number {
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  return differenceInMinutes(end, start);
}

/**
 * Generate time slots for a range
 *
 * @param startTime - Start time in HH:mm format
 * @param endTime - End time in HH:mm format
 * @param intervalMinutes - Interval between slots
 * @returns Array of time strings
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 30,
): string[] {
  const slots: string[] = [];
  let current = parseTimeString(startTime);
  const end = parseTimeString(endTime);

  while (isBefore(current, end) || isEqual(current, end)) {
    slots.push(format(current, "HH:mm"));
    current = addMinutesToDate(current, intervalMinutes);
  }

  return slots;
}

/**
 * Format date to ISO string in Dubai timezone
 *
 * @param date - Date to format (can be UTC or already in Dubai TZ)
 * @returns ISO string in Dubai timezone
 */
export function formatDubaiDateToISO(date: Date): string {
  // Format the date directly in Dubai timezone
  // No need to call toZonedTime again if date is already in Dubai TZ
  return formatInTimeZone(date, DUBAI_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Parse ISO string to Date object
 *
 * @param isoString - ISO date string
 * @returns Date object
 */
export function parseDubaiISOString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Get a user-friendly relative time description
 *
 * @param minutes - Number of minutes
 * @returns Human-readable string (e.g., "30 minutes", "1 hour")
 */
export function getRelativeTimeDescription(minutes: number): string {
  if (minutes === 0) return "now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours !== 1 ? "s" : ""} and ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
}

/**
 * Format a date for display
 *
 * @param date - Date to format
 * @param formatString - Format string (date-fns format)
 * @returns Formatted date string
 */
export function formatDate(date: Date, formatString: string = "PPP"): string {
  return format(date, formatString);
}

/**
 * Get timezone information for debugging
 * Useful for verifying Dubai timezone is being used correctly
 *
 * @returns Object with timezone debug information
 *
 * @example
 * ```ts
 * const info = getTimezoneDebugInfo();
 * console.log(info);
 * // {
 * //   dubaiTime: "2024-01-15T14:30:00+04:00",
 * //   serverTime: "2024-01-15T10:30:00Z",
 * //   dubaiTimeString: "14:30",
 * //   dubaiDayName: "Monday",
 * //   timezone: "Asia/Dubai",
 * //   offset: "+04:00"
 * // }
 * ```
 */
export function getTimezoneDebugInfo(): {
  dubaiTime: string;
  serverTime: string;
  dubaiTimeString: string;
  dubaiDayName: string;
  timezone: string;
  offset: string;
} {
  const now = new Date();

  return {
    dubaiTime: formatDubaiDateToISO(now),
    serverTime: now.toISOString(),
    dubaiTimeString: getCurrentTimeString(),
    dubaiDayName: getCurrentDayName(),
    timezone: DUBAI_TIMEZONE,
    offset: formatInTimeZone(now, DUBAI_TIMEZONE, "XXX"),
  };
}

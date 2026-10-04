import { DateTime } from 'luxon';

// Pure, timezone-aware helpers for cut-off calculation (4.6).
// Kept dependency-free of Prisma/Nest so it's trivially unit-testable.

export interface CutoffInputs {
  deliveryDate: string; // "YYYY-MM-DD", kitchen-local calendar date
  cutoffDays: number; // number of kitchen working days before delivery
  cutoffTime: string; // "HH:mm", kitchen-local
  kitchenWorkingDays: number[]; // 0=Sun..6=Sat
  kitchenHolidays: string[]; // "YYYY-MM-DD" strings
  timezone: string; // IANA tz, e.g. "Asia/Kolkata"
}

function isKitchenWorkingDay(
  date: DateTime,
  workingDays: number[],
  holidays: string[],
): boolean {
  const weekday = date.weekday % 7; // Luxon: Mon=1..Sun=7 -> convert to Sun=0..Sat=6
  if (!workingDays.includes(weekday)) return false;
  const dateStr = date.toFormat('yyyy-MM-dd');
  return !holidays.includes(dateStr);
}

// Walks backward from the delivery date, skipping non-working/holiday days,
// counting `cutoffDays` kitchen working days back, then applies cutoffTime.
// Example: cutoff of 2 working days at 16:00, Wednesday delivery -> locks
// Monday 16:00 (skips the weekend entirely if Sat/Sun aren't working days).
export function calculateCutoffInstant(inputs: CutoffInputs): DateTime {
  const {
    deliveryDate,
    cutoffDays,
    cutoffTime,
    kitchenWorkingDays,
    kitchenHolidays,
    timezone,
  } = inputs;
  let cursor = DateTime.fromFormat(deliveryDate, 'yyyy-MM-dd', {
    zone: timezone,
  });

  let daysToSkip = cutoffDays;
  while (daysToSkip > 0) {
    cursor = cursor.minus({ days: 1 });
    if (isKitchenWorkingDay(cursor, kitchenWorkingDays, kitchenHolidays)) {
      daysToSkip -= 1;
    }
    // non-working/holiday days are skipped without decrementing (4.6)
  }

  const [hour, minute] = cutoffTime.split(':').map(Number);
  return cursor.set({ hour, minute, second: 0, millisecond: 0 });
}

export function isPastCutoff(
  inputs: CutoffInputs,
  now: DateTime = DateTime.now(),
): boolean {
  const cutoffInstant = calculateCutoffInstant(inputs);
  return now >= cutoffInstant;
}

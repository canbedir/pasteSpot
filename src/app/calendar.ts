import type { Slip } from './types';

/**
 * The desk's other axis.
 *
 * The zoomed-out view answers "which desk did I put it on"; this answers "what
 * did I write down on Tuesday". Both are ways of not having to remember the text
 * itself, which is the only thing search can use.
 *
 * Every boundary here is local time. Grouping by UTC would file a capture made at
 * half past midnight under the day before, which is precisely the day the person
 * would not look on.
 */

const pad = (value: number): string => `${value}`.padStart(2, '0');

/** `YYYY-MM-DD` in local time. Sorts lexically, which is why it is a string. */
export function dayKey(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DayCell {
  key: string;
  day: number;
}

/**
 * One month as a grid of weeks starting Monday, padded with nulls so the first
 * and last rows line up under the weekday headings.
 */
export function monthGrid(year: number, month: number): Array<DayCell | null> {
  // getDay() calls Sunday 0; the week here starts on Monday.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  const cells: Array<DayCell | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push({ key: `${year}-${pad(month + 1)}-${pad(day)}`, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** How many slips were captured on each day. */
export function countByDay(slips: readonly Slip[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slip of slips) {
    const key = dayKey(slip.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface Month {
  year: number;
  month: number;
}

/** Months that hold anything, newest first. Empty months are not worth paging through. */
export function monthsWithSlips(slips: readonly Slip[]): Month[] {
  const seen = new Set<string>();
  const months: Month[] = [];

  for (const slip of slips) {
    const date = new Date(slip.createdAt);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    months.push({ year: date.getFullYear(), month: date.getMonth() });
  }

  return months.sort((a, b) => b.year - a.year || b.month - a.month);
}

/** The slips captured on one day, oldest first so the day reads as it happened. */
export function slipsOnDay(slips: readonly Slip[], key: string): Slip[] {
  return slips
    .filter((slip) => dayKey(slip.createdAt) === key)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Step a month by whole months, rolling the year over. */
export function shiftMonth({ year, month }: Month, delta: number): Month {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

// src/lib/timeline/scrub.ts
// Pure math for the scrub cursor (interactions spec §6.3): a date from a
// pointer fraction, keyboard steps, the slider's day index, and the two hash
// shapes the home page deep-links with. UTC throughout, no DOM.
import type { Window } from "./layout.js";

const DAY_MS = 86_400_000;

const floorToDay = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

/**
 * `fraction` of the window, clamped. Always a UTC midnight: the day the
 * fraction lands in, never earlier than the window's first whole day (a window
 * that starts mid-day rounds up), so the date round-trips through `#on-` hashes.
 */
export function dateAt(fraction: number, win: Window): Date {
  const f = Math.min(1, Math.max(0, fraction));
  const t = win.from.getTime() + f * (win.to.getTime() - win.from.getTime());
  const firstDay = Math.ceil(win.from.getTime() / DAY_MS) * DAY_MS;
  return new Date(Math.max(firstDay, floorToDay(t)));
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * One month or one year in either direction, keeping the day of the month and
 * falling back to the last day of a shorter month; clamped to the whole days
 * inside `bounds`. Always a UTC midnight.
 */
export function stepDate(date: Date, unit: "month" | "year", direction: -1 | 1, bounds: Window): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  let ny = y;
  let nm = m;
  if (unit === "year") {
    ny = y + direction;
  } else {
    const total = m + direction;
    ny = y + Math.floor(total / 12);
    nm = ((total % 12) + 12) % 12;
  }
  const target = Date.UTC(ny, nm, Math.min(day, daysIn(ny, nm)));
  const lo = Math.ceil(bounds.from.getTime() / DAY_MS) * DAY_MS;
  const hi = floorToDay(bounds.to.getTime());
  return new Date(Math.min(hi, Math.max(lo, target)));
}

/** Whole days from `win.from` to `date`, for aria-valuenow. */
export function dayIndex(date: Date, win: Window): number {
  return Math.floor((date.getTime() - win.from.getTime()) / DAY_MS);
}

export type DeepLink = { kind: "item"; id: string } | { kind: "on"; date: Date };

/** `#item-<slug>` or `#on-YYYY-MM-DD`; anything else, including an impossible date, is null. */
export function parseHash(hash: string): DeepLink | null {
  const item = hash.match(/^#item-([a-z0-9-]+)$/);
  if (item) return { kind: "item", id: item[1] };
  const on = hash.match(/^#on-(\d{4})-(\d{2})-(\d{2})$/);
  if (!on) return null;
  const [y, m, day] = [Number(on[1]), Number(on[2]), Number(on[3])];
  const date = new Date(Date.UTC(y, m - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
  return { kind: "on", date };
}

/** "#on-2024-06-15" */
export function hashFor(date: Date): string {
  return `#on-${date.toISOString().slice(0, 10)}`;
}

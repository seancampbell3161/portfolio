// src/lib/dates.ts
// Every content date is UTC midnight, so every formatter reads UTC fields
// (writing spec §11). Month names are spelled out here rather than taken from
// Intl so the output is identical on every machine and Node build.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "1 September 2026" */
export function longDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "01 Sep" */
export function shortDay(d: Date): string {
  return `${pad2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "01 Sep 2026" */
export function shortDate(d: Date): string {
  return `${shortDay(d)} ${d.getUTCFullYear()}`;
}

/** "Sep 2026" */
export function monthYear(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Sep 2, 2026" */
export function monthDayYear(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "2026-09-01", for <time datetime>. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

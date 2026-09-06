// src/lib/reading.ts
// Reading progress through a page's body (interactions 4): the math behind the
// line at the transport bar's bottom edge. Pure: no DOM, so Vitest loads it
// and src/scripts/reader.ts feeds it measurements.

/** One measurement of the page, in CSS pixels; top and bottom are document coordinates of the body. */
export interface ReadingFrame {
  scrollY: number;
  /** window.innerHeight */
  viewport: number;
  /** Height of the fixed transport bar: the reader's eyeline starts under it. */
  bar: number;
  top: number;
  bottom: number;
}

/**
 * How far the reader is through the body, from 0 to 1, or null when the body
 * is no taller than the viewport (a page that fits on one screen has nothing
 * to progress through, so no line is shown).
 *
 * Reading starts at the scroll offset that puts the body's first line under
 * the bar, and ends at the offset that brings its last line into the viewport;
 * the value is the scroll position's place between those two, clamped. The
 * start never goes below 0: a body that already sits under the bar at load
 * starts at the page top. The end is always past the start once the body is
 * taller than the viewport, so the division is safe.
 */
export function readingProgress(frame: ReadingFrame): number | null {
  const { scrollY, viewport, bar, top, bottom } = frame;
  if (bottom - top <= viewport) return null;
  const start = Math.max(0, top - bar);
  const end = bottom - viewport;
  return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
}

import { describe, it, expect } from "vitest";
import { readingProgress } from "../reading.js";

// Fixtures are pixel measurements of the built pages at 1280x900 with the
// 61px transport bar (interactions 4): document coordinates for the top and
// bottom of the essay body.
const io = { viewport: 900, bar: 61, top: 372, bottom: 2222 }; // io-multiplexing
const daw = { viewport: 900, bar: 61, top: 323, bottom: 459 }; // daw-engine case study

describe("readingProgress (interactions 4)", () => {
  it("is null when the body is no taller than the viewport, so short pages show no line", () => {
    expect(readingProgress({ scrollY: 0, ...daw })).toBeNull();
    // Roaming.Camp on a 720px viewport: the body is exactly one screen tall.
    expect(readingProgress({ scrollY: 500, viewport: 720, bar: 61, top: 824, bottom: 1544 })).toBeNull();
  });

  it("is 0 until the body's first line passes under the bar", () => {
    expect(readingProgress({ scrollY: 0, ...io })).toBe(0);
    expect(readingProgress({ scrollY: 311, ...io })).toBe(0);
  });

  it("reaches 1 when the body's last line enters the viewport and stays there", () => {
    expect(readingProgress({ scrollY: 1322, ...io })).toBe(1);
    expect(readingProgress({ scrollY: 2000, ...io })).toBe(1);
  });

  it("is linear between the two", () => {
    expect(readingProgress({ scrollY: 816.5, ...io })).toBeCloseTo(0.5, 6);
  });

  it("starts at the page top when the body already sits under the bar at load", () => {
    const tight = { viewport: 900, bar: 61, top: 40, bottom: 2000 };
    expect(readingProgress({ scrollY: 0, ...tight })).toBe(0);
    expect(readingProgress({ scrollY: 550, ...tight })).toBeCloseTo(0.5, 6);
    expect(readingProgress({ scrollY: 1100, ...tight })).toBe(1);
  });
});

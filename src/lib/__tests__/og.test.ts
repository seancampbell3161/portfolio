import { describe, it, expect } from "vitest";
import { OG_SHOTS, DEFAULT_BASE_URL, ogImagePath, outputFile } from "../og.mjs";

describe("og config", () => {
  it("derives the public meta path from a name", () => {
    expect(ogImagePath("roadmap")).toBe("/og/roadmap.png");
  });

  it("derives the repo output path from a name", () => {
    expect(outputFile("home")).toBe("public/og/home.png");
  });

  it("defaults to an absolute https production base url", () => {
    expect(DEFAULT_BASE_URL).toMatch(/^https:\/\/[^/]+$/);
  });

  it("has a home shot, absolute routes, and filename-safe unique names", () => {
    expect(OG_SHOTS.length).toBeGreaterThan(0);
    for (const shot of OG_SHOTS) {
      expect(shot.route.startsWith("/")).toBe(true);
      expect(shot.name).toMatch(/^[a-z0-9-]+$/);
    }
    const names = OG_SHOTS.map((s) => s.name);
    expect(names).toContain("home");
    expect(new Set(names).size).toBe(names.length);
  });
});

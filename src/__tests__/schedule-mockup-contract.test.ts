// roadmap/roadmap-schedule.html is a hand-maintained design artifact that
// prints the same plan src/data/roadmap.ts derives. They drifted badly once —
// by months, with OSTEP dated to start after the chapters it explains, and
// nothing caught it. This test is what catches it now.
//
// It reads a repo source file, not dist/, so it needs no build.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { phases } from "../data/roadmap";
import { weekStart, weekEnd } from "../lib/roadmap/weeks";
import { phaseSpanText } from "../lib/roadmap/schedule";
import { monthDayYear } from "../lib/dates";

const html = readFileSync("roadmap/roadmap-schedule.html", "utf8");

describe("the schedule mockup still agrees with the derived plan", () => {
  // The ramp's card reads "Week 0 · complete" and carries no dates.
  const dated = phases.filter((p) => p.id !== "ramp");

  it.each(dated.map((p) => [p.id, p] as const))("phase %s prints its derived dates", (_id, p) => {
    // phaseSpanText is the one definition of this form — the band prints it too.
    const expected = phaseSpanText(p);
    expect(html, `mockup is missing: ${expected}`).toContain(expected);
  });

  it("prints the full span in the masthead chip and the footer", () => {
    const from = monthDayYear(weekStart(1));
    const to = monthDayYear(weekEnd(22));
    expect(html, "masthead chip").toContain(`${from} → ${to}`);
    expect(html, "footer").toContain(`${from} – ${to}`);
  });

  it("states the plan's real length", () => {
    // Week 0 plus weeks 1–22.
    expect(html).toContain("23-week");
    expect(html).not.toContain("24-week");
  });
});

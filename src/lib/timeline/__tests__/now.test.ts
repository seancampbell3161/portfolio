import { describe, it, expect } from "vitest";
import { nowText, rightNow } from "../now.js";
import type { TimelineItem } from "../types.js";

const d = (s: string) => new Date(s);
const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
  title: o.id,
  status: "done",
  href: `/#item-${o.id}`,
  ...o,
});
const now = d("2026-09-05");

describe("nowText (interactions 2)", () => {
  it("speaks a span as since its start month, whatever its end", () => {
    const open = item({ id: "daw", lane: "building", start: d("2026-06-01"), kind: "span", status: "in-progress" });
    const dated = item({ id: "thread", lane: "learning", start: d("2026-01-01"), end: d("2027-06-30"), kind: "span", status: "in-progress" });
    expect(nowText(open)).toBe("since June 2026");
    expect(nowText(dated)).toBe("since January 2026");
  });
  it("speaks a moment as its day without the year", () => {
    expect(nowText(item({ id: "essay", lane: "writing", start: d("2026-09-01"), kind: "moment" }))).toBe("1 September");
  });
});

describe("rightNow (interactions 2)", () => {
  const essay = item({ id: "essay", lane: "writing", start: d("2026-09-01"), kind: "moment" });
  const old = item({ id: "old-essay", lane: "writing", start: d("2026-07-22"), kind: "moment" });
  const daw = item({ id: "daw", lane: "building", start: d("2026-06-01"), kind: "span", status: "in-progress" });
  // Live, but its build ended: not "right now" by the timeline's own rule.
  const shipped = item({ id: "shipped", lane: "building", start: d("2025-03-01"), end: d("2026-06-30"), kind: "span", status: "live" });
  const reading = item({ id: "reading", lane: "learning", start: d("2026-01-01"), end: d("2027-10-31"), kind: "span", status: "in-progress" });
  const build = item({ id: "build", lane: "learning", start: d("2026-06-01"), end: d("2027-08-31"), kind: "span", status: "in-progress" });
  const talk = item({ id: "talk", lane: "community", start: d("2026-09-03"), kind: "moment" });
  const all = [talk, build, reading, shipped, daw, old, essay];

  it("groups today's items into rows in lane order, entries by start", () => {
    expect(rightNow(all, now).map((r) => [r.lane, r.entries.map((e) => e.id)])).toEqual([
      ["writing", ["essay"]],
      ["building", ["daw"]],
      ["learning", ["reading", "build"]],
      ["community", ["talk"]],
    ]);
  });
  it("drops a lane with nothing today", () => {
    expect(rightNow([daw, old, shipped], now).map((r) => r.lane)).toEqual(["building"]);
  });
  it("is empty when nothing touches today", () => {
    expect(rightNow([old, shipped], now)).toEqual([]);
  });
});

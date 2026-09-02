import { describe, it, expect } from "vitest";
import type { TimelineItem, Lane, Status } from "../types.js";
import { deriveKind } from "../types.js";
import {
  windowFor,
  fraction,
  positionIn,
  packRows,
  packLane,
  estimateLabelWidth,
  DOT_WIDTH,
  ticksFor,
  laneSummary,
  graphLayout,
} from "../layout.js";

const d = (s: string) => new Date(s);
const NOW = d("2026-09-02T12:00:00Z");

function mk(
  id: string,
  lane: Lane,
  start: string,
  opts: { end?: string; status?: Status; title?: string; subtitle?: string } = {},
): TimelineItem {
  const status = opts.status ?? "done";
  const end = opts.end ? d(opts.end) : undefined;
  return {
    id,
    lane,
    title: opts.title ?? id,
    subtitle: opts.subtitle,
    start: d(start),
    end,
    status,
    href: `/#item-${id}`,
    kind: deriveKind(status, end),
    body: { lane: "community", org: "x", description: "x" },
  };
}

describe("windowFor", () => {
  it("year is Jan 1 to Dec 31 of now's year", () => {
    const w = windowFor("year", NOW, []);
    expect(w.from).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(w.to.getUTCFullYear()).toBe(2026);
    expect(w.to.getUTCMonth()).toBe(11);
    expect(w.to.getUTCDate()).toBe(31);
  });
  it("three-years starts three years before now and ends Dec 31", () => {
    const w = windowFor("three-years", NOW, []);
    expect(w.from.getUTCFullYear()).toBe(2023);
    expect(w.from.getUTCMonth()).toBe(8);
    expect(w.to.getUTCFullYear()).toBe(2026);
  });
  it("all starts at the earliest item and falls back to Jan 1 with no items", () => {
    const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
    expect(windowFor("all", NOW, items).from).toEqual(d("2021-01-15"));
    expect(windowFor("all", NOW, []).from).toEqual(new Date(Date.UTC(2026, 0, 1)));
  });
});

describe("fraction and positionIn", () => {
  const w = windowFor("year", NOW, []);
  it("fraction is 0 at from and about 1 at to", () => {
    expect(fraction(w.from, w)).toBe(0);
    expect(fraction(w.to, w)).toBeCloseTo(1, 5);
  });
  it("a moment has zero width at its date", () => {
    const p = positionIn(mk("e", "writing", "2026-07-01"), w, NOW)!;
    expect(p.w).toBe(0);
    expect(p.x).toBeCloseTo(181 / 365, 2);
  });
  it("a span with an end has width end minus start", () => {
    const p = positionIn(mk("p", "building", "2026-01-01", { end: "2026-07-01", status: "live" }), w, NOW)!;
    expect(p.x).toBe(0);
    expect(p.w).toBeCloseTo(181 / 365, 2);
  });
  it("an in-progress span with no end runs to now", () => {
    const p = positionIn(mk("q", "building", "2026-06-01", { status: "in-progress" }), w, NOW)!;
    expect(p.x + p.w).toBeCloseTo(fraction(NOW, w), 5);
  });
  it("clamps a span that starts before the window", () => {
    const p = positionIn(mk("r", "learning", "2025-01-01", { end: "2026-03-01" }), w, NOW)!;
    expect(p.x).toBe(0);
    expect(p.w).toBeCloseTo(fraction(d("2026-03-01"), w), 5);
  });
  it("excludes items entirely outside the window", () => {
    expect(positionIn(mk("s", "writing", "2025-12-21"), w, NOW)).toBeNull();
    expect(positionIn(mk("t", "writing", "2027-01-05"), w, NOW)).toBeNull();
  });
});

describe("packRows", () => {
  const w = windowFor("year", NOW, []);
  const est = estimateLabelWidth(1040);
  const place = (items: TimelineItem[]) =>
    items.map((i) => positionIn(i, w, NOW)!).filter(Boolean);

  it("puts non-overlapping spans on one row", () => {
    const rows = packRows(
      place([
        mk("a", "building", "2026-01-01", { end: "2026-03-01" }),
        mk("b", "building", "2026-04-01", { end: "2026-06-01" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.row)).toEqual([0, 0]);
  });
  it("puts overlapping spans on separate rows, earliest first", () => {
    const rows = packRows(
      place([
        mk("b", "building", "2026-04-01", { end: "2026-09-01" }),
        mk("a", "building", "2026-01-01", { end: "2026-06-01" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("two moments on the same day take two rows", () => {
    const rows = packRows(place([mk("a", "writing", "2026-05-01"), mk("b", "writing", "2026-05-01")]), est);
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("a moment reserves its label width so a close neighbour moves down", () => {
    const rows = packRows(
      place([
        mk("a", "writing", "2026-05-01", { title: "A fairly long essay title" }),
        mk("b", "writing", "2026-05-08", { title: "Another" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("a moment far enough away shares the row", () => {
    const rows = packRows(place([mk("a", "writing", "2026-01-01"), mk("b", "writing", "2026-09-01")]), est);
    expect(rows.map((r) => r.row)).toEqual([0, 0]);
  });
  it("demotes the oldest moments to bare dots until three rows suffice", () => {
    const items = [
      mk("a", "writing", "2026-05-01", { title: "Creative Frontend Designs With AI" }),
      mk("b", "writing", "2026-05-03", { title: "Composition Over Inheritance in Angular" }),
      mk("c", "writing", "2026-05-05", { title: "No One Cares About Your Work" }),
      mk("d", "writing", "2026-05-07", { title: "How Apps Like Redis Are So Efficient" }),
    ];
    const rows = packRows(place(items), est, 3);
    expect(Math.max(...rows.map((r) => r.row))).toBeLessThan(3);
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r]));
    expect(byId.a.labeled).toBe(false);
    expect(byId.d.labeled).toBe(true);
  });
  it("never demotes spans", () => {
    const items = [0, 1, 2, 3].map((i) =>
      mk(`s${i}`, "building", "2026-01-01", { end: "2026-08-01", status: "done" }),
    );
    const rows = packRows(place(items), est, 3);
    expect(rows.every((r) => r.labeled)).toBe(true);
    expect(Math.max(...rows.map((r) => r.row))).toBe(3);
  });
  it("DOT_WIDTH is a small fraction", () => {
    expect(DOT_WIDTH).toBeGreaterThan(0);
    expect(DOT_WIDTH).toBeLessThan(0.05);
  });
});

describe("packLane", () => {
  it("filters to one lane and to the window", () => {
    const w = windowFor("year", NOW, []);
    const items = [
      mk("a", "writing", "2026-05-01"),
      mk("b", "building", "2026-05-01", { end: "2026-06-01" }),
      mk("c", "writing", "2025-05-01"),
    ];
    const rows = packLane(items, "writing", w, NOW, estimateLabelWidth());
    expect(rows.map((r) => r.item.id)).toEqual(["a"]);
  });
});

describe("ticksFor", () => {
  it("year: twelve month ticks starting at 0", () => {
    const w = windowFor("year", NOW, []);
    const t = ticksFor("year", w);
    expect(t).toHaveLength(12);
    expect(t[0]).toEqual({ label: "Jan", x: 0 });
    expect(t[11].label).toBe("Dec");
    expect(t[6].x).toBeCloseTo(181 / 365, 2);
  });
  it("three-years: first tick is the quarter containing from, then every quarter", () => {
    const w = windowFor("three-years", NOW, []);
    const t = ticksFor("three-years", w);
    expect(t[0]).toEqual({ label: "Q3 2023", x: 0 });
    expect(t[1].label).toBe("Q4 2023");
    expect(t[t.length - 1].label).toBe("Q4 2026");
  });
  it("all: first tick is from's year at 0, then each January", () => {
    const w = windowFor("all", NOW, [mk("a", "learning", "2021-01-15")]);
    const t = ticksFor("all", w);
    expect(t.map((x) => x.label)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(t[0].x).toBe(0);
    expect(t[1].x).toBeGreaterThan(0);
  });
});

describe("laneSummary", () => {
  const w = windowFor("year", NOW, []);
  it("counts essays", () => {
    const items = [mk("a", "writing", "2026-05-01"), mk("b", "writing", "2026-07-01"), mk("z", "writing", "2025-01-01")];
    expect(laneSummary("writing", items, w, NOW)).toBe("2 essays");
    expect(laneSummary("writing", items.slice(0, 1), w, NOW)).toBe("1 essay");
  });
  it("describes building by status", () => {
    const items = [
      mk("a", "building", "2026-01-01", { end: "2026-06-01", status: "live" }),
      mk("b", "building", "2026-06-01", { status: "in-progress" }),
    ];
    expect(laneSummary("building", items, w, NOW)).toBe("1 live, 1 in progress");
  });
  it("says nothing yet for an empty lane", () => {
    expect(laneSummary("community", [], w, NOW)).toBe("nothing yet");
  });
  it("counts learning in progress and community appearances", () => {
    expect(laneSummary("learning", [mk("a", "learning", "2026-01-01", { status: "in-progress" })], w, NOW)).toBe("1 in progress");
    expect(laneSummary("community", [mk("a", "community", "2026-03-01"), mk("b", "community", "2026-08-01")], w, NOW)).toBe("2 appearances");
  });
});

describe("graphLayout", () => {
  const w = windowFor("year", NOW, []);
  const items = [
    mk("roaming", "building", "2026-01-01", { end: "2026-06-30", status: "live" }),
    mk("ddia", "learning", "2026-01-01", { status: "in-progress" }),
    mk("talk1", "community", "2026-03-01"),
    mk("frontend", "writing", "2026-05-16"),
    mk("daw", "building", "2026-06-01", { status: "in-progress" }),
    mk("redis", "learning", "2026-06-01", { status: "in-progress" }),
    mk("redis-essay", "writing", "2026-07-22"),
    mk("wont-stop", "writing", "2026-09-01"),
  ];
  const g = graphLayout(items, w, NOW);

  it("orders rows by start then id", () => {
    expect(g.rows.map((r) => r.id)).toEqual([
      "ddia", "roaming", "talk1", "frontend", "daw", "redis", "redis-essay", "wont-stop",
    ]);
  });
  it("puts the now line after the last row that has started", () => {
    expect(g.nowRow).toBe(8);
  });
  it("draws a finished span down to the last row starting on or before its end", () => {
    const roaming = g.bars.find((b) => b.id === "roaming")!;
    expect(roaming.fromRow).toBe(1);
    expect(roaming.toRow).toBe(5); // redis starts 2026-06-01, before the 06-30 end
  });
  it("draws an ongoing span to the now line", () => {
    expect(g.bars.find((b) => b.id === "daw")!.toRow).toBeNull();
  });
  it("gives concurrent spans in one lane different slots", () => {
    expect(g.bars.find((b) => b.id === "ddia")!.slot).toBe(0);
    expect(g.bars.find((b) => b.id === "redis")!.slot).toBe(1);
    expect(g.bars.find((b) => b.id === "roaming")!.slot).toBe(0);
    expect(g.bars.find((b) => b.id === "daw")!.slot).toBe(1);
  });
  it("lists moments as dots with their row", () => {
    expect(g.dots.find((x) => x.id === "wont-stop")!.row).toBe(7);
  });
  it("excludes items outside the window", () => {
    const g2 = graphLayout([...items, mk("old", "writing", "2025-01-01")], w, NOW);
    expect(g2.rows.some((r) => r.id === "old")).toBe(false);
  });
});

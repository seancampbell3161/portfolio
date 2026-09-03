import { describe, it, expect } from "vitest";
import { readingMinutes, sortEssays, indexRows, segmentRows, writtenWhile } from "../track.js";
import type { Essay, TrackRow } from "../track.js";
import type { TimelineItem } from "../types.js";

const d = (s: string) => new Date(s);
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/** Short form of a row list for assertions: essay ids (starred when current), more labels, other kinds. */
const shape = (rows: TrackRow[]) =>
  rows.map((r) => {
    if (r.kind === "essay") return `${r.id}${r.current ? "*" : ""}`;
    if (r.kind === "more") return r.label;
    if (r.kind === "year") return r.label;
    return r.kind;
  });

const essays: Essay[] = [
  { id: "essay-b", href: "/blog/b", title: "B", date: d("2026-07-22"), description: "About B", tags: ["Redis"], minutes: 3 },
  { id: "essay-c", href: "/blog/c", title: "C", date: d("2026-09-01"), minutes: 5 },
  { id: "essay-a", href: "/blog/a", title: "A", date: d("2025-12-30"), minutes: 7 },
];

describe("readingMinutes (spec §10)", () => {
  it("floors at one minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("   \n ")).toBe(1);
  });
  it("rounds to the nearest minute at 220 words per minute", () => {
    expect(readingMinutes(words(330))).toBe(2);
    expect(readingMinutes(words(110))).toBe(1);
    expect(readingMinutes(words(1100))).toBe(5);
  });
  it("counts runs of whitespace as one separator", () => {
    expect(readingMinutes("one  two\n\nthree ")).toBe(1);
  });
});

describe("sortEssays", () => {
  it("sorts newest first and breaks ties by id", () => {
    const tie: Essay[] = [
      { id: "essay-z", href: "/blog/z", title: "Z", date: d("2026-01-01") },
      { id: "essay-y", href: "/blog/y", title: "Y", date: d("2026-01-01") },
      { id: "essay-x", href: "/blog/x", title: "X", date: d("2026-02-01") },
    ];
    expect(sortEssays(tie).map((e) => e.id)).toEqual(["essay-x", "essay-y", "essay-z"]);
  });
  it("does not mutate its input", () => {
    const copy = [...essays];
    sortEssays(essays);
    expect(essays).toEqual(copy);
  });
});

describe("indexRows (spec §6)", () => {
  const rows = indexRows(essays, d("2026-09-02"));

  it("starts with a now row carrying the build date", () => {
    expect(rows[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("orders essays newest first with a year row before the first essay of each year", () => {
    expect(shape(rows)).toEqual(["now", "2026", "essay-c", "essay-b", "2025", "essay-a"]);
  });
  it("carries the index fields on essay rows", () => {
    expect(rows[3]).toEqual({
      kind: "essay",
      id: "essay-b",
      href: "/blog/b",
      title: "B",
      date: d("2026-07-22"),
      minutes: 3,
      description: "About B",
      tags: ["Redis"],
    });
  });
  it("uses the UTC year for year rows", () => {
    // 2025-12-31T23:30Z is still 2025 in UTC even though it is 2026 east of UTC+0:30.
    const late: Essay[] = [{ id: "essay-l", href: "/blog/l", title: "L", date: d("2025-12-31T23:30:00Z") }];
    expect(shape(indexRows(late, d("2026-09-02")))).toEqual(["now", "2025", "essay-l"]);
  });
  it("yields only the now row when there are no essays", () => {
    expect(indexRows([], d("2026-09-02"))).toEqual([{ kind: "now", label: "Sep 2, 2026" }]);
  });
});

describe("segmentRows (spec §7)", () => {
  const now = d("2026-09-02");
  const five: Essay[] = [
    { id: "essay-a", href: "/blog/a", title: "A", date: d("2025-12-21") },
    { id: "essay-b", href: "/blog/b", title: "B", date: d("2025-12-30") },
    { id: "essay-c", href: "/blog/c", title: "C", date: d("2026-05-16") },
    { id: "essay-d", href: "/blog/d", title: "D", date: d("2026-07-22") },
    { id: "essay-e", href: "/blog/e", title: "E", date: d("2026-09-01") },
  ];

  it("newest essay: now head, itself, the older neighbour, an older tail", () => {
    expect(shape(segmentRows(five, "essay-e", now))).toEqual(["now", "essay-e*", "essay-d", "3 older, all essays"]);
    expect(segmentRows(five, "essay-e", now)[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("second essay: singular newer head", () => {
    expect(shape(segmentRows(five, "essay-d", now))).toEqual([
      "1 newer, all essays", "essay-e", "essay-d*", "essay-c", "2 older, all essays",
    ]);
  });
  it("middle essay: both neighbours and both counts", () => {
    expect(shape(segmentRows(five, "essay-c", now))).toEqual([
      "2 newer, all essays", "essay-d", "essay-c*", "essay-b", "1 older, all essays",
    ]);
  });
  it("oldest essay: newer head, the newer neighbour, itself, no tail", () => {
    expect(shape(segmentRows(five, "essay-a", now))).toEqual(["4 newer, all essays", "essay-b", "essay-a*"]);
  });
  it("a single essay: now and itself", () => {
    expect(shape(segmentRows([five[0]], "essay-a", now))).toEqual(["now", "essay-a*"]);
  });
  it("more rows link to the index", () => {
    const rows = segmentRows(five, "essay-c", now);
    expect(rows[0]).toEqual({ kind: "more", label: "2 newer, all essays", href: "/blog" });
    expect(rows[4]).toEqual({ kind: "more", label: "1 older, all essays", href: "/blog" });
  });
  it("segment essay rows carry id, href, title, date only", () => {
    const rich: Essay[] = [{ ...five[4], description: "x", tags: ["t"], minutes: 9 }];
    expect(segmentRows(rich, "essay-e", now)[1]).toEqual({
      kind: "essay", id: "essay-e", href: "/blog/e", title: "E", date: d("2026-09-01"), current: true,
    });
  });
  it("throws for an unknown id", () => {
    expect(() => segmentRows(five, "essay-zzz", now)).toThrow("Unknown essay: essay-zzz");
  });
});

describe("writtenWhile (spec §8)", () => {
  const now = d("2026-09-02");
  const published = d("2026-09-01");

  const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
    title: o.id,
    status: "done",
    href: `/#item-${o.id}`,
    ...o,
  });

  const daw = item({ id: "daw-engine", lane: "building", start: d("2026-06-01"), kind: "span", status: "in-progress" });
  const roaming = item({ id: "roaming-camp", lane: "building", start: d("2025-03-01"), end: d("2026-06-30"), kind: "span", status: "live" });
  const endsDayBefore = item({ id: "ends-before", lane: "building", start: d("2026-01-01"), end: d("2026-08-31"), kind: "span" });
  const ddia = item({ id: "ddia", lane: "learning", start: d("2026-01-10"), kind: "span", status: "in-progress" });
  const planned = item({ id: "planned", lane: "learning", start: d("2026-10-01"), end: d("2026-12-01"), kind: "span", status: "planned" });
  const talk14before = item({ id: "talk-14-before", lane: "community", start: d("2026-08-18"), kind: "moment" });
  const talk15before = item({ id: "talk-15-before", lane: "community", start: d("2026-08-17"), kind: "moment" });
  const talk14after = item({ id: "talk-14-after", lane: "community", start: d("2026-09-15"), kind: "moment" });
  const essay = item({ id: "essay-other", lane: "writing", start: d("2026-09-01"), kind: "moment", href: "/blog/other" });

  const all = [essay, talk14after, talk15before, talk14before, planned, ddia, endsDayBefore, roaming, daw];

  it("includes spans that contain the date, including in-progress spans with no end", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toContain("daw-engine");
    expect(ids).toContain("ddia");
  });
  it("excludes spans that ended before the date or start after it", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).not.toContain("roaming-camp");
    expect(ids).not.toContain("ends-before");
    expect(ids).not.toContain("planned");
  });
  it("treats a span's start and end as inclusive", () => {
    expect(writtenWhile([roaming], d("2026-06-30"), now).map((i) => i.id)).toEqual(["roaming-camp"]);
    expect(writtenWhile([roaming], d("2025-03-01"), now).map((i) => i.id)).toEqual(["roaming-camp"]);
  });
  it("includes moments within 14 days either side, inclusive, and excludes the 15th day", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toContain("talk-14-before");
    expect(ids).toContain("talk-14-after");
    expect(ids).not.toContain("talk-15-before");
  });
  it("never includes the writing lane", () => {
    expect(writtenWhile(all, published, now).map((i) => i.lane)).not.toContain("writing");
  });
  it("orders building, learning, community, then by start, then by id", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toEqual(["daw-engine", "ddia", "talk-14-before", "talk-14-after"]);
    const both = writtenWhile([daw, roaming], d("2026-06-15"), now).map((i) => i.id);
    expect(both).toEqual(["roaming-camp", "daw-engine"]);
  });
  it("returns an empty list when nothing overlaps", () => {
    expect(writtenWhile(all, d("2020-01-01"), now)).toEqual([]);
  });
  it("uses now as the end of an in-progress span", () => {
    // Published after now: the span has not reached the date yet.
    expect(writtenWhile([daw], d("2026-09-01"), d("2026-08-15"))).toEqual([]);
    expect(writtenWhile([daw], d("2026-08-15"), d("2026-08-15")).map((i) => i.id)).toEqual(["daw-engine"]);
  });
  it("breaks ties within a lane by id", () => {
    const b = item({ id: "talk-b", lane: "community", start: d("2026-09-01"), kind: "moment" });
    const a = item({ id: "talk-a", lane: "community", start: d("2026-09-01"), kind: "moment" });
    expect(writtenWhile([b, a], published, now).map((i) => i.id)).toEqual(["talk-a", "talk-b"]);
  });
});

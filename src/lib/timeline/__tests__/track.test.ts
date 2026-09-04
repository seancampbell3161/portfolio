import { describe, it, expect } from "vitest";
import {
  readingMinutes, sortEntries, indexRows, segmentRows, writtenWhile, during, rangeText, whenText,
} from "../track.js";
import type { TrackEntry, TrackRow, TrackIndex } from "../track.js";
import type { TimelineItem } from "../types.js";

const d = (s: string) => new Date(s);
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/** Short form of a row list for assertions: entry ids (starred when current), labels for other kinds. */
const shape = (rows: TrackRow[]) =>
  rows.map((r) => {
    if (r.kind === "entry") return `${r.id}${r.current ? "*" : ""}`;
    if (r.kind === "more") return r.label;
    if (r.kind === "year") return r.label;
    return r.kind;
  });

const ESSAYS: TrackIndex = { href: "/blog", noun: "essays" };

const essays: TrackEntry[] = [
  { id: "essay-b", href: "/blog/b", title: "B", start: d("2026-07-22"), status: "done", description: "About B", tags: ["Redis"], minutes: 3 },
  { id: "essay-c", href: "/blog/c", title: "C", start: d("2026-09-01"), status: "done", minutes: 5 },
  { id: "essay-a", href: "/blog/a", title: "A", start: d("2025-12-30"), status: "done", minutes: 7 },
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

describe("sortEntries", () => {
  it("sorts newest first and breaks ties by id", () => {
    const tie: TrackEntry[] = [
      { id: "essay-z", href: "/blog/z", title: "Z", start: d("2026-01-01"), status: "done" },
      { id: "essay-y", href: "/blog/y", title: "Y", start: d("2026-01-01"), status: "done" },
      { id: "essay-x", href: "/blog/x", title: "X", start: d("2026-02-01"), status: "done" },
    ];
    expect(sortEntries(tie).map((e) => e.id)).toEqual(["essay-x", "essay-y", "essay-z"]);
  });
  it("does not mutate its input", () => {
    const copy = [...essays];
    sortEntries(essays);
    expect(essays).toEqual(copy);
  });
});

describe("indexRows (spec §6)", () => {
  const rows = indexRows(essays, d("2026-09-02"));

  it("starts with a now row carrying the build date", () => {
    expect(rows[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("orders entries newest first with a year row before the first entry of each year", () => {
    expect(shape(rows)).toEqual(["now", "2026", "essay-c", "essay-b", "2025", "essay-a"]);
  });
  it("carries the index fields on entry rows", () => {
    expect(rows[3]).toEqual({
      kind: "entry",
      id: "essay-b",
      href: "/blog/b",
      title: "B",
      start: d("2026-07-22"),
      status: "done",
      minutes: 3,
      description: "About B",
      tags: ["Redis"],
    });
  });
  it("uses the UTC year for year rows", () => {
    // 2025-12-31T23:30Z is still 2025 in UTC even though it is 2026 east of UTC+0:30.
    const late: TrackEntry[] = [{ id: "essay-l", href: "/blog/l", title: "L", start: d("2025-12-31T23:30:00Z"), status: "done" }];
    expect(shape(indexRows(late, d("2026-09-02")))).toEqual(["now", "2025", "essay-l"]);
  });
  it("yields only the now row when there are no entries", () => {
    expect(indexRows([], d("2026-09-02"))).toEqual([{ kind: "now", label: "Sep 2, 2026" }]);
  });
});

describe("segmentRows (spec §7)", () => {
  const now = d("2026-09-02");
  const five: TrackEntry[] = [
    { id: "essay-a", href: "/blog/a", title: "A", start: d("2025-12-21"), status: "done" },
    { id: "essay-b", href: "/blog/b", title: "B", start: d("2025-12-30"), status: "done" },
    { id: "essay-c", href: "/blog/c", title: "C", start: d("2026-05-16"), status: "done" },
    { id: "essay-d", href: "/blog/d", title: "D", start: d("2026-07-22"), status: "done" },
    { id: "essay-e", href: "/blog/e", title: "E", start: d("2026-09-01"), status: "done" },
  ];

  it("newest entry: now head, itself, the older neighbour, an older tail", () => {
    expect(shape(segmentRows(five, "essay-e", now, ESSAYS))).toEqual(["now", "essay-e*", "essay-d", "3 older, all essays"]);
    expect(segmentRows(five, "essay-e", now, ESSAYS)[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("second entry: singular newer head", () => {
    expect(shape(segmentRows(five, "essay-d", now, ESSAYS))).toEqual([
      "1 newer, all essays", "essay-e", "essay-d*", "essay-c", "2 older, all essays",
    ]);
  });
  it("middle entry: both neighbours and both counts", () => {
    expect(shape(segmentRows(five, "essay-c", now, ESSAYS))).toEqual([
      "2 newer, all essays", "essay-d", "essay-c*", "essay-b", "1 older, all essays",
    ]);
  });
  it("oldest entry: newer head, the newer neighbour, itself, no tail", () => {
    expect(shape(segmentRows(five, "essay-a", now, ESSAYS))).toEqual(["4 newer, all essays", "essay-b", "essay-a*"]);
  });
  it("a single entry: now and itself", () => {
    expect(shape(segmentRows([five[0]], "essay-a", now, ESSAYS))).toEqual(["now", "essay-a*"]);
  });
  it("more rows link to the index", () => {
    const rows = segmentRows(five, "essay-c", now, ESSAYS);
    expect(rows[0]).toEqual({ kind: "more", label: "2 newer, all essays", href: "/blog" });
    expect(rows[4]).toEqual({ kind: "more", label: "1 older, all essays", href: "/blog" });
  });
  it("segment entry rows carry id, href, title, start, status only", () => {
    const rich: TrackEntry[] = [{ ...five[4], description: "x", tags: ["t"], minutes: 9 }];
    expect(segmentRows(rich, "essay-e", now, ESSAYS)[1]).toEqual({
      kind: "entry", id: "essay-e", href: "/blog/e", title: "E", start: d("2026-09-01"),
      status: "done", current: true,
    });
  });
  it("throws for an unknown id", () => {
    expect(() => segmentRows(five, "essay-zzz", now, ESSAYS)).toThrow("Unknown track entry: essay-zzz");
  });
});

describe("segmentRows with another index (spec §5.1)", () => {
  const now = d("2026-09-02");
  const PROJECTS: TrackIndex = { href: "/building", noun: "projects" };
  const three: TrackEntry[] = [
    { id: "songle", href: "/building/songle", title: "Songle", start: d("2023-06-01"), end: d("2024-02-01"), status: "live" },
    { id: "rswebtwain", href: "/building/rswebtwain", title: "RSWebTWAIN", start: d("2024-09-01"), end: d("2025-04-01"), status: "done" },
    { id: "daw-engine", href: "/building/daw-engine", title: "Browser DAW engine", start: d("2026-06-01"), status: "in-progress" },
  ];
  it("names the index in the more rows and links to it", () => {
    const rows = segmentRows(three, "songle", now, PROJECTS);
    expect(shape(rows)).toEqual(["2 newer, all projects", "rswebtwain", "songle*"]);
    expect(rows[0]).toEqual({ kind: "more", label: "2 newer, all projects", href: "/building" });
  });
  it("carries end and status onto segment rows so the component can draw a bar", () => {
    const rows = segmentRows(three, "daw-engine", now, PROJECTS);
    expect(rows[1]).toMatchObject({ kind: "entry", id: "daw-engine", status: "in-progress", current: true });
    expect(rows[2]).toMatchObject({ id: "rswebtwain", end: d("2025-04-01"), status: "done" });
  });
});

describe("indexRows over spans", () => {
  const now = d("2026-09-02");
  const two: TrackEntry[] = [
    { id: "songle", href: "/building/songle", title: "Songle", start: d("2023-06-01"), end: d("2024-02-01"), status: "live" },
    { id: "daw-engine", href: "/building/daw-engine", title: "Browser DAW engine", start: d("2026-06-01"), status: "in-progress" },
  ];
  it("groups by start year, newest first, and keeps end and status", () => {
    const rows = indexRows(two, now);
    expect(shape(rows)).toEqual(["now", "2026", "daw-engine", "2023", "songle"]);
    expect(rows[2]).toMatchObject({ kind: "entry", status: "in-progress", end: undefined });
    expect(rows[4]).toMatchObject({ kind: "entry", status: "live", end: d("2024-02-01") });
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

describe("rangeText and whenText (spec §5.1)", () => {
  it("rangeText spans two months", () => {
    expect(rangeText(d("2024-03-01"), d("2024-09-01"))).toBe("March 2024 to September 2024");
  });
  it("rangeText collapses a start and end in the same month", () => {
    expect(rangeText(d("2024-03-01"), d("2024-03-28"))).toBe("March 2024");
  });
  it("rangeText without an end reads as open", () => {
    expect(rangeText(d("2024-03-01"))).toBe("since March 2024");
  });
  it("whenText: in progress", () => {
    expect(whenText({ status: "in-progress", start: d("2026-06-01") })).toBe("in progress since June 2026");
  });
  it("whenText: planned", () => {
    expect(whenText({ status: "planned", start: d("2026-06-01"), end: d("2026-09-30") })).toBe(
      "planned, June 2026 to September 2026",
    );
  });
  it("whenText: live", () => {
    expect(whenText({ status: "live", start: d("2024-03-01"), end: d("2024-09-01") })).toBe(
      "March 2024 to September 2024, live",
    );
  });
  it("whenText: done with an end is the bare range", () => {
    expect(whenText({ status: "done", start: d("2024-09-01"), end: d("2025-04-01") })).toBe(
      "September 2024 to April 2025",
    );
  });
  it("whenText: done without an end is the day itself", () => {
    expect(whenText({ status: "done", start: d("2026-09-01") })).toBe("1 September 2026");
  });
  it("whenText: an in-progress item ignores an end it does not have", () => {
    expect(whenText({ status: "in-progress", start: d("2026-06-01"), end: d("2026-12-01") })).toBe(
      "in progress since June 2026",
    );
  });
});

describe("during (spec §5.1)", () => {
  const now = d("2026-09-02");

  const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
    title: o.id,
    status: "done",
    href: `/#item-${o.id}`,
    ...o,
  });

  // The project under the page: Sep 2024 to Apr 2025.
  const project = { start: d("2024-09-01"), end: d("2025-04-01") };

  const inside = item({ id: "essay-inside", lane: "writing", start: d("2024-12-01"), kind: "moment" });
  const onStart = item({ id: "essay-on-start", lane: "writing", start: d("2024-09-01"), kind: "moment" });
  const onEnd = item({ id: "essay-on-end", lane: "writing", start: d("2025-04-01"), kind: "moment" });
  const before = item({ id: "essay-before", lane: "writing", start: d("2024-08-31"), kind: "moment" });
  const after = item({ id: "essay-after", lane: "writing", start: d("2025-04-02"), kind: "moment" });
  const overlapping = item({ id: "thread", lane: "learning", start: d("2024-01-01"), end: d("2026-01-01"), kind: "span" });
  const ongoing = item({ id: "ongoing", lane: "learning", start: d("2024-10-01"), kind: "span", status: "in-progress" });
  const disjoint = item({ id: "disjoint", lane: "learning", start: d("2025-05-01"), end: d("2025-06-01"), kind: "span" });
  const sibling = item({ id: "other-project", lane: "building", start: d("2024-10-01"), end: d("2024-11-01"), kind: "span" });
  const talk = item({ id: "talk", lane: "community", start: d("2025-01-15"), kind: "moment" });

  const all = [inside, onStart, onEnd, before, after, overlapping, ongoing, disjoint, sibling, talk];

  it("includes moments inside the span, inclusive of both ends", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toContain("essay-inside");
    expect(ids).toContain("essay-on-start");
    expect(ids).toContain("essay-on-end");
  });
  it("excludes moments outside the span", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).not.toContain("essay-before");
    expect(ids).not.toContain("essay-after");
  });
  it("includes spans that intersect and excludes those that do not", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toContain("thread");
    expect(ids).toContain("ongoing");
    expect(ids).not.toContain("disjoint");
  });
  it("excludes the lane it is asked to exclude", () => {
    expect(during(all, project, now, "building").map((i) => i.id)).not.toContain("other-project");
    expect(during(all, project, now, "writing").map((i) => i.id)).toContain("other-project");
  });
  it("runs an open-ended span to now", () => {
    const openProject = { start: d("2026-06-01") };
    const recent = item({ id: "recent", lane: "writing", start: d("2026-08-01"), kind: "moment" });
    const future = item({ id: "future", lane: "writing", start: d("2026-10-01"), kind: "moment" });
    const ids = during([recent, future], openProject, now, "building").map((i) => i.id);
    expect(ids).toEqual(["recent"]);
  });
  it("orders by lane in timeline order with the excluded lane dropped, then start, then id", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toEqual([
      "essay-on-start", "essay-inside", "essay-on-end", "thread", "ongoing", "talk",
    ]);
  });
  it("returns an empty list when nothing overlaps", () => {
    expect(during(all, { start: d("2019-01-01"), end: d("2019-02-01") }, now, "building")).toEqual([]);
  });
});

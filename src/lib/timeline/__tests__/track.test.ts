import { describe, it, expect } from "vitest";
import { readingMinutes, sortEssays, indexRows } from "../track.js";
import type { Essay, TrackRow } from "../track.js";

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

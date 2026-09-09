import { describe, it, expect } from "vitest";
import { resolvePairing, groupPairings } from "../pairings.js";

describe("resolvePairing", () => {
  it("puts a chapter under its book and numbers it", () => {
    const r = resolvePairing({ ref: "ostep.p1", note: "alongside RDB/AOF" });
    expect(r.group).toBe("Operating Systems: Three Easy Pieces");
    expect(r.row.label).toBe("P1. Persistence — I/O devices & disks");
  });

  it("puts a foundation item under its group", () => {
    const r = resolvePairing({ ref: "fd.nc.stack", note: "" });
    expect(r.group).toBe("NeetCode 150, pattern by pattern");
    expect(r.row.label).toBe("Stack");
  });

  it("derives a pattern's workload from the item, not from the note", () => {
    expect(resolvePairing({ ref: "fd.nc.stack", note: "" }).row.count).toBe("7 problems");
  });

  it("derives a course's workload in lessons", () => {
    expect(resolvePairing({ ref: "fd.pyci", note: "" }).row.count).toBe("40 lessons");
  });

  it("gives a chapter no workload count — a chapter is one chapter", () => {
    expect(resolvePairing({ ref: "ddia.ch3", note: "" }).row.count).toBeUndefined();
  });

  it("falls back to the item's own pairsWith when the schedule adds no reason", () => {
    expect(resolvePairing({ ref: "fd.nc.arrays", note: "" }).row.note).toBe("Redis hash store");
  });

  it("prefers the schedule's reason over pairsWith when it has one", () => {
    const r = resolvePairing({ ref: "fd.nc.arrays", note: "Arrays & Hashing begins" });
    expect(r.row.note).toBe("Arrays & Hashing begins");
  });

  it("carries optional through", () => {
    expect(resolvePairing({ ref: "fd.advanced", note: "", optional: true }).row.optional).toBe(true);
  });

  it("shows an unresolvable ref rather than dropping it silently", () => {
    const r = resolvePairing({ ref: "nope.ch1", note: "x" });
    expect(r.row.label).toBe("nope.ch1");
  });
});

describe("groupPairings", () => {
  it("collapses a book's repeated title into one group", () => {
    const groups = groupPairings([
      { ref: "ostep.p1", note: "a" },
      { ref: "ostep.p2", note: "b" },
      { ref: "ostep.p3", note: "c" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Operating Systems: Three Easy Pieces");
    expect(groups[0].rows).toHaveLength(3);
  });

  it("keeps each row's own note inside the group", () => {
    const groups = groupPairings([
      { ref: "ostep.p1", note: "alongside RDB/AOF" },
      { ref: "ostep.c1", note: "alongside replication" },
    ]);
    expect(groups[0].rows.map((r) => r.note)).toEqual([
      "alongside RDB/AOF",
      "alongside replication",
    ]);
  });

  it("merges a book's later run back into its first group", () => {
    // M1 reads DDIA ch3, then all of OSTEP, then DDIA ch5. The band is a phase
    // overview, not a running order, so one bookshelf entry per book reads
    // easier than the same title heading two groups.
    const groups = groupPairings([
      { ref: "ddia.ch3", note: "a" },
      { ref: "ostep.p1", note: "b" },
      { ref: "ddia.ch5", note: "c" },
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Designing Data-Intensive Applications",
      "Operating Systems: Three Easy Pieces",
    ]);
    expect(groups[0].rows.map((r) => r.label)).toEqual([
      "3. Storage and Retrieval",
      "5. Replication",
    ]);
  });

  it("orders groups by where each first appears", () => {
    const groups = groupPairings([
      { ref: "aposd.s2", note: "a" },
      { ref: "ddia.ch3", note: "b" },
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "A Philosophy of Software Design",
      "Designing Data-Intensive Applications",
    ]);
  });

  it("returns nothing for no pairings", () => {
    expect(groupPairings([])).toEqual([]);
  });
});

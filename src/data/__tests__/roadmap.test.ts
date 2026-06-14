import { describe, it, expect } from "vitest";
import {
  build,
  reading,
  foundations,
  allIds,
  deriveStats,
} from "../roadmap.js";

describe("build track", () => {
  it("has 5 course-milestones", () => {
    expect(build).toHaveLength(5);
  });
  it("has 14 stage-groups summing to 98 stages", () => {
    const groups = build.flatMap((m) => m.groups);
    expect(groups).toHaveLength(14);
    expect(groups.reduce((s, g) => s + g.stages, 0)).toBe(98);
  });
  it("has 8 capstone decision logs", () => {
    expect(build.flatMap((m) => m.logs ?? [])).toHaveLength(8);
  });
  it("starts with Redis and ends with Kafka", () => {
    expect(build[0].course).toBe("Redis");
    expect(build[4].course).toBe("Kafka");
  });
});

describe("reading track", () => {
  it("has the 4 core books", () => {
    expect(reading).toHaveLength(4);
    expect(reading.map((b) => b.id).sort()).toEqual(
      ["aposd", "dbint", "ddia", "ostep"],
    );
  });
  it("has 38 chapters total", () => {
    expect(reading.reduce((s, b) => s + b.chapters.length, 0)).toBe(38);
  });
});

describe("foundations track", () => {
  it("has 22 items (4 courses + 18 patterns)", () => {
    expect(foundations).toHaveLength(22);
    expect(foundations.filter((i) => i.kind === "course")).toHaveLength(4);
    expect(foundations.filter((i) => i.kind === "pattern")).toHaveLength(18);
  });
});

describe("allIds", () => {
  it("is the union of every checkable id (14 groups + 8 logs + 38 chapters + 22 foundations = 82), all unique", () => {
    expect(allIds.size).toBe(82);
  });
  it("contains known ids from each track", () => {
    expect(allIds.has("redis.core")).toBe(true);
    expect(allIds.has("redis.log.resp")).toBe(true);
    expect(allIds.has("ddia.ch1")).toBe(true);
    expect(allIds.has("fd.nc.arrays")).toBe(true);
  });
});

describe("deriveStats", () => {
  it("reports zeros for an empty completed list", () => {
    const s = deriveStats([]);
    expect(s.build.stagesDone).toBe(0);
    expect(s.build.stagesTotal).toBe(98);
    expect(s.build.coursesDone).toBe(0);
    expect(s.build.coursesTotal).toBe(5);
    expect(s.reading.chaptersTotal).toBe(38);
    expect(s.foundations.itemsTotal).toBe(22);
    expect(s.logsTotal).toBe(8);
  });
  it("counts a completed build group toward stages and milestone %", () => {
    const s = deriveStats(["redis.core"]);
    expect(s.build.stagesDone).toBe(7);
    expect(s.build.perMilestone.redis).toBeGreaterThan(0);
    expect(s.build.coursesDone).toBe(0); // redis not fully done
  });
  it("marks a course done only when all its groups are checked", () => {
    const s = deriveStats(["sqlite.base"]);
    expect(s.build.coursesDone).toBe(1);
  });
  it("completes a multi-group milestone only when every group is checked", () => {
    const partial = deriveStats(["redis.core", "redis.rdb"]);
    expect(partial.build.coursesDone).toBe(0);
    expect(partial.build.perMilestone.redis).toBeGreaterThan(0);
    expect(partial.build.perMilestone.redis).toBeLessThan(100);

    const full = deriveStats(["redis.core", "redis.rdb", "redis.aof", "redis.replication"]);
    expect(full.build.coursesDone).toBe(1);
    expect(full.build.perMilestone.redis).toBe(100);
  });
  it("tracks reading per-book and book completion", () => {
    const s = deriveStats(["ddia.ch1", "ddia.ch2"]);
    expect(s.reading.chaptersDone).toBe(2);
    expect(s.reading.perBook.ddia.done).toBe(2);
    expect(s.reading.booksDone).toBe(0);
  });
  it("counts foundations items and decision logs, ignoring unknown ids", () => {
    const s = deriveStats(["fd.nc.arrays", "redis.log.resp", "nope.unknown"]);
    expect(s.foundations.itemsDone).toBe(1);
    expect(s.logsDone).toBe(1);
  });
});

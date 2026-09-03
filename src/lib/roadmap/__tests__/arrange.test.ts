import { describe, it, expect } from "vitest";
import { clipStatus, roadmapClips, threadSpans, roadmapWindow, quarterTicks, type RoadmapClip } from "../arrange.js";

const now = new Date("2026-09-02T00:00:00Z");

describe("clipStatus", () => {
  it("planned when it starts after now and nothing is done", () => {
    expect(clipStatus(0, 4, new Date("2027-01-01"), now)).toBe("planned");
  });
  it("done when every child is complete", () => {
    expect(clipStatus(4, 4, new Date("2026-01-01"), now)).toBe("done");
  });
  it("in-progress when started and partly complete", () => {
    expect(clipStatus(2, 4, new Date("2026-06-01"), now)).toBe("in-progress");
  });
  it("in-progress when started, nothing done, but start is in the past", () => {
    expect(clipStatus(0, 4, new Date("2026-06-01"), now)).toBe("in-progress");
  });
});

describe("roadmapClips", () => {
  const clips = roadmapClips(new Set<string>(), now);

  it("makes one clip per milestone, book, and foundation group", () => {
    // 5 build + 4 reading + 2 foundations
    expect(clips).toHaveLength(11);
    expect(clips.filter((c) => c.track === "build")).toHaveLength(5);
    expect(clips.filter((c) => c.track === "reading")).toHaveLength(4);
    expect(clips.filter((c) => c.track === "foundations")).toHaveLength(2);
  });
  it("derives status from completion and now", () => {
    const redis = clips.find((c) => c.id === "redis")!;
    expect(redis.status).toBe("in-progress"); // starts 2026-06, before now, nothing done
    const kafka = clips.find((c) => c.id === "kafka")!;
    expect(kafka.status).toBe("planned"); // starts 2027-05
  });
  it("marks a fully-completed milestone done", () => {
    const done = new Set(["redis.core", "redis.rdb", "redis.aof", "redis.replication", "redis.log.resp", "redis.log.durability", "redis.log.replication"]);
    const redis = roadmapClips(done, now).find((c) => c.id === "redis")!;
    expect(redis.status).toBe("done");
  });
  it("pluralizes the sublabel count word", () => {
    const sqlite = clips.find((c) => c.id === "sqlite")!;
    expect(sqlite.sublabel).toBe("0 of 1 checkpoint");
    const redis = clips.find((c) => c.id === "redis")!;
    expect(redis.sublabel).toBe("0 of 4 checkpoints");
    const ddia = clips.find((c) => c.id === "ddia")!;
    expect(ddia.sublabel).toBe("0 of 12 chapters");
  });
  it("links each clip to its inspector anchor and is a span", () => {
    const redis = clips.find((c) => c.id === "redis")!;
    expect(redis.href).toBe("#clip-redis");
    expect(redis.kind).toBe("span");
  });
});

describe("threadSpans", () => {
  const spans = threadSpans(now);

  it("makes three learning-lane items, one per track", () => {
    expect(spans.map((s) => s.id)).toEqual(["roadmap-build", "roadmap-reading", "roadmap-foundations"]);
    expect(spans.every((s) => s.lane === "learning")).toBe(true);
    expect(spans.every((s) => s.kind === "span")).toBe(true);
  });
  it("spans each track from its earliest start to its latest end", () => {
    const build = spans.find((s) => s.id === "roadmap-build")!;
    expect(build.start).toEqual(new Date("2026-06-01"));
    expect(build.end).toEqual(new Date("2027-08-31"));
  });
  it("links into the roadmap thread anchor via the inspector body", () => {
    const reading = spans.find((s) => s.id === "roadmap-reading")!;
    expect(reading.href).toBe("/#item-roadmap-reading");
    expect(reading.body).toMatchObject({ lane: "learning", roadmapHref: "/roadmap#rm-track-reading" });
  });
});

describe("roadmapWindow", () => {
  it("span zoom is the fixed 2026-to-2027 calendar", () => {
    const w = roadmapWindow("span", now, []);
    expect(w.from).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(w.to).toEqual(new Date("2027-12-31T23:59:59.999Z"));
  });
  it("all zoom expands past the fixed calendar in both directions", () => {
    const clip = (id: string, start: string, end: string): RoadmapClip => ({
      id, track: "build", title: id, start: new Date(start), end: new Date(end),
      kind: "span", status: "planned", href: `#clip-${id}`,
    });
    const w = roadmapWindow("all", now, [
      clip("early", "2025-03-01T00:00:00Z", "2025-09-01T00:00:00Z"),
      clip("late", "2027-01-01T00:00:00Z", "2028-06-30T00:00:00Z"),
    ]);
    expect(w.from).toEqual(new Date("2025-03-01T00:00:00Z"));
    expect(w.to).toEqual(new Date("2028-06-30T00:00:00Z"));
  });
  it("all zoom runs from the earliest clip start to the later of latest end and end of 2027", () => {
    const clips = roadmapClips(new Set<string>(), now);
    const w = roadmapWindow("all", now, clips);
    expect(w.from).toEqual(new Date("2026-01-01")); // earliest = ddia / fd.courses
    expect(w.to.getTime()).toBeGreaterThanOrEqual(new Date("2027-12-31").getTime());
  });
});

describe("quarterTicks", () => {
  it("emits a quarter tick across the span with the year label on each Q1", () => {
    const ticks = quarterTicks(roadmapWindow("span", now, []));
    expect(ticks).toHaveLength(8);
    expect(ticks[0]).toMatchObject({ label: "2026", x: 0 });
    expect(ticks[1].label).toBe("Q2");
    expect(ticks[4].label).toBe("2027");
  });
  it("drops the tick that falls before a window starting mid-quarter", () => {
    const ticks = quarterTicks({
      from: new Date("2026-02-15T00:00:00Z"),
      to: new Date("2027-12-31T23:59:59.999Z"),
    });
    expect(ticks.every((t) => t.x >= 0)).toBe(true);
    expect(ticks[0].label).toBe("Q2");
    expect(ticks[0].x).toBeGreaterThan(0);
  });
});

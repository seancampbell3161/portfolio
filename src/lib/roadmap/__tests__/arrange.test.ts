import { describe, it, expect } from "vitest";
import { clipStatus, roadmapClips, threadSpans, roadmapWindow, quarterTicks, type RoadmapClip } from "../arrange.js";
import { build, reading as books, foundations as fnd, phases, allIds } from "../../../data/roadmap.js";

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
    // Chosen by their relation to `now`, not by id: re-dating the plan shifts
    // which milestone is under way, and that must not fail this rule.
    const started = clips.find((c) => c.start.getTime() <= now.getTime())!;
    expect(started.status).toBe("in-progress"); // started, nothing done
    const ahead = clips.find((c) => c.start.getTime() > now.getTime())!;
    expect(ahead.status).toBe("planned"); // not started, nothing done
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
    const span = spans.find((s) => s.id === "roadmap-build")!;
    expect(span.start).toEqual(new Date(Math.min(...build.map((m) => m.start.getTime()))));
    expect(span.end).toEqual(new Date(Math.max(...build.map((m) => m.end.getTime()))));
  });
  it("links into the roadmap thread anchor via the inspector body", () => {
    const reading = spans.find((s) => s.id === "roadmap-reading")!;
    expect(reading.href).toBe("/#item-roadmap-reading");
    expect(reading.body).toMatchObject({ lane: "learning", roadmapHref: "/roadmap#rm-track-reading" });
  });
});

describe("roadmapWindow", () => {
  it("span zoom is a window sized to the plan, not the calendar", () => {
    const w = roadmapWindow("span", now, []);
    expect(w.from).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(w.to).toEqual(new Date("2027-06-30T23:59:59.999Z"));
  });

  it("holds every clip inside the span window", () => {
    // The window exists to frame the work; a clip outside it would be clipped.
    const clips = roadmapClips(new Set<string>(), now);
    const w = roadmapWindow("span", now, []);
    for (const c of clips) {
      expect(c.start.getTime(), `${c.id} starts before the window`).toBeGreaterThanOrEqual(w.from.getTime());
      expect(c.end.getTime(), `${c.id} ends after the window`).toBeLessThanOrEqual(w.to.getTime());
    }
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
    expect(w.from).toEqual(new Date("2026-07-01")); // span window start (all clips start later)
    expect(w.to).toEqual(new Date("2027-06-30T23:59:59.999Z")); // span window end (all clips end earlier)
  });
});

describe("quarterTicks", () => {
  it("emits a quarter tick across the span with the year label on each Q1", () => {
    const ticks = quarterTicks(roadmapWindow("span", now, []));
    expect(ticks).toHaveLength(4);
    expect(ticks[0]).toMatchObject({ label: "Q3", x: 0 });
    expect(ticks[1].label).toBe("Q4");
    expect(ticks[2].label).toBe("2027");
    expect(ticks[3].label).toBe("Q2");
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

describe("spans derive from the phase table", () => {
  // The eleven known-good spans. Literal dates belong here and only here: this
  // is a fixture asserting the derivation, not a logic test restating data.
  const EXPECTED: Record<string, [string, string]> = {
    redis: ["2026-09-07", "2026-10-24"],
    sqlite: ["2026-10-26", "2026-11-07"],
    http: ["2026-11-09", "2026-11-28"],
    dns: ["2026-11-30", "2026-12-12"],
    kafka: ["2026-12-14", "2027-02-06"],
    ddia: ["2026-08-31", "2027-02-06"],
    aposd: ["2026-08-31", "2027-01-16"],
    dbint: ["2026-10-26", "2027-04-30"],
    ostep: ["2026-09-07", "2027-04-30"],
    "fd.courses": ["2026-08-31", "2026-10-24"],
    "fd.neetcode": ["2026-08-31", "2027-02-06"],
  };

  const byId = new Map<string, { start: Date; end: Date }>(
    [...build, ...books, ...fnd].map((x) => [x.id, { start: x.start, end: x.end }]),
  );

  it("reproduces every known-good span", () => {
    for (const [id, [start, end]] of Object.entries(EXPECTED)) {
      const got = byId.get(id);
      expect(got, `no clip ${id}`).toBeDefined();
      expect(got!.start.toISOString().slice(0, 10), `${id} start`).toBe(start);
      expect(got!.end.toISOString().slice(0, 10), `${id} end`).toBe(end);
    }
  });

  it("excludes an optional pairing from span derivation", () => {
    // fd.advanced is listed in the capstone as "optional, deferred". Counting it
    // would stretch fd.courses from W0–7 to W0–22 — from "finished during Redis"
    // to "runs all year".
    const capstone = phases.find((p) => p.id === "capstone")!;
    expect(capstone.foundations.find((x) => x.ref === "fd.advanced")?.optional).toBe(true);
    expect(byId.get("fd.courses")!.end).toEqual(new Date("2026-10-24T00:00:00Z"));
  });

  it("spans Kafka across both phases that name it", () => {
    const owning = phases.filter((p) => p.milestone === "kafka").map((p) => p.id);
    expect(owning).toEqual(["m5", "capstone"]);
  });

  it("gives both phases that name Kafka the very same milestone object", () => {
    // m5 (W15–19) and capstone (W20–22) both carry milestone: "kafka". The
    // lookup is by build id, so the capstone's Kafka tail lands inside the
    // Kafka clip rather than dangling outside it.
    const owning = phases.filter((p) => p.milestone === "kafka");
    expect(owning.map((p) => p.id)).toEqual(["m5", "capstone"]);
    const resolved = owning.map((p) => build.find((m) => m.id === p.milestone));
    expect(resolved[0]).toBe(resolved[1]);
    expect(resolved[0]?.id).toBe("kafka");
  });

  it("references only ids that already exist, so no progress is orphaned", () => {
    for (const p of phases) {
      for (const pair of [...p.reading, ...p.foundations]) {
        expect(allIds.has(pair.ref), `unknown ref ${pair.ref} in phase ${p.id}`).toBe(true);
      }
    }
  });

  it("gives every phase a contiguous, ordered week range", () => {
    expect(phases.map((p) => p.id)).toEqual(["ramp", "m1", "m2", "m3", "m4", "m5", "capstone"]);
    phases.forEach((p, i) => {
      expect(p.toWeek, `phase ${p.id}`).toBeGreaterThanOrEqual(p.fromWeek);
      if (i > 0) expect(p.fromWeek, `phase ${p.id} follows`).toBe(phases[i - 1].toWeek + 1);
    });
  });
});

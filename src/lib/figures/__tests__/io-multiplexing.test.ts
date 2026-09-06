import { describe, it, expect } from "vitest";
import {
  ARRIVAL_CHANCE,
  COUNTS,
  HOLD_MS,
  MECHANISMS,
  STILL,
  SWEEP_MS,
  addWake,
  arrivals,
  callStatus,
  checked,
  columns,
  emptyTallies,
  fdList,
  frameAt,
  isCount,
  isMechanism,
  numbered,
  readoutText,
  readyLine,
  resetText,
  schedule,
  seedFor,
  seeded,
  stillText,
  tallyText,
  wake,
  type Frame,
  type Wake,
} from "../io-multiplexing.js";

describe("mechanisms and counts (spec §4.1)", () => {
  it("names the three mechanisms and three counts in display order", () => {
    expect([...MECHANISMS]).toEqual(["select", "poll", "epoll"]);
    expect([...COUNTS]).toEqual([8, 32, 128]);
  });

  it("lays 8 sockets in one row and the rest in 16 columns", () => {
    expect(columns(8)).toBe(8);
    expect(columns(32)).toBe(16);
    expect(columns(128)).toBe(16);
  });

  it("numbers the cells at 8 and 32 only", () => {
    expect(numbered(8)).toBe(true);
    expect(numbered(32)).toBe(true);
    expect(numbered(128)).toBe(false);
  });

  it("guards strings and numbers read from the DOM", () => {
    expect(isMechanism("poll")).toBe(true);
    expect(isMechanism("kqueue")).toBe(false);
    expect(isMechanism(undefined)).toBe(false);
    expect(isCount(32)).toBe(true);
    expect(isCount(64)).toBe(false);
    expect(isCount(Number.NaN)).toBe(false);
  });
});

describe("the seeded generator (spec §4.2)", () => {
  it("repeats for a seed and differs across seeds", () => {
    const a = seeded(7);
    const b = seeded(7);
    const c = seeded(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays in [0, 1)", () => {
    const r = seeded(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seeds by count and wake number, never by mechanism", () => {
    expect(seedFor(32, 3)).not.toBe(seedFor(32, 4));
    expect(seedFor(32, 3)).not.toBe(seedFor(128, 3));
  });
});

describe("arrivals (spec §4.2)", () => {
  it("is never empty, ascending and within range", () => {
    for (const count of COUNTS) {
      for (let n = 1; n <= 200; n++) {
        const ready = arrivals(count, seeded(seedFor(count, n)));
        expect(ready.length).toBeGreaterThan(0);
        expect(ready).toEqual([...ready].sort((a, b) => a - b));
        expect(ready[0]).toBeGreaterThanOrEqual(0);
        expect(ready[ready.length - 1]).toBeLessThan(count);
        expect(new Set(ready).size).toBe(ready.length);
      }
    }
  });

  it("lands near one in twelve at 128, a few among many idle", () => {
    let total = 0;
    for (let n = 1; n <= 1000; n++) total += arrivals(128, seeded(seedFor(128, n))).length;
    const mean = total / 1000;
    expect(ARRIVAL_CHANCE).toBeCloseTo(1 / 12, 10);
    expect(mean).toBeGreaterThan(9.5);
    expect(mean).toBeLessThan(12);
  });

  it("forces one ready socket when the draw leaves none", () => {
    // A generator that never fires the chance, then picks socket 5 of 8.
    const never = [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 5 / 8];
    let i = 0;
    expect(arrivals(8, () => never[i++]!)).toEqual([5]);
  });
});

describe("a wake (spec §4.3)", () => {
  it("checked is the count for select and poll and the ready size for epoll", () => {
    expect(checked("select", 32, 3)).toBe(32);
    expect(checked("poll", 128, 10)).toBe(128);
    expect(checked("epoll", 128, 10)).toBe(10);
  });

  it("delivers the same data to every mechanism for the same count and number", () => {
    const s = wake("select", 32, 3);
    const p = wake("poll", 32, 3);
    const e = wake("epoll", 32, 3);
    expect(p.ready).toEqual(s.ready);
    expect(e.ready).toEqual(s.ready);
    expect(s.checked).toBe(32);
    expect(e.checked).toBe(s.ready.length);
    expect(s).toMatchObject({ n: 3, mechanism: "select", count: 32 });
  });

  it("differs between wake numbers", () => {
    const sets = [1, 2, 3, 4, 5].map((n) => JSON.stringify(wake("select", 32, n).ready));
    expect(new Set(sets).size).toBeGreaterThan(1);
  });
});

describe("tallies (spec §4.4)", () => {
  it("starts at zero for every mechanism", () => {
    expect(emptyTallies()).toEqual({
      select: { wakes: 0, checked: 0, ready: 0 },
      poll: { wakes: 0, checked: 0, ready: 0 },
      epoll: { wakes: 0, checked: 0, ready: 0 },
    });
  });

  it("accumulates one mechanism's wakes without touching the others, returning a new object", () => {
    const t0 = emptyTallies();
    const t1 = addWake(t0, { n: 1, mechanism: "select", count: 32, ready: [4, 19, 27], checked: 32 });
    const t2 = addWake(t1, { n: 2, mechanism: "select", count: 32, ready: [9], checked: 32 });
    expect(t0.select.wakes).toBe(0);
    expect(t1).not.toBe(t0);
    expect(t2.select).toEqual({ wakes: 2, checked: 64, ready: 4 });
    expect(t2.epoll).toEqual({ wakes: 0, checked: 0, ready: 0 });
  });
});

describe("the schedule (spec §4.5)", () => {
  it("runs select and poll through arrive, sweep, return, handle, idle", () => {
    const s = schedule("select", 32, false);
    expect(s.steps).toEqual([
      { phase: "arrive", at: 0 },
      { phase: "sweep", at: 350 },
      { phase: "return", at: 350 + 1280 },
      { phase: "handle", at: 350 + 1280 + 700 },
      { phase: "idle", at: 350 + 1280 + 700 + 450 },
    ]);
    expect(s.duration).toBe(2780);
    expect(schedule("poll", 128, false).steps.find((st) => st.phase === "return")?.at).toBe(350 + 2048);
    expect(schedule("poll", 8, false).steps.find((st) => st.phase === "return")?.at).toBe(350 + 640);
  });

  it("has no sweep for epoll", () => {
    const s = schedule("epoll", 32, false);
    expect(s.steps.map((st) => st.phase)).toEqual(["arrive", "return", "handle", "idle"]);
    expect(s.steps.map((st) => st.at)).toEqual([0, 350, 1050, 1500]);
    expect(s.duration).toBe(1500);
  });

  it("is a single held return frame under reduced motion", () => {
    for (const m of ["select", "epoll"] as const) {
      const s = schedule(m, 128, true);
      expect(s.steps).toEqual([{ phase: "return", at: 0 }]);
      expect(s.duration).toBe(HOLD_MS.still);
    }
  });

  it("makes 128 one socket per frame at 60Hz", () => {
    expect(SWEEP_MS[128] / 128).toBe(16);
    expect(SWEEP_MS).toEqual({ 8: 640, 32: 1280, 128: 2048 });
    expect(HOLD_MS).toEqual({ arrive: 350, return: 700, handle: 450, still: 2000, gap: 500 });
  });
});

describe("the frame at a time (spec §4.5)", () => {
  const s32 = schedule("select", 32, false);
  const s128 = schedule("poll", 128, false);

  it("is arrive before the sweep and idle at the end", () => {
    expect(frameAt(s32, 32, 0)).toEqual({ phase: "arrive", scan: null });
    expect(frameAt(s32, 32, 349)).toEqual({ phase: "arrive", scan: null });
    expect(frameAt(s32, 32, s32.duration)).toEqual({ phase: "idle", scan: null });
  });

  it("points at the middle socket halfway through the sweep and the last at its end", () => {
    expect(frameAt(s32, 32, 350 + 640)).toEqual({ phase: "sweep", scan: 16 });
    expect(frameAt(s32, 32, 350 + 1279)).toEqual({ phase: "sweep", scan: 31 });
    expect(frameAt(s32, 32, 350)).toEqual({ phase: "sweep", scan: 0 });
    expect(frameAt(s128, 128, 350 + 1024)).toEqual({ phase: "sweep", scan: 64 });
    expect(frameAt(s128, 128, 350 + 2047)).toEqual({ phase: "sweep", scan: 127 });
  });

  it("returns then handles with no scan", () => {
    expect(frameAt(s32, 32, 350 + 1280)).toEqual({ phase: "return", scan: null });
    expect(frameAt(s32, 32, 350 + 1280 + 700)).toEqual({ phase: "handle", scan: null });
  });

  it("holds the return frame under reduced motion", () => {
    const s = schedule("select", 8, true);
    expect(frameAt(s, 8, 0)).toEqual({ phase: "return", scan: null });
    expect(frameAt(s, 8, s.duration)).toEqual({ phase: "return", scan: null });
  });
});

const at = (phase: Frame["phase"], scan: number | null = null): Frame => ({ phase, scan });
const w32 = (mechanism: "select" | "poll" | "epoll"): Wake => ({ n: 3, mechanism, count: 32, ready: [4, 19, 27], checked: mechanism === "epoll" ? 3 : 32 });
const w128: Wake = { n: 1, mechanism: "select", count: 128, ready: [4, 19, 27, 61, 77, 90, 102, 115, 121, 126, 127], checked: 128 };
const w1: Wake = { n: 1, mechanism: "epoll", count: 8, ready: [5], checked: 1 };

describe("wording (spec §4.6)", () => {
  it("lists up to four fds then counts the rest", () => {
    expect(fdList([4, 19, 27])).toBe("fd 4, 19, 27");
    expect(fdList([4, 19, 27, 61])).toBe("fd 4, 19, 27, 61");
    expect(fdList(w128.ready)).toBe("fd 4, 19, 27, 61 and 7 more");
    expect(fdList([5])).toBe("fd 5");
  });

  it("gives the call's status by phase and mechanism", () => {
    expect(callStatus(null, "select", 32, at("idle"))).toBe("blocked until a descriptor is ready");
    expect(callStatus(null, "epoll", 32, at("idle"))).toBe("blocked until the kernel has an event");
    expect(callStatus(w32("select"), "select", 32, at("arrive"))).toBe("blocked until a descriptor is ready");
    expect(callStatus(w32("select"), "select", 32, at("sweep", 13))).toBe("checking fd 13 of 32");
    expect(callStatus(w32("poll"), "poll", 32, at("sweep", 13))).toBe("checking entry 13 of 32");
    expect(callStatus(w32("select"), "select", 32, at("return"))).toBe("checked all 32");
    expect(callStatus(w32("poll"), "poll", 32, at("handle"))).toBe("checked all 32");
    expect(callStatus(w32("epoll"), "epoll", 32, at("return"))).toBe("returned 3 events");
    expect(callStatus(w1, "epoll", 8, at("return"))).toBe("returned 1 event");
  });

  it("fills the ready line from return on", () => {
    expect(readyLine(null, at("idle"))).toEqual({ title: "ready: nothing yet", note: "" });
    expect(readyLine(w32("select"), at("sweep", 3))).toEqual({ title: "ready: nothing yet", note: "" });
    expect(readyLine(w32("select"), at("return"))).toEqual({ title: "ready: fd 4, 19, 27", note: "29 checked for nothing" });
    expect(readyLine(w32("poll"), at("handle"))).toEqual({ title: "ready: fd 4, 19, 27", note: "29 checked for nothing" });
    expect(readyLine(w32("epoll"), at("return"))).toEqual({ title: "ready: fd 4, 19, 27", note: "the kernel kept the set; nothing else was touched" });
    expect(readyLine(w128, at("return")).title).toBe("ready: fd 4, 19, 27, 61 and 7 more");
  });

  it("states each wake in one sentence", () => {
    expect(readoutText(w32("select"))).toBe("Wake 3: select checked 32 descriptors to find 3 ready.");
    expect(readoutText(w32("poll"))).toBe("Wake 3: poll checked 32 entries to find 3 ready.");
    expect(readoutText(w32("epoll"))).toBe("Wake 3: epoll_wait returned the 3 ready descriptors without checking the other 29.");
    expect(readoutText(w1)).toBe("Wake 1: epoll_wait returned the 1 ready descriptor without checking the other 7.");
  });

  it("resets and tallies", () => {
    expect(resetText(128)).toBe("No wakes yet at 128 sockets. Press Next wake.");
    expect(tallyText({ wakes: 0, checked: 0, ready: 0 })).toBe("—");
    expect(tallyText({ wakes: 1, checked: 32, ready: 3 })).toBe("1 wake · 32 checked · 3 ready");
    expect(tallyText({ wakes: 3, checked: 96, ready: 9 })).toBe("3 wakes · 96 checked · 9 ready");
  });

  it("keeps the still frame and its sentence together", () => {
    expect(STILL).toEqual({ n: 0, mechanism: "epoll", count: 32, ready: [4, 19, 27], checked: 3 });
    expect(stillText()).toBe(
      "epoll_wait returned the 3 ready descriptors of 32 without checking the other 29. select or poll would have checked all 32.",
    );
  });
});

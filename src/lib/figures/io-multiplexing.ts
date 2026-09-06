// src/lib/figures/io-multiplexing.ts
// The model behind the I/O multiplexing figure (interactions 5, spec §4): which
// sockets have data on a wake, what each mechanism examines to find out, the
// running tallies, the phase schedule of one wake, and every sentence the
// figure prints. Pure, no DOM: the component imports it at build time for the
// still frame and the script at run time, so the two cannot disagree.

export const MECHANISMS = ["select", "poll", "epoll"] as const;
export type Mechanism = (typeof MECHANISMS)[number];
export const COUNTS = [8, 32, 128] as const;
export type Count = (typeof COUNTS)[number];

export const CALL_NAME: Record<Mechanism, string> = {
  select: "select()",
  poll: "poll()",
  epoll: "epoll_wait()",
};

/** Grid columns (spec §3): one row at 8, 16 columns above. */
export function columns(count: Count): 8 | 16 {
  return count === 8 ? 8 : 16;
}

/** Cells carry their fd number at 8 and 32; at 128 they are too small to. */
export function numbered(count: Count): boolean {
  return count !== 128;
}

export function isMechanism(s: string | null | undefined): s is Mechanism {
  return (MECHANISMS as readonly string[]).includes(s ?? "");
}

export function isCount(n: number): n is Count {
  return (COUNTS as readonly number[]).includes(n);
}

// ---- arrivals (spec §4.2) ----

/** mulberry32: a small seeded generator with values in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seed depends on the count and the wake number only, never on the
 * mechanism, so wake 3 at 32 sockets delivers the same data to select, poll
 * and epoll and the tally compares the mechanisms rather than their luck.
 */
export function seedFor(count: Count, n: number): number {
  return count * 1000 + n;
}

export const ARRIVAL_CHANCE = 1 / 12;

/**
 * Ascending fds with data this wake. Never empty: the call would not have
 * returned otherwise, so a draw that leaves none picks one socket instead.
 */
export function arrivals(count: Count, random: () => number): number[] {
  const ready: number[] = [];
  for (let fd = 0; fd < count; fd++) if (random() < ARRIVAL_CHANCE) ready.push(fd);
  if (ready.length === 0) ready.push(Math.floor(random() * count));
  return ready;
}

// ---- a wake (spec §4.3) ----

export interface Wake {
  /** 1-based wake number for this mechanism at this count. */
  n: number;
  mechanism: Mechanism;
  count: Count;
  ready: number[];
  checked: number;
}

/** The thesis in one line: select and poll examine every descriptor they were handed; epoll only what the kernel returns. */
export function checked(mechanism: Mechanism, count: Count, ready: number): number {
  return mechanism === "epoll" ? ready : count;
}

export function wake(mechanism: Mechanism, count: Count, n: number): Wake {
  const ready = arrivals(count, seeded(seedFor(count, n)));
  return { n, mechanism, count, ready, checked: checked(mechanism, count, ready.length) };
}

// ---- tallies (spec §4.4) ----

export interface Tally {
  wakes: number;
  checked: number;
  ready: number;
}
export type Tallies = Record<Mechanism, Tally>;

export function emptyTallies(): Tallies {
  return {
    select: { wakes: 0, checked: 0, ready: 0 },
    poll: { wakes: 0, checked: 0, ready: 0 },
    epoll: { wakes: 0, checked: 0, ready: 0 },
  };
}

/** Accumulates across mechanism switches; the caller resets on a count change. Returns a new object. */
export function addWake(tallies: Tallies, w: Wake): Tallies {
  const t = tallies[w.mechanism];
  return {
    ...tallies,
    [w.mechanism]: { wakes: t.wakes + 1, checked: t.checked + w.checked, ready: t.ready + w.ready.length },
  };
}

// ---- the schedule and the frame (spec §4.5) ----

export type Phase = "idle" | "arrive" | "sweep" | "return" | "handle";

export interface Step {
  phase: Phase;
  /** Milliseconds from the wake's start. */
  at: number;
}

export interface Schedule {
  steps: Step[];
  /** The loop ends here; the last step's phase is what stays on screen. */
  duration: number;
}

/** The whole sweep, so 128 is one socket per frame at 60Hz and visibly longer than 8. */
export const SWEEP_MS: Record<Count, number> = { 8: 640, 32: 1280, 128: 2048 };

export const HOLD_MS = { arrive: 350, return: 700, handle: 450, still: 2000, gap: 500 } as const;

/**
 * With motion: arrive, sweep (select and poll only), return, handle, idle.
 * Under reduced motion: a single return frame, held, so the trail and the
 * count checked are still visible; the next wake clears it.
 */
export function schedule(mechanism: Mechanism, count: Count, reduceMotion: boolean): Schedule {
  if (reduceMotion) return { steps: [{ phase: "return", at: 0 }], duration: HOLD_MS.still };
  const sweep = mechanism === "epoll" ? 0 : SWEEP_MS[count];
  const steps: Step[] = [{ phase: "arrive", at: 0 }];
  if (sweep > 0) steps.push({ phase: "sweep", at: HOLD_MS.arrive });
  const returned = HOLD_MS.arrive + sweep;
  const handle = returned + HOLD_MS.return;
  const idle = handle + HOLD_MS.handle;
  steps.push({ phase: "return", at: returned }, { phase: "handle", at: handle }, { phase: "idle", at: idle });
  return { steps, duration: idle };
}

export interface Frame {
  phase: Phase;
  /** During a sweep, the index of the socket under check; every socket up to it is seen. */
  scan: number | null;
}

export function frameAt(s: Schedule, count: Count, elapsed: number): Frame {
  let step = s.steps[0]!;
  for (const candidate of s.steps) if (candidate.at <= elapsed) step = candidate;
  if (step.phase !== "sweep") return { phase: step.phase, scan: null };
  const perSocket = SWEEP_MS[count] / count;
  return { phase: "sweep", scan: Math.min(count - 1, Math.floor((elapsed - step.at) / perSocket)) };
}

// ---- wording (spec §4.6) ----

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "fd 4, 19, 27", or "fd 4, 19, 27, 61 and 7 more" past four. */
export function fdList(ready: number[]): string {
  const shown = ready.slice(0, 4);
  const rest = ready.length - shown.length;
  return `fd ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
}

/** The call box's one-line status. `w` is null before the first wake. */
export function callStatus(w: Wake | null, mechanism: Mechanism, count: Count, frame: Frame): string {
  switch (frame.phase) {
    case "sweep":
      return `checking ${mechanism === "poll" ? "entry" : "fd"} ${frame.scan ?? 0} of ${count}`;
    case "return":
    case "handle":
      return mechanism === "epoll" ? `returned ${plural(w?.ready.length ?? 0, "event")}` : `checked all ${count}`;
    default:
      return mechanism === "epoll" ? "blocked until the kernel has an event" : "blocked until a descriptor is ready";
  }
}

/** The ready box: empty until the call returns. */
export function readyLine(w: Wake | null, frame: Frame): { title: string; note: string } {
  if (!w || (frame.phase !== "return" && frame.phase !== "handle")) return { title: "ready: nothing yet", note: "" };
  const note =
    w.mechanism === "epoll"
      ? "the kernel kept the set; nothing else was touched"
      : `${w.count - w.ready.length} checked for nothing`;
  return { title: `ready: ${fdList(w.ready)}`, note };
}

/** The live readout, one sentence per wake. */
export function readoutText(w: Wake): string {
  const ready = w.ready.length;
  switch (w.mechanism) {
    case "select":
      return `Wake ${w.n}: select checked ${plural(w.count, "descriptor")} to find ${ready} ready.`;
    case "poll":
      return `Wake ${w.n}: poll checked ${plural(w.count, "entry", "entries")} to find ${ready} ready.`;
    case "epoll":
      return `Wake ${w.n}: epoll_wait returned the ${plural(ready, "ready descriptor")} without checking the other ${w.count - ready}.`;
  }
}

/** After a count change. */
export function resetText(count: Count): string {
  return `No wakes yet at ${count} sockets. Press Next wake.`;
}

export function tallyText(t: Tally): string {
  if (t.wakes === 0) return "—";
  return `${plural(t.wakes, "wake")} · ${t.checked} checked · ${t.ready} ready`;
}

/** The no-JS frame (spec §5): epoll at 32 with three sockets ready, a completed wake. */
export const STILL: Wake = { n: 0, mechanism: "epoll", count: 32, ready: [4, 19, 27], checked: 3 };

export function stillText(): string {
  const ready = STILL.ready.length;
  return `epoll_wait returned the ${ready} ready descriptors of ${STILL.count} without checking the other ${STILL.count - ready}. select or poll would have checked all ${STILL.count}.`;
}

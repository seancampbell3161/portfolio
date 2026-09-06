# Arrangement, interactions 5: The I/O multiplexing figure

Design spec, 2026-09-06. Approved section by section in brainstorming the same day, with the layout, the sweep's look and the grid's scaling chosen from browser mockups.

## 1. Context

The essay "How Apps Like Redis Are So Efficient" (`src/content/blog/io-multiplexing.mdx`) explains select, poll and epoll and ends with a static PNG (`public/images/io_multiplexing_select_poll_epoll.png`): five fd boxes, a wait-call box, a ready box, a thread box, one frozen moment on a light background inside a dark page. The picture does not distinguish the three mechanisms, which is where the essay's insight lives: select and poll examine every descriptor on every call, epoll returns only the ready ones.

Sub-project 5 of the interactions plan (pointer-interactions spec §1) replaces the PNG with an interactive figure. Sub-projects 1 to 4 are merged. This is the first interactive figure in an essay, so its folders and hooks set the convention for any later one.

## 2. Scope

In scope:

- A figure that plays one event-loop wake at a time under select, poll or epoll, at 8, 32 or 128 sockets, and states the result in words with a running tally per mechanism.
- Server-rendered markup in a meaningful no-JS frame, with the controls hidden until the script reveals them.
- A pure, unit-tested model: arrivals, what each mechanism checks, tallies, the wake's phase schedule, and all wording.
- A re-runnable client script, a contract test over the built essay pages, an e2e section, and docs.
- Removal of the PNG.

Out of scope:

- The thread-per-connection comparison (the essay's setup argument). The figure shows one thread multiplexing.
- Reader-placed arrivals, a continuously running loop, and a side-by-side rendering of two mechanisms. Rejected in brainstorming.
- Any other essay or page. The Building and Writing indexes and the home inspector are unchanged.
- Share images: the essay keeps the Writing share image.

## 3. Decisions from brainstorming

- **What it teaches: the scan cost** (option A of three), with the event loop as the vehicle. The idle-thread waste (B) and a mechanism-agnostic loop (C) were passed over: A is the essay's thesis and the loop is still visible because the sweep happens per iteration.
- **How it is driven: step and play** (option 1 of three). A "Next wake" button runs one iteration; a Play toggle keeps running them; a worded readout and a per-mechanism tally carry the point for anyone who never watches the motion. Always-running was rejected as a perpetual animation competing with prose that gives reduced-motion readers nothing. Reader-placed arrivals were rejected as fiddly at 128 sockets for no extra lesson.
- **Without JavaScript: a still frame from the same markup** (option A of three). The component renders the grid at 32 with three sockets ready under epoll, the boxes and a readout sentence stating the thesis; the controls are in the HTML but hidden. Keeping the PNG in a `<noscript>` and rendering empty were rejected.
- **Layout: vertical flow** (mockup A of three). Toolbar, grid, wait call, ready set, thread, top to bottom with arrows, then the readout. The PNG's shape redrawn. A console panel with a progress strip (B) and a grid beside a pipeline column (C) were passed over.
- **The sweep leaves a trail** (mockup A of two). Checked sockets darken and stay dark until the wake ends, so after a select sweep the grid visibly reads "all 32 touched" against epoll's "3 touched". A cursor without a trail (B) made select's and epoll's returned frames look the same.
- **Grid scaling**: 8 sockets is one row of 8; 32 and 128 use 16 columns (2 and 8 rows); cells carry their fd number at 8 and 32, none at 128; a phone keeps the same columns with smaller cells so 128 stays 8 rows deep. Approved from a mockup at 744px and 350px.
- **Build: Astro component plus a script module, like the timeline** (approach 1 of three), over a custom element (the only one on the site, no shared init) and a script-drawn SVG (text does not reflow, a second drawing for phones, 128 animated SVG cells).

## 4. The model

`src/lib/figures/io-multiplexing.ts` is pure TypeScript with no DOM. Every number and every sentence the figure shows comes from here; the component imports it at build time for the still frame and the script imports it at run time, so the two cannot disagree.

### 4.1 Mechanisms and counts

```ts
export const MECHANISMS = ["select", "poll", "epoll"] as const;
export type Mechanism = (typeof MECHANISMS)[number];
export const COUNTS = [8, 32, 128] as const;
export type Count = (typeof COUNTS)[number];
export const CALL_NAME: Record<Mechanism, string>; // "select()", "poll()", "epoll_wait()"
export function columns(count: Count): 8 | 16;    // 8 at 8, else 16
export function numbered(count: Count): boolean;  // true at 8 and 32
```

### 4.2 Arrivals and the seed

On each wake every socket independently has a 1-in-12 chance of having data (`ARRIVAL_CHANCE = 1 / 12`), and a wake always has at least one ready socket: if the draw leaves none, one socket chosen by the same generator becomes ready. That gives about 1 ready at 8, 3 at 32 and 10 at 128: a few among many idle, the essay's picture.

```ts
export function seeded(seed: number): () => number;          // mulberry32, values in [0, 1)
export function seedFor(count: Count, n: number): number;     // count * 1000 + n
export function arrivals(count: Count, random: () => number): number[]; // ascending fds, never empty
```

The seed is a function of the count and the wake number only. Wake 3 at 32 sockets delivers the same data to select, poll and epoll, so a tally built from three wakes under each is an honest comparison of the mechanisms rather than of their luck.

### 4.3 A wake

```ts
export interface Wake {
  n: number;            // 1-based wake number for this mechanism at this count
  mechanism: Mechanism;
  count: Count;
  ready: number[];      // from arrivals
  checked: number;      // from checked()
}
export function checked(mechanism: Mechanism, count: Count, ready: number): number;
export function wake(mechanism: Mechanism, count: Count, n: number): Wake;
```

`checked` is the thesis in one line: select and poll examine every descriptor they were handed, so it is `count`; epoll examines only what the kernel returns, so it is `ready`.

### 4.4 Tallies

```ts
export interface Tally { wakes: number; checked: number; ready: number }
export type Tallies = Record<Mechanism, Tally>;
export function emptyTallies(): Tallies;
export function addWake(tallies: Tallies, w: Wake): Tallies; // returns a new object
```

Tallies accumulate across mechanism switches and reset when the count changes. The next wake number for a mechanism is its tally's `wakes + 1`.

### 4.5 The schedule and the frame

```ts
export type Phase = "idle" | "arrive" | "sweep" | "return" | "handle";
export interface Step { phase: Phase; at: number }            // ms from the wake's start
export interface Schedule { steps: Step[]; duration: number } // the loop ends at duration
export const SWEEP_MS: Record<Count, number>;                 // 8: 640, 32: 1280, 128: 2048
export const HOLD_MS;                                         // arrive 350, return 700, handle 450, still 2000, gap 500
export function schedule(mechanism: Mechanism, count: Count, reduceMotion: boolean): Schedule;
export interface Frame { phase: Phase; scan: number | null }  // scan: the index under check during a sweep
export function frameAt(s: Schedule, count: Count, elapsed: number): Frame;
```

With motion, for select and poll: arrive at 0, sweep at 350, return at 350 + sweep, handle at 1050 + sweep, idle at 1500 + sweep, which is the duration. For epoll the sweep step is absent and return follows arrive directly. The sweep durations make 128 one socket per frame at 60Hz and visibly longer than 8.

Under reduced motion the schedule is a single `return` step at 0 with a duration of 2000: the wake jumps to its returned frame with the trail already applied and holds there, so the count checked is still visible on the grid. There is no `idle` step, so the frame stays until the next wake clears it.

`frameAt` returns the phase of the last step whose `at` is at or before `elapsed`. During a sweep, `scan` is `min(count - 1, floor((elapsed - at) / (SWEEP_MS[count] / count)))`; every socket up to and including `scan` is seen. Outside a sweep `scan` is null.

### 4.6 Wording

```ts
export function callStatus(w: Wake | null, mechanism: Mechanism, count: Count, frame: Frame): string;
export function readyLine(w: Wake | null, frame: Frame): { title: string; note: string };
export function readoutText(w: Wake): string;
export function resetText(count: Count): string;
export function tallyText(t: Tally): string;
export const STILL: Wake;            // epoll, 32, ready [4, 19, 27], checked 3, n 0
export function stillText(): string;
```

- Call status by phase. Idle and arrive: "blocked until a descriptor is ready" for select and poll, "blocked until the kernel has an event" for epoll. Sweep: "checking fd 13 of 32" for select, "checking entry 13 of 32" for poll. Return and handle: "checked all 32" for select and poll, "returned 3 events" for epoll (singular when 1).
- Ready line. Before return: title "ready: nothing yet", empty note. From return: title "ready: fd 4, 19, 27", listing up to four fds and then "and 7 more"; note "29 checked for nothing" for select and poll, "the kernel kept the set; nothing else was touched" for epoll.
- Readout. select: "Wake 3: select checked 32 descriptors to find 3 ready." poll: "Wake 3: poll checked 32 entries to find 3 ready." epoll: "Wake 3: epoll_wait returned the 3 ready descriptors without checking the other 29." Singulars where the number is 1.
- Reset, after a count change: "No wakes yet at 128 sockets. Press Next wake."
- Tally: "3 wakes · 96 checked · 9 ready", or "—" when there are no wakes.
- Still: "epoll_wait returned the 3 ready descriptors of 32 without checking the other 29. select or poll would have checked all 32."

## 5. The markup

`src/components/figures/IoMultiplexing.astro` renders one `<figure>` and is imported by the essay's MDX in place of the PNG's figure:

```mdx
import IoMultiplexing from "../../components/figures/IoMultiplexing.astro";

<IoMultiplexing />
```

The figure's root carries `data-io-figure`, the state attributes `data-mechanism="epoll"`, `data-count="32"` and `data-phase="idle"`, and gains `data-live` when the script has upgraded it. Top to bottom:

1. **The toolbar**, `data-io-controls`, rendered with the `hidden` attribute; the script removes it. Two button groups in the zoom control's pattern (`role="group"` with an `aria-label`, buttons with `aria-pressed`): the mechanisms, each button `data-io-mechanism="select"` and so on, and the counts, `data-io-count="8"` and so on. Then a "Next wake" button, `data-io-step`, and a Play toggle, `data-io-play`, with `aria-pressed`. The still frame's buttons are pressed for epoll and 32.
2. **The grid**, `data-io-grid`, `aria-hidden="true"`, with `--cols` from `columns()` and `data-numbered` from `numbered()`. One cell per socket: `data-io-cell`, `data-fd="4"`, a `<span>` with the number, `data-state` in `""`, `"ready"` or `"found"`, and the boolean attributes `data-seen` and `data-scan`. The still frame marks fds 4, 19 and 27 `found`.
3. **The call box**, `data-io-call`, with the call's name in `data-io-call-name` and its status in `data-io-call-status`.
4. **The ready box**, `data-io-ready`, with `data-io-ready-title` and `data-io-ready-note`.
5. **The thread box**, `data-io-thread`, static text: "one thread" and "handles the ready descriptors, then loops back and blocks again".
6. Arrows between the boxes and between the grid and the first box, decorative.
7. **The readout**: a sentence in `data-io-readout` with `aria-live="polite"`, and a tally as a description list with one row per mechanism, the value in `data-io-tally="select"` and so on.
8. **A figcaption**: "One thread, many sockets. Data lands on a few, the wait call reports which, the thread handles those and blocks again. select and poll check every descriptor to find out; epoll is told."

The still frame's boxes use the return wording (`callStatus` and `readyLine` for `STILL` with a return frame: "returned 3 events", "ready: fd 4, 19, 27") while the root's phase is `idle`, so the frame reads as a completed wake with no box lit.

Two rulings. The figure's internals are `div` and `span` (the tally is the one `dl`), never `p`, `ol` or `li`, so the reader's prose rules (60ch paragraphs, list padding, list-item margins) never reach them. And when the count changes the script rebuilds the grid by cloning the first server-rendered cell, so Astro's scoped-style attribute survives on every cell and no rule needs `:global()`.

## 6. Styling

Scoped styles in the component. The lane colour arrives as `--c` from the reader frame.

- **Cells**: square (`aspect-ratio: 1`), a 1px border in `--color-border` on `--color-bg-elevated`, a 3px radius, the number in the mono font at 11px in `--color-text-faint`. `[data-state="ready"]`: `--c` border and a 16% `--c` tint. `[data-state="found"]`: solid `--c`. `[data-seen]`: background and border darker than the page (`color-mix` of `--color-bg` with black). `[data-scan]`: a 2px ring in `--color-text-primary` via `box-shadow`. The number is hidden when the grid is not `data-numbered`. Transitions of 150ms on background and border, none under reduced motion.
- **Grid**: `grid-template-columns: repeat(var(--cols), 1fr)`, a 5px gap, 3px below 900px.
- **Boxes**: bordered like the cells, centred text, the name in `--color-text-primary` at 600 weight, the status in `--color-text-muted` at 12.5px. The active box takes a `--c` border: the call box during sweep, the ready box at return, the thread box at handle, driven by the root's `data-phase`.
- **Toolbar**: the zoom control's look (mono 12px buttons, pressed state in `--color-bg-hover` and `--color-text-primary`), wrapping below 900px. "Next wake" has a `--c` border and text. Focus rings in `--c`, 2px, offset 2px, as the reader's links.
- **Readout**: a top border, the sentence in `--color-text-primary`, the tally in the mono font at 12px with the mechanism names muted.

## 7. The script

`src/scripts/figures/io-multiplexing.ts` exports `initIoFigure()`, which aborts any previous run, finds `[data-io-figure]`, returns if there is none, and otherwise upgrades it. All listeners hang off one AbortController's signal; the abort handler cancels the running frame and disconnects the observer. The file calls `initIoFigure()` once at load, like `reader.ts`.

- **Upgrade.** Remove `hidden` from the toolbar; set `data-live` on the root. Read mechanism and count from the root's attributes. Start with empty tallies and the still frame on screen; the first wake clears it.
- **A wake.** On "Next wake": compute `wake(mechanism, count, tallies[mechanism].wakes + 1)`, read reduced motion from `matchMedia`, take `schedule()`, clear the grid, and run one `requestAnimationFrame` loop. Each frame asks `frameAt` for the elapsed time and paints only when the frame differs from the last painted one: ready sockets get `data-state="ready"` at arrive; during a sweep every socket up to `scan` gets `data-seen` and `scan` alone gets `data-scan`; at return the ready sockets become `found`, the ready box fills, the readout and the tally update (`addWake`); at handle the thread lights and the ready sockets and seen marks clear; at idle the call status returns to blocked. The root's `data-phase` follows the frame's phase. The loop ends at `duration`. Because it runs on animation frames, a hidden tab pauses a wake cleanly.
- **Play** toggles `aria-pressed` and runs wakes back to back with the 500ms gap, measured on the same frame loop. It turns off when toggled, on a count change, and when the figure leaves the viewport (an IntersectionObserver on the root); a wake already running finishes.
- **Controls during a wake.** "Next wake" carries `aria-disabled="true"` while a wake runs and clicks are ignored, so focus stays where it is. Pressed during Play's gap, it starts the next wake at once and Play continues. A mechanism switch presses its button, sets the root's `data-mechanism`, updates the call's name and, when no wake is running, its idle status; a running wake keeps the mechanism it started with. A count switch cancels the running wake, paints idle, rebuilds the grid by cloning the first cell, sets `--cols` and `data-numbered`, resets the tallies and their rows, writes `resetText`, and stops Play.
- **Reduced motion** is read at each wake's start, so a preference change applies to the next wake.

No URL state. Nothing is persisted.

## 8. Accessibility

- Every control is a native button. The two groups and the Play toggle expose state through `aria-pressed`; "Next wake" through `aria-disabled` while running.
- The grid is `aria-hidden`: it is decorative, and the readout carries its meaning. The boxes' text is readable but not live.
- The readout sentence is the only live region, `polite`, and changes once per wake at return, so a screen reader hears one sentence per wake and nothing during a sweep.
- Under reduced motion there is no sweep and no transition; a wake is a single repaint.
- Without JavaScript the reader sees the still frame and its sentence, and no controls.

## 9. Files

- `src/lib/figures/io-multiplexing.ts` — the model (§4).
- `src/lib/figures/__tests__/io-multiplexing.test.ts` — its unit tests.
- `src/components/figures/IoMultiplexing.astro` — markup, styles, and `<script>import "../../scripts/figures/io-multiplexing";</script>`.
- `src/scripts/figures/io-multiplexing.ts` — the client (§7).
- `src/content/blog/io-multiplexing.mdx` — imports and places the component; the PNG figure goes.
- `public/images/io_multiplexing_select_poll_epoll.png` — deleted.
- `src/__tests__/figure-contract.test.ts` — the contract test (§10).
- `scripts/interactions.mjs` — a new section (§10).
- `CLAUDE.md` — a "Figures" paragraph under Architecture and the `npm run e2e` line.

## 10. Testing

**Unit** (`src/lib/figures/__tests__/io-multiplexing.test.ts`):

- `seeded` repeats for a seed and differs across seeds; `seedFor` differs across counts and wake numbers.
- `arrivals` is never empty, ascending, within range, and lands near 1 in 12 over many wakes.
- `checked` is the count for select and poll and the ready size for epoll.
- `wake` with the same count and number gives the same `ready` for all three mechanisms.
- `addWake` accumulates and returns a new object; `emptyTallies` is all zeros.
- `schedule` has the five steps in order for select and poll, no sweep for epoll, and a single return step with the still duration under reduced motion; durations match `SWEEP_MS` and `HOLD_MS`.
- `frameAt` at half the sweep points at the middle socket, at the sweep's end at the last, and returns null outside a sweep; at `duration` it is idle with motion and return without.
- Wording at 8, 32 and 128, including "and 7 more", singulars, the reset and still sentences, and the dash for an empty tally.
- `columns` and `numbered`.

**Contract** (`src/__tests__/figure-contract.test.ts`, skipped without `dist/`): scans `dist/blog/*/index.html` and asserts that exactly one page carries `data-io-figure`, then on that page: the toolbar ships `hidden`; the grid is `aria-hidden` with 32 cells and exactly three `found`; the readout is `aria-live="polite"` and contains the still sentence; the root is `data-mechanism="epoll"`, `data-count="32"`, `data-phase="idle"` and not `data-live`; and every hook in §5 is present.

**e2e** (`scripts/interactions.mjs`, on the essay at desktop and phone widths):

- The toolbar is visible and the root is `data-live`.
- Under select at 32, "Next wake" leads to a `return` phase with 32 seen cells and as many `found` cells as the readout names, then to `idle` with none. Waits are on the root's `data-phase`, bounded by the schedule's duration.
- The select tally row fills in; the epoll row stays a dash.
- Switching to epoll and waking leads to a `return` phase with no seen cells and the same ready fds as select's wake with that number.
- Switching the count resets every tally row to a dash and rebuilds the grid with the new cell count and columns.
- Play pressed runs at least two wakes and stops when pressed again.
- With `page.emulateMedia({ reducedMotion: "reduce" })`, a wake never shows a `data-scan` cell and ends on `return`.
- No page errors throughout.

## 11. Inputs needed during implementation

- The figcaption, the readout sentences and the box statuses (§4.6, §5) are drafted here in Sean's plain register; he may want to tune them once they are on the page.
- The arrival chance and the sweep durations are starting values; check them on the built page at 128 and adjust in the model if the sweep feels too fast or the grid too sparse.

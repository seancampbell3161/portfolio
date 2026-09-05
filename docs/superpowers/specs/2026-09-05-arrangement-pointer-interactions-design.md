# Arrangement, interactions 1: Scrub and pan

Design spec, 2026-09-05. Approved section by section in brainstorming the same day.

## 1. Context

The Arrangement redesign is complete (specs of 2026-09-02 and 2026-09-03 under `docs/superpowers/specs/`). The home page is a studio-console arrangement: four lanes on one time axis, a playhead at now, a zoom control with three presets (year, three years, all), an all-time overview strip above the ruler with the visible window boxed, and an inspector that opens below when a clip is clicked. Visually it carries the console idea; interactively a visitor can only click a clip and switch zoom.

On 2026-09-05 Sean chose seven interaction and visual features from a longer list and agreed to build them as six sub-projects in this order:

1. **Arrangement pointer interactions: scrub the playhead and drag the overview window** (this spec).
2. A "right now" line in the hero, reusing the at-this-date helper from this sub-project.
3. Project thumbnails inside long building clips.
4. Essay reader frame: reading progress line and sticky sidebar.
5. An interactive diagram for the I/O multiplexing essay.
6. View transitions between pages, last, because every page-load script must become re-runnable first.

Every client script written in the earlier sub-projects uses a re-runnable init so sub-project 6 is a migration rather than a rewrite.

## 2. Scope

In scope:

- Scrubbing: a hover cursor on the ruler with a date chip, dimming of clips that do not touch the cursor's date, click to pin, an "On this date" panel in the inspector area, a shareable `#on-YYYY-MM-DD` hash, and full keyboard operation of the ruler as a slider.
- Panning: the overview strip as a drag and tap control that moves the window in whole-year steps, a year offset in the window math, keyboard operation of the strip as a slider, and touch support so the phone graph pans too.
- The client script `src/scripts/timeline.ts` split into a folder of modules with one job each and a small shared store.
- Pure helpers with unit tests in `src/lib/timeline/`, and a dist-reading contract test for the home page's script hooks.

Out of scope:

- The roadmap arrangement does not pan or scrub in this sub-project.
- The playhead never moves; "now" stays now everywhere the page prints it.
- No server-rendered date panels; scrubbing and panning are JavaScript-only, like zoom.
- No scrubbing below 900px, where there is no horizontal ruler.
- No remembered pan offset.

## 3. Decisions from brainstorming

- **Scrub means a second cursor, not a moving playhead** (option A of three). The playhead stays at now, in-progress clips keep running up to it, and the inspector's "to now" wording stays true. Moving the playhead itself would have re-laid every ongoing item on each move and broken the meaning of "now" across the page. A hover-only cursor was rejected because it leaves nothing to land on and nothing for keyboard users.
- **The ruler is the scrub bar, not the lanes.** Hovering a clip label must never dim anything, and a moment's label extends weeks to the right of its dot at the year zoom, so lane hover would have dimmed the very clip under the pointer.
- **Panning snaps to whole years** (option A over a free window). The three presets keep their names and their ruler granularity, the corner label and lane summaries work unchanged, and layout re-packs only when the rounded offset changes rather than on every pointer move. A free window would have needed span-derived tick granularity, new label wording for partial years, and flickering moment labels while dragging.
- **The overview drag works at every width; scrubbing at 900px and up.** The window is already shared between the arrangement and the phone graph, so panning the graph costs only touch handling, and it fixes a real gap: a phone visitor today cannot see 2024 at month detail at all.
- **The client script is split by concern** (option A over growing the file in place, and over server-rendering per-month panels). Sean's global instructions weigh maintainability over build cost, and sub-project 6 pays the split back directly.
- **Pan offset is not persisted.** Zoom stays remembered because it is a display preference; pan is a position, and a returning visitor should land on now. The two hash deep links carry position when it matters.

## 4. Scrubbing

### 4.1 The cursor

The ruler (`.tl-ruler`, 900px and up) is the scrub bar. Hovering it shows the cursor: a 1px vertical line in the secondary text color running from the ruler down through the lanes, thinner and dimmer than the playhead, with a date chip on the ruler at the cursor's x. The chip uses the mono font and matches the playhead's "now" chip in size and shape. The date has day precision and is formatted by `longDate` from `src/lib/dates.ts` (UTC).

The cursor's date is `dateAt(fraction, win)`: the pointer's x as a fraction of the ticks area (`[data-ticks]`, the ruler minus the corner label, which is the same width as the clip area), mapped into the current window and floored to a UTC day. The ruler's corner label is not part of the scrub bar. Scrubbing covers the whole window, including months of the current year still ahead of now; planned learning clips then show with their planned wording.

While a cursor is showing (hovering or pinned), every clip that does not touch the cursor's date dims to about a third opacity with no transition. A span touches the date when the date lies between its start and its effective end (its end, or now when ongoing). A moment touches when it lands within 14 days of the date, the same `MOMENT_WINDOW_DAYS` window "Written while" uses.

The cursor is positioned by the same `--x` custom property the playhead uses and is never animated.

### 4.2 Pinning

Pointer down on the ruler pins the cursor at that date; moving while held drags it; release leaves it pinned. A pinned cursor stays when the pointer leaves the ruler and stays through zoom and pan. It is drawn only while its date is inside the current window; when the date is outside, the line and chip hide but the pin, the panel and the hash remain. Pinning does not move keyboard focus. Pointer up after a pin scrolls the panel into view with `block: "nearest"`, mirroring an item click.

Pointer down while already pinned moves the pin. Escape unpins.

A pinned date is also marked in the overview strip as a 1px tick at the date's all-time position, so the pin stays visible after panning away from it.

### 4.3 The "On this date" panel

`Inspector.astro` renders one extra panel, `#on-date`, in the same `.insp` frame as the item panels: a kicker "On this date", an empty `h2`, an empty list and a Close link. Its top rule uses the primary text color rather than a lane color, since a date belongs to no lane. The server renders it hidden; the script fills it.

On pin the script writes the long date into the heading and fills the list from `onDate(items, date, now)`: touching items in lane order (writing, building, learning, community) then by start. Each entry shows a lane dot in the lane color, the item's title as a link to `#item-<id>`, and `whenText(item)` from the track module as a short status phrase. An empty result renders one line: "Nothing on the timeline that day."

Following an entry link opens that item's panel through the existing inspector code, which unpins.

### 4.4 The hash

Pinning sets the hash to `#on-YYYY-MM-DD` via `history.replaceState`, so a date is shareable. Unpinning clears it. On load a matching hash pans the window to the smallest offset that shows the date (`offsetToShow`), pins it, fills the panel and scrolls it near, with no focus move and no playhead draw-in, mirroring the item deep link. Without JavaScript the hash matches nothing and the page is unchanged.

### 4.5 Keyboard

The script upgrades the ruler into a focusable slider: `tabindex="0"`, `role="slider"`, `aria-label="Scrub the timeline"`, `aria-valuemin="0"`, `aria-valuemax` the number of days in the all-time window, `aria-valuenow` the pinned date's day index in that window (`dayIndex`), `aria-valuetext` the long date. Before any pin the value is now.

- Left and right step one month; Shift plus left or right steps one year (`stepDate`), clamped to the all-time window.
- Home and End go to the current window's from and to.
- Stepping past the visible window changes the offset by a year so the cursor stays on screen. The store applies the layout; the pin is unchanged.
- Any step pins (if not already pinned) and refreshes the panel without moving focus, so the visitor can keep scrubbing.
- Enter moves focus into the panel.
- Escape anywhere unpins, closes the panel, and returns focus to the ruler.

## 5. Panning

### 5.1 The window offset

`windowFor(zoom, now, items, offset = 0)` shifts the preset window back by `offset` whole years, moving both from and to with `setUTCFullYear`. Offset zero is today's behavior. The bound is one rule for every zoom: `maxOffset(zoom, now, items)` is the current year minus the earliest item's start year, and zero for All.

### 5.2 The control

The whole overview strip (`.tl-ov`) is the control, not only the window box, so the hit target is generous on phones.

- **Drag.** Pointer down starts a drag with pointer capture. While dragging, the box follows the pointer, clamped to the strip, and the candidate offset is `offsetForDrag(startOffset, deltaFraction, ...)`: the delta as a fraction of the all-time window, converted to years, rounded and clamped. Each time the rounded offset changes the store applies the layout, so the arrangement re-lays as years slide past. On release the box settles on the offset's exact position with no animation.
- **Tap.** A press that moves less than 4px is a tap. A tap moves the window to include the year under the pointer with the smallest move: the tapped x mapped through `dateAt` in the all-time window, then `offsetToShow` on that date. It does nothing if the year is already visible.
- **Touch.** The strip gets `touch-action: pan-y`, so a vertical swipe still scrolls the page and only horizontal movement pans. The phone graph already filters its rows by the window, so it follows.

### 5.3 Zoom buttons

The offset survives switching between year and three years: offset 2 at year shows 2024, and at three years shows 2022 to 2024. Switching to All resets the offset to zero, and coming from All the offset is zero.

At the year zoom the first button's text is the window's year, not always the current year. When panned, pressing it returns to this year, and its accessible name says so ("Back to 2026"). When not panned its name is the year, as today. The other buttons and the date in the transport bar do not change.

### 5.4 Keyboard

The script upgrades the strip into a focusable slider: `tabindex="0"`, `role="slider"`, `aria-label="Visible years"`, `aria-valuemin` the earliest item's year, `aria-valuemax` the current year, `aria-valuenow` the window's last year, `aria-valuetext` the corner label ("2024" or "2022 to 2024"). Left and right step a year; Home and End go to the earliest and the current year.

### 5.5 Persistence

`timeline-zoom` in `localStorage` stays as it is. The offset is not stored.

## 6. Pure math

All in `src/lib/timeline/`, no DOM, covered by Vitest.

### 6.1 Additions to `layout.ts`

```ts
export function windowFor(zoom: Zoom, now: Date, items: readonly TimelineItem[], offset = 0): Window;
export function maxOffset(zoom: Zoom, now: Date, items: readonly TimelineItem[]): number;
/** Smallest clamped offset whose window contains `date`. */
export function offsetToShow(date: Date, zoom: Zoom, now: Date, items: readonly TimelineItem[]): number;
/** Drag delta as a fraction of the all-time window -> years -> rounded and clamped. Dragging right (later) lowers the offset. */
export function offsetForDrag(startOffset: number, deltaFraction: number, zoom: Zoom, now: Date, items: readonly TimelineItem[]): number;
```

Ticks, packing, lane summaries, the phone graph and the width estimator take a window and never see the offset.

### 6.2 Addition to `track.ts`

```ts
/** Spans containing `date`, moments within MOMENT_WINDOW_DAYS of it, every lane; lane order then start then id. */
export function onDate(items: readonly TimelineItem[], date: Date, now: Date): TimelineItem[];
```

Shares `spanTouches` with the two existing overlap helpers.

### 6.3 New `scrub.ts`

```ts
/** `fraction` of the window, floored to a UTC day, clamped to [from, to]. */
export function dateAt(fraction: number, win: Window): Date;
export function stepDate(date: Date, unit: "month" | "year", direction: -1 | 1, bounds: Window): Date;
/** Whole days from `win.from` to `date`; aria-valuenow. */
export function dayIndex(date: Date, win: Window): number;
export function parseHash(hash: string): { kind: "item"; id: string } | { kind: "on"; date: Date } | null;
export function hashFor(date: Date): string; // "#on-YYYY-MM-DD"
```

`stepDate` by a month lands on the same day of the next or previous month, falling back to that month's last day when the day does not exist (January 31 to February 28 or 29), and clamps to `bounds`.

## 7. Markup and styles

### 7.1 Roles come from the script

The strip and the ruler carry `aria-hidden="true"` in the built HTML, as today. The client script removes that attribute, adds the slider role, tabindex and value attributes, and wires the handlers. A visitor without JavaScript never meets a focusable control that does nothing, the rule the zoom buttons already follow.

### 7.2 `Timeline.astro`

The server adds two hidden elements the script drives:

- the cursor: `<div class="tl-cursor" data-cursor hidden><span data-cursor-label></span></div>` inside the stage, positioned by `--x` like the playhead;
- the pin tick: `<i class="tl-ov-pin" data-ov-pin hidden></i>` inside the overview strip, positioned by `--x` in the all-time window.

Dimming is CSS keyed on two attributes the script sets: `data-scrubbing` on the root while a cursor is showing, and `data-touch` on each item that touches the date. Rule: `.tl[data-scrubbing] .tl-item:not([data-touch]) { opacity: .35 }`, no transition.

Below 900px the cursor is hidden with the ruler and playhead. The strip remains and carries the drag handling.

### 7.3 `Inspector.astro`

One extra panel as in 4.3, with `id="on-date"`, `tabindex="-1"`, `role="region"`, `aria-labelledby` pointing at its heading, hidden by default. The list is `<ul data-on-date-list>`; the heading carries `data-on-date-title`.

### 7.4 `TransportBar.astro`

No markup change. The script rewrites the year button's text and `aria-label` as in 5.3.

### 7.5 Styles

- Strip: `cursor: grab`, `cursor: grabbing` while dragging (a `data-dragging` attribute), `touch-action: pan-y`, `user-select: none`, the site's `:focus-visible` ring.
- Ruler: `cursor: crosshair`, the same focus ring.
- Cursor line: 1px, secondary text color, from the ruler's top to the lanes' bottom, above clips and below the playhead in stacking.
- Chip: the playhead's "now" chip styles with the secondary color.
- Pin tick: 1px, primary text color, full strip height.
- Date panel: `.insp` frame with `--c` set to the primary text color; entries as a list with a lane dot, the title link and the status phrase in the muted color.

### 7.6 Contract test

`src/__tests__/home-contract.test.ts` reads `dist/index.html` and asserts the hooks the script depends on are present: `data-cursor`, `data-cursor-label`, `data-ov-pin`, `data-ov-window`, `data-ticks`, `data-playhead`, `id="on-date"`, `data-on-date-list`, `data-on-date-title`, and the zoom buttons' `data-zoom` values. Skipped without a build, run by `npm run check`, in the same shape as the roadmap contract test.

## 8. Client script

### 8.1 Modules

`src/scripts/timeline.ts` becomes `src/scripts/timeline/`:

```
index.ts      marks html.js, reads items from the DOM, builds the shared context, runs each init
items.ts      DOM -> TimelineItem[] and the measured width estimator, moved as is
state.ts      { zoom, offset, pinned, openId }, set() notifying listeners, zoom persistence
apply.ts      one window in; positions, ticks, summaries, playhead, graph and year button out; moved
inspector.ts  open and close for items, plus filling the date panel; moved and extended
scrub.ts      ruler pointer and keyboard, the cursor element, dimming, the on-date hash
pan.ts        strip pointer and keyboard, box tracking while dragging
motion.ts     the one-time playhead draw-in, moved
```

Every module exports `init(ctx)` that registers listeners; every listener is safe to register twice. `src/pages/index.astro` imports `../scripts/timeline/index`. The first implementation task is a pure move with no behavior change, verified against the current page before anything new is added.

### 8.2 State

Exactly one of: nothing, an item open, a date pinned. The hash mirrors it: `#item-<id>`, `#on-YYYY-MM-DD`, or none. Pinning closes an open item; opening an item unpins. Every change to zoom or offset goes through the store and one listener re-applies layout, so scrub, pan, the zoom buttons and the deep links never call layout directly. Escape resolves whichever is open.

### 8.3 Load order

1. Parse the hash.
2. An item hash: widen the zoom until the item is visible (existing behavior), open it, no playhead draw-in.
3. A date hash: set the offset from `offsetToShow`, pin, fill the panel, scroll it near, no focus move, no draw-in.
4. Otherwise: stored zoom, offset zero, playhead draws in unless reduced motion.
5. Resize re-applies the current window (existing behavior).

### 8.4 Failure rules

- A malformed `#on-` hash is ignored; the page loads as with no hash.
- Storage failures stay try-caught; the zoom simply is not remembered.
- A window that does not contain the pinned date hides the cursor but keeps the pin, the panel and the hash.
- `pointerdown` without pointer capture support is not handled specially; every supported browser has it.

## 9. Files

New:

- `src/lib/timeline/scrub.ts`, `src/lib/timeline/__tests__/scrub.test.ts`
- `src/scripts/timeline/{index,items,state,apply,inspector,scrub,pan,motion}.ts`
- `src/__tests__/home-contract.test.ts`

Changed:

- `src/lib/timeline/layout.ts` and its test (offset, `maxOffset`, `offsetToShow`, `offsetForDrag`)
- `src/lib/timeline/track.ts` and its test (`onDate`)
- `src/components/Timeline.astro` (cursor, pin tick, strip and ruler styles, dimming rules)
- `src/components/Inspector.astro` (the date panel)
- `src/pages/index.astro` (script import path)
- `CLAUDE.md` and `README.md` (the script folder, the new interactions, the JavaScript-only note)

Removed:

- `src/scripts/timeline.ts`

## 10. Accessibility

- Both controls are sliders with min, max, now and value text, operable with arrows, Home and End, and visible with the site's focus ring.
- Pinning never steals focus; Enter on the ruler moves into the panel; Escape returns focus to the ruler.
- The date panel is a labelled region like the item panels. Its entries are real links, so a screen-reader user reaches each item through it.
- The cursor line, chip and pin tick are `aria-hidden`; the slider's value text carries the date.
- No motion is added. Dimming has no transition. `prefers-reduced-motion` keeps suppressing the playhead draw-in.
- Dimmed clips stay focusable and readable at a third opacity; the focus ring is not dimmed because it is drawn on the clip's own outline in full lane color.

## 11. Testing

- Unit, `layout.test.ts`: offset zero equals today's windows; offset shifts both ends by whole years; `maxOffset` is current year minus earliest year and zero for All; `offsetToShow` for a date in the current year, in the earliest year, and at a year boundary; `offsetForDrag` rounds at the half-year, clamps at both ends, and dragging right lowers the offset.
- Unit, `track.test.ts`: `onDate` includes a span on its first and last day, an ongoing span up to now, a moment 14 days away, excludes a moment 15 days away, orders by lane then start, and returns empty for an empty day.
- Unit, `scrub.test.ts`: `dateAt` floors to a UTC day and clamps; `stepDate` month steps across a year end, January 31 to February, December to January by year, and clamps; `dayIndex`; `parseHash` for both shapes and for malformed input; `hashFor` round-trips through `parseHash`.
- Contract, `home-contract.test.ts` as in 7.6.
- `npm run check` green.
- Manual on `npm run preview` at 1280 and 390 wide: hover and chip, drag and release, tap in the strip, month and year keys on both sliders, Enter into the panel, Escape, both deep links, a zoom switch while panned and while pinned, All resetting the offset, the year button's label and name while panned. `npm run shots` to confirm the static views are unchanged.

## 12. Inputs needed during implementation

None. All dates and content already exist; this sub-project adds interaction over them.

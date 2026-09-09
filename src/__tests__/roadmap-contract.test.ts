// The roadmap page is server-rendered markup driven by two client scripts that
// this redesign never edits (src/scripts/roadmap.ts, src/scripts/review.ts).
// They find their targets by id and data attribute, so a markup change can break
// saved progress with a green unit suite and a clean build. This test reads the
// built page and asserts every hook is still there.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first and then runs the suite; plain `npm test` still works on its own.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { allIds, logIds, build, reading, phases } from "../data/roadmap";
import { phaseSpanText } from "../lib/roadmap/schedule";
import { roadmapClips } from "../lib/roadmap/arrange";

const PAGE = "dist/roadmap/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("roadmap client contract (dist/roadmap/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  // Fixed ids, derived from the two scripts. roadmap.ts: setText/setWidth targets,
  // the edit button, the message line, the save state, and the page root class.
  const ROADMAP_IDS = [
    "rm-edit", "rm-message", "rm-save-state",
    "rm-build-stages", "rm-build-courses", "rm-build-bar",
    "rm-read-ch", "rm-read-books", "rm-read-bar",
    "rm-fnd-done", "rm-fnd-bar", "rm-logs-done", "rm-clip-live",
  ];
  // review.ts: the runner, the card faces, the counters and the message line.
  const REVIEW_IDS = [
    "rv-runner", "rv-runner-done", "rv-runner-locked", "rv-card", "rv-front", "rv-back",
    "rv-reveal", "rv-ratings", "rv-message", "rv-save-state", "rv-thread",
    "rv-due-count", "rv-streak", "rv-rotation-count", "rv-rotation-summary", "rv-rotation-empty",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toMatch(/class="roadmap-page"/);
  });

  it("keeps every fixed element id", () => {
    for (const id of [...ROADMAP_IDS, ...REVIEW_IDS]) {
      expect(html, `missing id ${id}`).toContain(`id="${id}"`);
    }
  });

  it("keeps the owner's controls outside the arrangement that is hidden below 900px", () => {
    // .rm-arr is display:none below 900px, but edit mode must still work there
    // (the owner may check things off on a phone) — that's why #rm-edit and
    // #rm-message live in the toolbar, before .rm-arr opens, rather than inside
    // it. A future re-indent that moves the toolbar back inside .rm-arr would
    // satisfy every other assertion here while silently killing edit mode on
    // phones, so this checks document order rather than mere presence.
    const editAt = html.indexOf('id="rm-edit"');
    const messageAt = html.indexOf('id="rm-message"');
    const arrAt = html.indexOf('class="rm-arr"');
    expect(editAt, "rm-edit not found").toBeGreaterThan(-1);
    expect(messageAt, "rm-message not found").toBeGreaterThan(-1);
    expect(arrAt, "rm-arr not found").toBeGreaterThan(-1);
    expect(
      editAt,
      "#rm-edit must appear before .rm-arr opens — .rm-arr is hidden below 900px, but edit mode is not, so the owner's controls cannot live inside it",
    ).toBeLessThan(arrAt);
    expect(
      messageAt,
      "#rm-message must appear before .rm-arr opens — .rm-arr is hidden below 900px, but edit mode is not, so the owner's controls cannot live inside it",
    ).toBeLessThan(arrAt);
  });

  it("keeps a checkbox for every leaf id, because progress is stored by id", () => {
    // The frozen script only wires up input[data-id] and sets its .checked /
    // .disabled — if data-id moved onto a wrapper element, or the element
    // weren't a real checkbox, a plain substring check would still pass while
    // saving broke. Both attributes must sit on the SAME <input> tag; they are
    // matched with lookaheads so neither attribute's position relative to the
    // other is assumed (today's built markup happens to write type="checkbox"
    // before data-id, but nothing pins that order).
    for (const id of allIds) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `<input\\b(?=[^>]*\\bdata-id="${escaped}")(?=[^>]*\\btype="checkbox")[^>]*>`,
      );
      expect(html, `data-id ${id} is not on a checkbox <input>`).toMatch(re);
    }
  });

  it("keeps a percentage hook for every milestone and every book", () => {
    for (const m of build) expect(html, `missing milestone ${m.id}`).toContain(`data-milestone-pct="${m.id}"`);
    for (const b of reading) expect(html, `missing book ${b.id}`).toContain(`data-book-pct="${b.id}"`);
  });

  it("keeps the live-progress hooks on every clip, on all three surfaces", () => {
    // Every clip is rendered three times over: the desktop arrangement clip,
    // the mobile graph row, and the inspector panel's kicker. All three are
    // server-rendered from an EMPTY completed set, so all three are wrong until
    // src/scripts/roadmap.ts rewrites them from the saved progress. A hook that
    // survives on one surface and not the others leaves the page half-stale --
    // which is the bug this contract exists to prevent coming back.
    const countOf = (needle: string) => html.split(needle).length - 1;
    for (const c of roadmapClips(new Set<string>(), new Date())) {
      expect(
        countOf(`data-clip-id="${c.id}"`),
        `clip ${c.id}: the status class is rewritten on the desktop clip and the graph row`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        countOf(`data-clip-sub="${c.id}"`),
        `clip ${c.id}: the count is rewritten on the desktop clip and the graph row`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        countOf(`data-clip-status="${c.id}"`),
        `clip ${c.id}: the spoken status is rewritten on both clips and the panel kicker`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every decision log with its four fields and its status line", () => {
    for (const id of logIds) {
      expect(html, `missing log ${id}`).toContain(`data-log-id="${id}"`);
    }
    for (const field of ["prediction", "confrontation", "verdict", "confidence"]) {
      expect(html, `missing log field ${field}`).toContain(`data-log-field="${field}"`);
    }
    expect(html).toContain("data-log-status");
  });

  it("keeps the review deck's rating buttons and per-thread counters", () => {
    for (const rating of [0, 1, 2, 3]) {
      expect(html, `missing rating ${rating}`).toContain(`data-rv-rate="${rating}"`);
    }
    for (const thread of ["build", "reading", "foundations", "judgment", "behavioral"]) {
      expect(html, `missing thread count ${thread}`).toContain(`data-rv-thread-count="${thread}"`);
    }
  });

  it("renders the this-week band with real text before any script runs", () => {
    expect(html).toContain("data-this-week");
    // One of the five band states from spec §7. Asserted by text, not by
    // attribute adjacency: Astro injects scoped data-astro-cid-* attributes
    // whose position in the tag is not guaranteed.
    expect(html).toMatch(/Week \d+ of 22|Ramp week|The plan (starts|is finished)/);
  });

  it("keeps the hooks the band's script writes into", () => {
    for (const hook of ["data-week-label", "data-week-panel"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  /** The markup of the one phase panel the build left visible, if any. */
  const visiblePanel = (): string | null => {
    const tags = [...html.matchAll(/<div[^>]*\sdata-week-panel="([a-z0-9]+)"[^>]*>/g)];
    const open = tags.find((m) => !/\shidden[\s>]/.test(m[0]));
    if (!open) return null;
    const start = open.index!;
    const next = tags.find((m) => m.index! > start);
    return html.slice(start, next ? next.index! : html.indexOf("</section>", start));
  };

  it("server-renders every phase panel and reveals exactly one", () => {
    // The band's per-phase panels are what stop a stale deploy showing one
    // phase's heading above another phase's reading list. Without this, that
    // guarantee is only ever checked by hand.
    const tags = [...html.matchAll(/<div[^>]*\sdata-week-panel="([a-z0-9]+)"[^>]*>/g)];
    expect(tags).toHaveLength(phases.length);

    const visible = tags.filter((m) => !/\shidden[\s>]/.test(m[0])).map((m) => m[1]);
    expect(visible.length, "more than one phase panel is visible").toBeLessThanOrEqual(1);

    // Whenever the label names a week, a phase is running, so one panel must show.
    const label = html.match(/data-week-label[^>]*>([^<]+)</)?.[1] ?? "";
    if (/Week \d+ of \d+|Ramp week/.test(label)) {
      expect(visible, `label reads "${label}" but no panel is visible`).toHaveLength(1);
    }
  });

  it("renders the phase arc with one segment per phase", () => {
    expect(html).toContain("data-roadmap-arc");
    const segments = html.match(/data-arc-phase="/g) ?? [];
    expect(segments).toHaveLength(7); // ramp + M1–M5 + capstone
    expect(html).toContain("W0");      // the single-week ramp, not "W0–0"
    expect(html).toContain("W20–22");  // a real range
  });

  it("names, in the Redis panel, the chapters read alongside it", () => {
    const panel = html.slice(html.indexOf('id="clip-redis"'), html.indexOf('id="clip-sqlite"'));
    expect(panel).toContain("data-pairing-list");
    expect(panel).toContain("alongside RDB/AOF");     // the schedule's own reason
    expect(panel).toMatch(/Storage and Retrieval/i);  // a resolved chapter title, not an id
  });

  it("says which weeks the visible panel's lists actually cover", () => {
    // The heading counts one week; the lists below it cover a whole phase. The
    // band has to say so, or seven weeks of reading looks like one week's.
    const panel = visiblePanel();
    if (!panel) return; // outside the plan there is no panel to scope
    const id = panel.match(/data-week-panel="([^"]+)"/)![1];
    const phase = phases.find((p) => p.id === id)!;
    expect(panel).toContain(phaseSpanText(phase));
    expect(panel).toContain(phase.label);
  });

  it("prints each book's title once, however many of its chapters a phase carries", () => {
    // M1 reads seven OSTEP chapters. Flat, that repeated the book's title seven
    // times — the thing that made the band unreadable.
    const panel = html.slice(html.indexOf('data-week-panel="m1"'), html.indexOf('data-week-panel="m2"'));
    const book = "Operating Systems: Three Easy Pieces";
    expect(panel.split(book)).toHaveLength(2); // one occurrence
    expect(panel).toContain("P1. Persistence");   // still every chapter
    expect(panel).toContain("C3. Concurrency");
  });

  it("derives a foundation item's workload rather than repeating it in a note", () => {
    const panel = html.slice(html.indexOf('data-week-panel="m1"'), html.indexOf('data-week-panel="m2"'));
    expect(panel).toContain("7 problems");  // fd.nc.stack's own `total`
    expect(panel).not.toMatch(/<small[^>]*>\s*7\s*<\/small>/); // never the bare number
  });
});

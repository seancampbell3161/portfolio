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
import { allIds, logIds, build, reading } from "../data/roadmap";

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
    "rm-fnd-done", "rm-fnd-bar", "rm-logs-done",
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
});

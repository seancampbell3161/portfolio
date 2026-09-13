// The roadmap page is server-rendered markup driven by client scripts, chiefly
// src/scripts/roadmap.ts. They find their targets by id and data attribute, so a
// markup change can break saved progress with a green unit suite and a clean
// build. This test reads the built page and asserts every hook is still there.
// The current phase, the routine and the review deck live on /roadmap/now, whose
// contract is src/__tests__/roadmap-now-contract.test.ts.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first and then runs the suite; plain `npm test` still works on its own.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { allIds, logIds, build, reading } from "../data/roadmap";
import { roadmapClips } from "../lib/roadmap/arrange";

const PAGE = "dist/roadmap/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("roadmap client contract (dist/roadmap/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  // Fixed ids, derived from src/scripts/roadmap.ts: its setText/setWidth
  // targets, the edit button, the message line, the save state and the live
  // region.
  const ROADMAP_IDS = [
    "rm-edit", "rm-message", "rm-save-state",
    "rm-build-stages", "rm-build-courses", "rm-build-bar",
    "rm-read-ch", "rm-read-books", "rm-read-bar",
    "rm-fnd-done", "rm-fnd-bar", "rm-logs-done", "rm-clip-live",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toMatch(/class="roadmap-page"/);
  });

  it("keeps every fixed element id", () => {
    for (const id of ROADMAP_IDS) {
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

  it("never repeats an element id", () => {
    // CheckItem and DecisionLog put real ids on their inputs, matched by <label for>
    // and aria-labelledby. A milestone rendered twice on one page would repeat
    // them, and a label would quietly tick the wrong checkbox (roadmap-now spec §6).
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("names, in the Redis panel, the chapters read alongside it", () => {
    const panel = html.slice(html.indexOf('id="clip-redis"'), html.indexOf('id="clip-sqlite"'));
    expect(panel).toContain("data-pairing-list");
    expect(panel).toContain("alongside RDB/AOF");     // the schedule's own reason
    expect(panel).toMatch(/Storage and Retrieval/i);  // a resolved chapter title, not an id
  });

  it("no longer carries the phase ribbon, the this-week band or the review deck", () => {
    // Deleted or moved to /roadmap/now (roadmap-now spec §4). A stray copy here
    // would put the band's hooks, or the review deck's ids, on two pages. Matched
    // as attributes on a tag, not as bare text, because /roadmap also loads
    // roadmap-schedule.ts (Task 6), whose selector strings name these hooks; a
    // build that inlined that script must not fail this test.
    expect(html).not.toMatch(/\sdata-roadmap-arc\b/);
    expect(html).not.toMatch(/\sdata-this-week\b/);
    expect(html).not.toMatch(/\sdata-now-phase="/);
    expect(html).not.toContain('id="rv-runner"');
  });

  it("builds /roadmap/now alongside it", () => {
    // Otherwise roadmap-now-contract.test.ts skips itself and passes silently.
    expect(existsSync("dist/roadmap/now/index.html")).toBe(true);
  });
});

// The essay page and the case study are server-rendered through the reader
// frame, and src/scripts/reader.ts finds its targets by data attribute: the
// body it measures, the line it moves, the sidebar it sticks. A markup change
// can break all three with a green unit suite and a clean build, so this reads
// one built page of each kind and asserts every hook is still there, and that
// the page ships in its no-script state. It needs dist/, so it is skipped
// without one; `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function firstPage(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const slug = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  return slug ? join(dir, slug, "index.html") : null;
}

const PAGES = { essay: firstPage("dist/blog"), "case study": firstPage("dist/building") };
const built = Object.values(PAGES).every((p) => p !== null && existsSync(p));

describe.skipIf(!built)("reader client contract (dist/blog/*, dist/building/*)", () => {
  for (const [kind, path] of Object.entries(PAGES)) {
    const html = built ? readFileSync(path!, "utf8") : "";

    it(`${kind}: keeps the line in the transport bar, hidden and out of the accessibility tree`, () => {
      expect(html).toMatch(/<div class="tb-progress" data-reader-progress hidden aria-hidden="true"/);
    });

    it(`${kind}: keeps the body the line measures and the sidebar the script sticks`, () => {
      expect(html).toMatch(/<div class="body" data-reader-body/);
      expect(html).toMatch(/<aside class="aside" data-reader-aside/);
    });

    // The inlined stylesheet names the attribute in its selector; the sidebar element must not carry it.
    it(`${kind}: ships without the sticky mark; only the script decides that the sidebar fits`, () => {
      expect(html).not.toMatch(/<aside[^>]*data-fits/);
    });
  }
});

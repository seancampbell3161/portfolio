// Screenshots every project that has a url into src/assets/projects/<slug>.jpg
// (thumbnails spec §4.1). Run as `npm run thumbs` and commit the results; rerun
// when a site changes its face. Mirrors scripts/og-screenshots.mjs.
import { chromium } from "playwright";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { projectShotTargets, thumbFile } from "../src/lib/thumbs.mjs";

const PROJECTS_DIR = "src/content/projects";
const WIDTH = 1280;
const HEIGHT = 800;

async function targets() {
  const names = (await readdir(PROJECTS_DIR)).filter((n) => n.endsWith(".mdx")).sort();
  const files = await Promise.all(
    names.map(async (name) => {
      const path = join(PROJECTS_DIR, name);
      return { path, source: await readFile(path, "utf8") };
    }),
  );
  return projectShotTargets(files);
}

async function run() {
  const shots = await targets();
  if (shots.length === 0) {
    console.log("No project has a url; nothing to shoot.");
    return;
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error("Failed to launch Chromium. Run `npx playwright install chromium` once, then retry.\n", err);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  let failures = 0;
  for (const { slug, url } of shots) {
    const out = thumbFile(slug);
    try {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      } catch (err) {
        // A map or a live feed can keep the network busy for good; the page is
        // still there, so shoot what loaded.
        if (!String(err).includes("Timeout")) throw err;
        console.log(`  ${url} never went idle; shooting as loaded`);
      }
      // Tiles, fonts and entrance animations.
      await page.waitForTimeout(2500);
      await mkdir(dirname(out), { recursive: true });
      await page.screenshot({ path: out, type: "jpeg", quality: 90 });
      await page.close();
      console.log(`✓ ${url} → ${out}`);
    } catch (err) {
      failures++;
      console.error(`✗ ${url} → ${out}\n`, err);
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n${failures} shot(s) failed.`);
    process.exit(1);
  }
  console.log(`\nDone — ${shots.length} shot(s) written to src/assets/projects/.`);
}

run();

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { OG_SHOTS, DEFAULT_BASE_URL, outputFile } from "../src/lib/og.mjs";

const BASE_URL = (process.env.OG_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const WIDTH = 1200;
const HEIGHT = 630;

async function run() {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(
      "Failed to launch Chromium. Run `npx playwright install chromium` once, then retry.\n",
      err,
    );
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  let failures = 0;
  for (const { route, name } of OG_SHOTS) {
    const url = `${BASE_URL}${route}`;
    const out = outputFile(name);
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      // Let client hydration (e.g. roadmap's /api/progress fetch) and any
      // entrance transitions settle before capture, so numbers aren't 0.
      await page.waitForTimeout(1500);
      await mkdir(dirname(out), { recursive: true });
      await page.screenshot({
        path: out,
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      });
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
  console.log(`\nDone — ${OG_SHOTS.length} shot(s) written to public/og/.`);
}

run();

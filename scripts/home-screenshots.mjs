// scripts/home-screenshots.mjs
// Full-page screenshots of the home page at desktop and phone widths for
// review. Run against `npm run preview` (default) or SHOT_BASE_URL.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = (process.env.SHOT_BASE_URL ?? "http://localhost:4321").replace(/\/$/, "");
const OUT_DIR = "screenshots";
const SHOTS = [
  { name: "home-1280", width: 1280, height: 900 },
  { name: "home-390", width: 390, height: 844 },
];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT_DIR}/${shot.name}.png`, fullPage: true });
      console.log(`✓ ${shot.name}`);
    } catch (err) {
      failures++;
      console.error(`✗ ${shot.name}\n`, err);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  if (failures) process.exit(1);
}

run();

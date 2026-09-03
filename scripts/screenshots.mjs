// scripts/screenshots.mjs
// Full-page screenshots of the home page, the writing index, and one essay at
// desktop and phone widths, for review. Run against `npm run preview`
// (default) or SHOT_BASE_URL. Output goes to screenshots/ (gitignored).
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = (process.env.SHOT_BASE_URL ?? "http://localhost:4321").replace(/\/$/, "");
const OUT_DIR = "screenshots";
const PAGES = [
  { name: "home", path: "/" },
  { name: "writing", path: "/blog" },
  { name: "essay", path: "/blog/i-wont-stop-coding" },
];
const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const page of PAGES) {
    for (const size of WIDTHS) {
      const name = `${page.name}-${size.name}`;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });
      try {
        const tab = await context.newPage();
        await tab.goto(`${BASE_URL}${page.path}`, { waitUntil: "networkidle", timeout: 30000 });
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(800);
        await tab.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
        console.log(`✓ ${name}`);
      } catch (err) {
        failures++;
        console.error(`✗ ${name}\n`, err);
      } finally {
        await context.close();
      }
    }
  }
  await browser.close();
  if (failures) process.exit(1);
}

run();

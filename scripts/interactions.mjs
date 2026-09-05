// End-to-end pass over scrub and pan against `npm run preview`.
// Run against `npm run preview` (or SHOT_BASE_URL), like scripts/screenshots.mjs.
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// Every page is watched: a throw inside a store listener would leave the page
// half-rendered, and most checks below would still pass.
const errors = [];
const watch = (p) => { p.on("pageerror", (e) => errors.push(String(e))); return p; };

// "Sep 14, 2024" (the cursor chip's format) as an ISO day, to compare with the hash.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function isoDay(chip) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec((chip ?? "").trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2])).toISOString().slice(0, 10);
}

// ---- desktop ----
const page = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const ticks = page.locator("[data-ticks]");
const strip = page.locator(".tl-ov");
const box = await ticks.boundingBox();

// hover shows the cursor and dims something
await page.mouse.move(box.x + box.width * 0.3, box.y + 10);
check("hover shows cursor", !(await page.locator("[data-cursor]").isHidden()));
check("hover marks the root as scrubbing", (await page.locator(".tl[data-scrubbing]").count()) === 1);
check("hover marks touching clips", (await page.locator(".tl-item[data-touch]").count()) > 0);

// press pins, hash follows, panel opens, focus stays put
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.5, box.y + 10, { steps: 5 });
await page.mouse.up();
check("pin sets #on- hash", (await page.evaluate(() => location.hash)).startsWith("#on-"));
check("date panel opens", await page.locator("#on-date[data-open]").count() === 1);
check("panel heading filled", ((await page.locator("[data-on-date-title]").textContent()) ?? "").length > 8);
check("pin tick shows", !(await page.locator("[data-ov-pin]").isHidden()));
check("focus did not move to the panel", await page.evaluate(() => document.activeElement?.id !== "on-date"));

// a long drag: the hash is coalesced, so rendering must keep up and the URL
// must still settle on the date under the pointer at release
await page.mouse.move(box.x + 20, box.y + 10);
await page.mouse.down();
const dragFrom = await page.locator("[data-cursor-label]").textContent();
let dragMid = null;
for (let i = 1; i <= 60; i++) {
  await page.mouse.move(box.x + 20 + (300 * i) / 60, box.y + 10);
  if (i === 30) dragMid = await page.locator("[data-cursor-label]").textContent();
}
const dragTo = await page.locator("[data-cursor-label]").textContent();
check("drag keeps the cursor visible", !(await page.locator("[data-cursor]").isHidden()));
check("drag keeps the cursor label moving", dragMid !== dragFrom && dragTo !== dragMid);
await page.mouse.up();
await page.waitForTimeout(400);
check("the hash settles on the date the drag ended on", (await page.evaluate(() => location.hash)) === `#on-${isoDay(dragTo)}`);

// opening an item unpins
await page.locator(".tl-item:not([data-out]) .tl-clip").first().click();
check("item hash replaces on hash", (await page.evaluate(() => location.hash)).startsWith("#item-"));
check("date panel closed by item", await page.locator("#on-date[data-open]").count() === 0);
await page.keyboard.press("Escape");

// keyboard scrub on the ruler
await ticks.focus();
check("ruler is a slider", (await ticks.getAttribute("role")) === "slider");
await page.keyboard.press("ArrowLeft");
check("ArrowLeft pins a month back", (await page.evaluate(() => location.hash)).startsWith("#on-"));
await page.keyboard.press("Shift+ArrowLeft");
check("Shift+ArrowLeft pans to last year", (await page.locator("[data-window-label]").textContent()) === String(new Date().getUTCFullYear() - 1));
await page.keyboard.press("Escape");
check("Escape clears the hash", (await page.evaluate(() => location.hash)) === "");
check("Escape returns focus to the ruler", await page.evaluate(() => document.activeElement?.hasAttribute("data-ticks")));

// strip keyboard and drag
await strip.focus();
check("strip is a slider", (await strip.getAttribute("role")) === "slider");
await page.keyboard.press("End");
await page.evaluate(() => window.scrollTo(0, 0));
await strip.scrollIntoViewIfNeeded();
const sb = await strip.boundingBox();
await page.mouse.move(sb.x + sb.width * 0.9, sb.y + sb.height / 2);
await page.mouse.down();
await page.mouse.move(sb.x + sb.width * 0.5, sb.y + sb.height / 2, { steps: 10 });
await page.mouse.up();
const thisYear = new Date().getUTCFullYear();
check("drag pans back", Number(await page.locator("[data-window-label]").textContent()) < thisYear);
check("year button names the year on screen", (await page.locator('[data-zoom-control] button[data-zoom="year"]').textContent()) === (await page.locator("[data-window-label]").textContent()));
await page.locator('[data-zoom-control] button[data-zoom="year"]').click();
check("year button returns to this year", (await page.locator("[data-window-label]").textContent()) === String(thisYear));

// tap jumps
await page.mouse.click(sb.x + sb.width * 0.15, sb.y + sb.height / 2);
check("tap jumps to an earlier year", Number(await page.locator("[data-window-label]").textContent()) < thisYear);

// deep links: each in a fresh page, because a hash-only goto is a same-document navigation
async function fresh(url) {
  const p = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
  await p.goto(url, { waitUntil: "networkidle" });
  return p;
}
const dl = await fresh(`${BASE}/#on-2024-06-15`);
check("date deep link pins", await dl.locator("#on-date[data-open]").count() === 1);
check("date deep link pans", (await dl.locator("[data-window-label]").textContent())?.includes("2024"));
check("date deep link leaves focus on body", await dl.evaluate(() => document.activeElement === document.body));
await dl.close();
const bad = await fresh(`${BASE}/#on-2024-02-31`);
check("malformed date hash ignored", await bad.locator("#on-date[data-open]").count() === 0);
await bad.close();
const empty = await fresh(`${BASE}/#on-2019-01-01`);
check("deep link before every item shows the empty line", ((await empty.locator("[data-on-date-list]").textContent()) ?? "").includes("Nothing on the timeline that day."));
check("deep link before every item hides the cursor", await empty.locator("[data-cursor]").isHidden());
await empty.close();

// ---- phone ----
const phone = watch(await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
await phone.goto(`${BASE}/`, { waitUntil: "networkidle" });
const firstWhen = await phone.locator(".tl-item:not([data-out]) .tl-when").first().textContent();
const pb = await phone.locator(".tl-ov").boundingBox();
await phone.mouse.move(pb.x + pb.width * 0.9, pb.y + pb.height / 2);
await phone.mouse.down();
await phone.mouse.move(pb.x + pb.width * 0.4, pb.y + pb.height / 2, { steps: 10 });
await phone.mouse.up();
const afterWhen = await phone.locator(".tl-item:not([data-out]) .tl-when").first().textContent();
check("phone drag changes the graph's rows", firstWhen !== afterWhen);
check("phone has no cursor", await phone.locator("[data-cursor]").isHidden());

// ---- nothing threw anywhere ----
check(`no uncaught page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`, errors.length === 0);

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nall checks passed");

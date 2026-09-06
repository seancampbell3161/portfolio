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

// ---- the hero readout (interactions 2) ----
const hero = await fresh(`${BASE}/`);
const firstLink = hero.locator("[data-right-now] a[data-item-link]").first();
const linkedId = await firstLink.getAttribute("data-item-link");
await firstLink.click();
check("a readout link opens its item in the inspector", (await hero.evaluate(() => location.hash)) === `#item-${linkedId}`);
check("a readout link does not leave the page", (await hero.evaluate(() => location.pathname)) === "/");
// The build stamps now; the client prunes whatever no longer touches the real
// day. A fixed clock past the build day makes that visible.
const buildDay = new Date(await hero.getAttribute("[data-timeline]", "data-now"));
await hero.close();
const DAY = 86400000;
const LANES = ["writing", "building", "learning", "community"];
async function readoutAt(msAfterBuild) {
  const p = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
  await p.clock.setFixedTime(new Date(buildDay.getTime() + msAfterBuild));
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const state = await p.evaluate(() => {
    const now = Date.now();
    // Spans touching the (fake) day, by the timeline's rule. A moment is never
    // within 14 days of a day this far past the build, so every moment must be gone.
    const running = [...document.querySelectorAll(".tl-item[data-kind=span]")]
      .filter((el) => {
        const start = Date.parse(el.dataset.start);
        const end = el.dataset.end ? Date.parse(el.dataset.end) : now;
        return start <= now && end >= now;
      })
      .map((el) => ({ id: el.dataset.id, lane: el.dataset.lane }));
    const rows = [...document.querySelectorAll("[data-right-now] [data-now-row]")].map((r) => ({
      lane: r.dataset.nowRow,
      ids: [...r.querySelectorAll("dd[data-id]")].map((dd) => dd.dataset.id),
      kinds: [...r.querySelectorAll("dd[data-id]")].map((dd) => document.querySelector(`.tl-item[data-id="${dd.dataset.id}"]`)?.dataset.kind),
      shown: [...r.querySelectorAll("[data-now-when]")].filter((s) => !s.hidden).length,
    }));
    return { running, rows };
  });
  await p.close();
  return state;
}
const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));
for (const [label, ms] of [["sixty days on", 60 * DAY], ["three years on", 3 * 365 * DAY]]) {
  const r = await readoutAt(ms);
  const listed = r.rows.flatMap((row) => row.ids);
  check(`${label}, every moment has left the readout`, r.rows.flatMap((row) => row.kinds).every((k) => k === "span"));
  check(`${label}, the readout lists exactly the spans still running`, sameIds(listed, r.running.map((x) => x.id)));
  check(`${label}, rows are the lanes with something running, in lane order`, r.rows.map((row) => row.lane).join() === LANES.filter((l) => r.running.some((x) => x.lane === l)).join());
  check(`${label}, a phrase shows exactly when its entry is alone in its row`, r.rows.every((row) => row.shown === (row.ids.length === 1 ? 1 : 0)));
}

// ---- project thumbnails (interactions 3) ----
// The all-time zoom shows every project at its narrowest, so the 200px rule is
// exercised both ways when clips straddle it.
const thumbs = await fresh(`${BASE}/`);
await thumbs.locator('[data-zoom-control] button[data-zoom="all"]').click();
const clipState = await thumbs.$$eval('.tl-item[data-lane="building"][data-kind="span"]:not([data-out])', (els) =>
  els.map((el) => {
    const img = el.querySelector(".tl-thumb");
    return {
      id: el.dataset.id,
      width: el.getBoundingClientRect().width,
      hasImg: !!img,
      shown: !!img && getComputedStyle(img).display !== "none",
    };
  }),
);
check("a thumbnail shows exactly when its clip is at least 200px wide", clipState.filter((c) => c.hasImg).every((c) => c.shown === (c.width >= 200)));
check("at least one building clip shows its thumbnail", clipState.some((c) => c.shown));
const laneHeights = await thumbs.$$eval(".tl-head", (els) => els.map((el) => el.getBoundingClientRect().height));
const buildingRows = Number(await thumbs.$eval(".tl", (el) => getComputedStyle(el).getPropertyValue("--rows-building")));
check("the building lane is 12 + rows x 70 tall", Math.abs(laneHeights[1] - (12 + buildingRows * 70)) < 1);
check("the other lanes keep 120px", [0, 2, 3].every((i) => Math.abs(laneHeights[i] - 120) < 1));
check("every lane's clips sit inside their lane", await thumbs.evaluate((lanes) => {
  return lanes.every((lane, i) => {
    const head = document.querySelectorAll(".tl-head")[i].getBoundingClientRect();
    const els = document.querySelectorAll(`.tl-item[data-lane="${lane}"]:not([data-out])`);
    return [...els].every((el) => { const r = el.getBoundingClientRect(); return r.top >= head.top && r.bottom <= head.bottom + 1; });
  });
}, LANES));
await thumbs.close();

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
check("a phone building row shows its picture", (await phone.locator('.tl-item[data-lane="building"]:not([data-out]) .tl-thumb:visible').count()) > 0);

// ---- the reader frame (interactions 4) ----
// Data-dependent: the first essay on the index must run past one screen, and
// the DAW engine case study must fit on one; both hold by a wide margin.
const settle = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// The site scrolls smoothly (global.css); the checks need to land, not glide.
const scrollTo = async (p, y) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await settle(p); };
const progressOf = (p) => p.$eval("[data-reader-progress]", (el) => ({ hidden: el.hidden, p: Number(getComputedStyle(el).getPropertyValue("--p") || 0) }));
const asideOf = (p) => p.$eval("[data-reader-aside]", (el) => ({ fits: el.hasAttribute("data-fits"), top: Math.round(el.getBoundingClientRect().top), position: getComputedStyle(el).position, stick: parseFloat(getComputedStyle(el).getPropertyValue("--stick")) }));
const index = await fresh(`${BASE}/blog`);
const essayHref = await index.locator('a[href^="/blog/"]').first().getAttribute("href");
await index.close();

const essay = await fresh(`${BASE}${essayHref}`);
await settle(essay);
let pr = await progressOf(essay);
check("an essay shows the reading line, empty, at the top", !pr.hidden && pr.p === 0);
await scrollTo(essay, 100000);
pr = await progressOf(essay);
check("the line is full at the end of the essay", !pr.hidden && pr.p === 1);
// Halfway through the reading range itself (from the body's top passing under
// the bar to its bottom entering the viewport), so the check does not depend
// on how much of the page is body.
const midway = await essay.evaluate(() => {
  const r = document.querySelector("[data-reader-body]").getBoundingClientRect();
  const bar = document.querySelector("[data-reader-progress]").parentElement.getBoundingClientRect().bottom;
  const start = Math.max(0, r.top + scrollY - bar);
  const end = r.bottom + scrollY - innerHeight;
  return (start + end) / 2;
});
await scrollTo(essay, midway);
pr = await progressOf(essay);
check("the line is half full halfway through the reading range", Math.abs(pr.p - 0.5) < 0.01);
await scrollTo(essay, 0);
check("the line empties again at the top", (await progressOf(essay)).p === 0);
await scrollTo(essay, 400);
const stuckA = await asideOf(essay);
await scrollTo(essay, 900);
const stuckB = await asideOf(essay);
check("the essay's sidebar fits and sticks", stuckA.fits && stuckA.position === "sticky" && stuckA.top === stuckB.top);
check("the sidebar sticks at --stick", stuckA.stick > 0 && stuckA.top === stuckA.stick);
await essay.setViewportSize({ width: 1280, height: 480 });
await settle(essay);
check("a viewport too short for the sidebar releases it", !(await asideOf(essay)).fits);
await essay.setViewportSize({ width: 1280, height: 900 });
await settle(essay);
check("a tall enough viewport sticks it again", (await asideOf(essay)).fits);
// A resize that lands in the same frame as a scroll must still re-fit the
// sidebar. Raising --stick changes what fits without changing any size, so
// nothing but the resize handler can notice it.
await essay.evaluate(() => {
  document.querySelector("[data-reader-aside]").style.setProperty("--stick", "600px");
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new Event("resize"));
});
await settle(essay);
check("a resize in a scroll's frame still re-fits the sidebar", !(await asideOf(essay)).fits);
await essay.close();

const short = await fresh(`${BASE}/building/daw-engine`);
await settle(short);
check("a case study that fits one screen shows no line", (await progressOf(short)).hidden);
await short.close();

const phoneEssay = watch(await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
await phoneEssay.goto(`${BASE}${essayHref}`, { waitUntil: "networkidle" });
await scrollTo(phoneEssay, 100000);
pr = await progressOf(phoneEssay);
check("a phone shows the line and fills it at the end", !pr.hidden && pr.p === 1);
check("a phone's sidebar never sticks", (await asideOf(phoneEssay)).position === "static");
await phoneEssay.close();

// ---- the I/O multiplexing figure (interactions 5) ----
// The figure lives in one essay; a wrong path here fails loudly (no figure),
// unlike the contract test, which finds the page by hook.
const FIGURE = `${BASE}/blog/io-multiplexing`;
const phaseIs = (p, phase) => p.waitForSelector(`[data-io-figure][data-phase="${phase}"]`, { timeout: 8000 });
const cellsOf = (p) => p.evaluate(() => {
  const cells = [...document.querySelectorAll("[data-io-cell]")];
  const grid = document.querySelector("[data-io-grid]");
  return {
    total: cells.length,
    seen: cells.filter((c) => c.hasAttribute("data-seen")).length,
    scan: cells.filter((c) => c.hasAttribute("data-scan")).length,
    found: cells.filter((c) => c.dataset.state === "found").map((c) => Number(c.dataset.fd)),
    cols: getComputedStyle(grid).getPropertyValue("--cols").trim(),
    numbered: grid.hasAttribute("data-numbered"),
  };
});
const readoutOf = (p) => p.locator("[data-io-readout]").textContent();
const tallyOf = (p, m) => p.locator(`[data-io-tally="${m}"]`).textContent();
const stepDisabled = (p) => p.locator("[data-io-step]").getAttribute("aria-disabled");
// A snapshot of the cells, the readout and the ready title in one evaluate
// call, so the three reads cannot straddle the 700ms return window.
const frameOf = (p) => p.evaluate(() => {
  const cells = [...document.querySelectorAll("[data-io-cell]")];
  const grid = document.querySelector("[data-io-grid]");
  return {
    cells: {
      total: cells.length,
      seen: cells.filter((c) => c.hasAttribute("data-seen")).length,
      scan: cells.filter((c) => c.hasAttribute("data-scan")).length,
      found: cells.filter((c) => c.dataset.state === "found").map((c) => Number(c.dataset.fd)),
      cols: getComputedStyle(grid).getPropertyValue("--cols").trim(),
      numbered: grid.hasAttribute("data-numbered"),
    },
    readout: document.querySelector("[data-io-readout]")?.textContent ?? null,
    readyTitle: document.querySelector("[data-io-ready-title]")?.textContent ?? null,
  };
});

const fig = await fresh(FIGURE);
check("the figure is live and its toolbar visible", (await fig.locator("[data-io-figure][data-live]").count()) === 1 && (await fig.locator("[data-io-controls]").isVisible()));
const still = await cellsOf(fig);
check("the still frame is epoll at 32 with three found", still.total === 32 && still.found.length === 3 && (await fig.locator('[data-io-figure][data-mechanism="epoll"]').count()) === 1);

// switching off the still frame's mechanism paints idle at once, clearing it
await fig.click('[data-io-mechanism="select"]');
check(
  "switching the mechanism from the still frame paints idle",
  (await fig.locator('[data-io-figure][data-phase="idle"]').count()) === 1 &&
    (await cellsOf(fig)).found.length === 0 &&
    (await fig.locator("[data-io-ready-title]").textContent()) === "ready: nothing yet" &&
    (await fig.locator("[data-io-call-name]").textContent()) === "select()",
);

// select at 32: the sweep leaves every cell seen, the readout names the cost, the wake ends clean
await fig.click("[data-io-step]");
await phaseIs(fig, "sweep");
check("the step button is disabled during a wake", (await stepDisabled(fig)) === "true");
await phaseIs(fig, "return");
const selFrame = await frameOf(fig);
check("select's return frame has every cell seen and no scan ring", selFrame.cells.seen === 32 && selFrame.cells.scan === 0 && selFrame.cells.found.length > 0);
check("select's readout names 32 checked and the found count", selFrame.readout.includes("Wake 1: select checked 32 descriptors") && selFrame.readout.includes(`find ${selFrame.cells.found.length} ready`));
check("the ready box lists the found sockets", (selFrame.readyTitle ?? "").startsWith(`ready: fd ${selFrame.cells.found[0]}`));
await phaseIs(fig, "idle");
const selIdle = await cellsOf(fig);
check("the wake ends with a clean grid and the button enabled", selIdle.seen === 0 && selIdle.found.length === 0 && selIdle.scan === 0 && (await stepDisabled(fig)) === null);
check("the select tally fills in; the others stay a dash", (await tallyOf(fig, "select")) === `1 wake · 32 checked · ${selFrame.cells.found.length} ready` && (await tallyOf(fig, "poll")) === "—" && (await tallyOf(fig, "epoll")) === "—");

// epoll: no sweep, the same arrivals as select's first wake
await fig.click('[data-io-mechanism="epoll"]');
check("switching the mechanism renames the call at once", (await fig.locator("[data-io-call-name]").textContent()) === "epoll_wait()");
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
const epFrame = await frameOf(fig);
check("epoll's return frame has no seen cells", epFrame.cells.seen === 0 && epFrame.cells.scan === 0);
check("epoll's first wake sees the same sockets as select's", JSON.stringify(epFrame.cells.found) === JSON.stringify(selFrame.cells.found));
check("epoll's readout says returned without checking", (epFrame.readout ?? "").startsWith("Wake 1: epoll_wait returned the"));
await phaseIs(fig, "idle");
check("the epoll tally counts only what was returned", (await tallyOf(fig, "epoll")) === `1 wake · ${epFrame.cells.found.length} checked · ${epFrame.cells.found.length} ready`);

// a count change rebuilds the grid and resets the tallies
await fig.click('[data-io-count="128"]');
const big = await cellsOf(fig);
check("128 rebuilds the grid in 16 unnumbered columns", big.total === 128 && big.cols === "16" && !big.numbered && big.found.length === 0);
check("a count change resets every tally", (await tallyOf(fig, "select")) === "—" && (await tallyOf(fig, "epoll")) === "—");
check("a count change writes the reset sentence", (await readoutOf(fig)) === "No wakes yet at 128 sockets. Press Next wake.");

// a count change mid-wake cancels it outright, not just when idle
await fig.click('[data-io-mechanism="select"]');
await fig.click("[data-io-step]");
await phaseIs(fig, "sweep");
await fig.click('[data-io-count="8"]');
const midCancel = await cellsOf(fig);
check(
  "a count change mid-wake cancels it",
  (await fig.locator('[data-io-figure][data-phase="idle"]').count()) === 1 &&
    midCancel.total === 8 &&
    midCancel.seen === 0 &&
    midCancel.scan === 0 &&
    midCancel.found.length === 0 &&
    (await stepDisabled(fig)) === null &&
    (await fig.locator("[data-io-play]").getAttribute("aria-pressed")) === "false",
);
const small = await cellsOf(fig);
check("8 is one numbered row", small.total === 8 && small.cols === "8" && small.numbered);

// back to epoll so the Play section below reads the tally it expects
await fig.click('[data-io-mechanism="epoll"]');

// play runs wakes back to back and stops when pressed again
await fig.click("[data-io-play]");
check("play reads pressed", (await fig.locator("[data-io-play]").getAttribute("aria-pressed")) === "true");
await phaseIs(fig, "return");
await phaseIs(fig, "idle");
await phaseIs(fig, "return");
await phaseIs(fig, "idle");
await fig.click("[data-io-play]");
check("play stops when pressed again", (await fig.locator("[data-io-play]").getAttribute("aria-pressed")) === "false");
const wakesAtStop = Number(((await tallyOf(fig, "epoll")) ?? "").match(/^(\d+) wake/)?.[1] ?? 0);
await fig.waitForTimeout(2600);
const wakesLater = Number(((await tallyOf(fig, "epoll")) ?? "").match(/^(\d+) wake/)?.[1] ?? 0);
check("no new wake starts after play stops", wakesAtStop >= 2 && wakesLater <= wakesAtStop + 1);
await phaseIs(fig, "idle");

// reduced motion: no sweep, the return frame with the trail, held
await fig.emulateMedia({ reducedMotion: "reduce" });
await fig.click('[data-io-mechanism="select"]');
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
const rm = await cellsOf(fig);
check("reduced motion jumps to the return frame with the whole trail", rm.seen === 8 && rm.scan === 0 && rm.found.length > 0);
await fig.waitForTimeout(2300);
check("reduced motion holds the return frame and frees the button", (await fig.locator('[data-io-figure][data-phase="return"]').count()) === 1 && (await stepDisabled(fig)) === null);
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
check("the next reduced-motion wake replaces the frame", ((await readoutOf(fig)) ?? "").startsWith("Wake 2: select"));
await fig.close();

// a phone keeps the columns and runs a wake
const phoneFig = watch(await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
await phoneFig.goto(FIGURE, { waitUntil: "networkidle" });
await phoneFig.click('[data-io-count="128"]');
const pf = await phoneFig.evaluate(() => {
  const g = document.querySelector("[data-io-grid]");
  return { cols: getComputedStyle(g).getPropertyValue("--cols").trim(), width: g.getBoundingClientRect().width, page: document.documentElement.scrollWidth, vw: innerWidth };
});
check("a phone keeps 16 columns at 128 and nothing overflows", pf.cols === "16" && pf.width <= pf.vw && pf.page <= pf.vw);
await phoneFig.click("[data-io-step]");
await phaseIs(phoneFig, "return");
check("a phone runs a wake", (await cellsOf(phoneFig)).found.length > 0);
await phoneFig.close();

// ---- nothing threw anywhere ----
check(`no uncaught page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`, errors.length === 0);

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nall checks passed");

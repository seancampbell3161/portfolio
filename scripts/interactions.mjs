// End-to-end pass over scrub and pan against `npm run preview`.
// Run against `npm run preview` (or SHOT_BASE_URL), like scripts/screenshots.mjs.
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// Every page is watched: a throw inside a store listener would leave the page
// half-rendered, and most checks below would still pass. Console errors are
// watched too, not just uncaught exceptions: a duplicate view-transition-name
// (C-1) never throws -- the browser logs it and silently skips the whole
// transition -- so a suite that only listened for pageerror could ship that
// bug with a fully green "no uncaught page errors" check.
const errors = [];
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return p;
};

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
const titleBeforeItemClick = await page.title();
await page.locator(".tl-item:not([data-out]) .tl-clip").first().click();
check("item hash replaces on hash", (await page.evaluate(() => location.hash)).startsWith("#item-"));
check("date panel closed by item", await page.locator("#on-date[data-open]").count() === 0);
// The clip's own href is a real page (spec: the page works without JS). The
// hash above proves the in-place open ran; it does not prove the router's
// own click listener didn't ALSO win and start navigating there anyway --
// that soft navigation used to land about a second later, after every
// immediate assertion had already passed. Settle past that window.
await page.waitForTimeout(1500);
check("clip click still hasn't navigated away", (await page.evaluate(() => location.pathname)) === "/");
check("clip click still hasn't changed the title", (await page.title()) === titleBeforeItemClick);
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
const heroTitleBeforeClick = await hero.title();
const firstLink = hero.locator("[data-right-now] a[data-item-link]").first();
const linkedId = await firstLink.getAttribute("data-item-link");
await firstLink.click();
check("a readout link opens its item in the inspector", (await hero.evaluate(() => location.hash)) === `#item-${linkedId}`);
check("a readout link does not leave the page", (await hero.evaluate(() => location.pathname)) === "/");
// Same race as the clip click above: the router's own soft navigation to
// the item's real page used to complete about a second after these
// immediate checks, so settle past that window before trusting it stuck.
await hero.waitForTimeout(1500);
check("a readout link still hasn't navigated away", (await hero.evaluate(() => location.pathname)) === "/");
check("a readout link still hasn't changed the title", (await hero.title()) === heroTitleBeforeClick);
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

// ---- view transitions (interactions 6) ----

// Check 1: a script that first executes DURING a swap -- not a cold load --
// still upgrades its page. The essay ships no timeline script at all, so
// clicking Home fetches and runs the home bundle for the first time as part
// of THIS navigation. The overview strip only becomes a role="slider" once
// src/scripts/timeline/index.ts runs; the built HTML ships it aria-hidden.
// This guards the ordering the whole lifecycle contract depends on: Astro
// runs a newly-arrived page's scripts before it dispatches astro:page-load,
// so a listener registered during that very execution still catches it.
const vt1 = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await vt1.goto(`${BASE}${essayHref}`, { waitUntil: "networkidle" });
await vt1.locator(".tb-name").click();
await vt1.waitForURL(`${BASE}/`);
await vt1.waitForSelector('.tl-ov[role="slider"]', { timeout: 4000 }).catch(() => {});
check(
  "a script arriving mid-session still upgrades its page (the overview strip becomes a slider)",
  (await vt1.locator(".tl-ov").getAttribute("role")) === "slider",
);
// I-3: this route -- a cold-loaded essay, then a plain click to Home -- carries
// no #item-/#on- deep link, so initMotion's `skip: deepLinked || !first` can
// only be satisfied here by `!first`, i.e. by the `cold` flag correctly
// flipping false across this swap. Check 6 below also asserts on
// [data-playhead], but only after a deep-linked back navigation, where
// `deepLinked` alone already satisfies `skip` -- that assertion cannot fail if
// `first`/`cold` regresses. This one can.
check(
  "a plain navigation from a reader page to Home is not a cold load (the playhead does not replay its draw-in)",
  !((await vt1.locator("[data-playhead]").getAttribute("style")) ?? "").includes("transition"),
);
await vt1.close();

// Check 2: the morph arms the element that was clicked. A building panel with
// a picture is found by attribute, not by slug, so the check does not depend
// on which project happens to carry a screenshot.
// A short viewport, so whichever case study is picked is reliably taller than
// it -- every case study is short enough to fit a normal 900px-tall viewport.
const vt2 = watch(await browser.newPage({ viewport: { width: 1280, height: 600 } }));
await vt2.goto(`${BASE}/`, { waitUntil: "networkidle" });
// "All" zoom, so the picked clip is on screen regardless of which year it falls in.
await vt2.locator('[data-zoom-control] button[data-zoom="all"]').click();
const morphId = await vt2.evaluate(() => {
  const visible = new Set([...document.querySelectorAll(".tl-item:not([data-out])")].map((el) => el.dataset.id));
  const ids = [...document.querySelectorAll(".insp[data-morph] [data-morph-shot]")].map((img) => img.closest(".insp").id.replace(/^item-/, ""));
  return ids.find((id) => visible.has(id)) ?? null;
});
check("home ships at least one visible building panel with a picture to morph", morphId !== null);
await vt2.locator(`.tl-item[data-id="${morphId}"] .tl-clip`).click();
await vt2.waitForSelector(`#item-${morphId}[data-open]`);
await vt2.evaluate((id) => {
  window.__morphName = null;
  document.addEventListener(
    "astro:before-preparation",
    () => {
      const img = document.querySelector(`#item-${id} [data-morph-shot]`);
      window.__morphName = img ? getComputedStyle(img).viewTransitionName : null;
    },
    { once: true },
  );
}, morphId);
await vt2.locator(`#item-${morphId} .insp-links a`, { hasText: "Read the case study" }).click();
await vt2.waitForURL(/\/building\//);
check("the morph arms the clicked panel's picture with the shot name", (await vt2.evaluate(() => window.__morphName)) === "shot");
check("the case study rendered", (await vt2.evaluate(() => location.pathname)).startsWith("/building/"));
await vt2.waitForFunction(() => document.querySelector("[data-reader-body]"));
const vt2Tall = await vt2.evaluate(() => document.querySelector("[data-reader-body]").getBoundingClientRect().height > window.innerHeight);
check("the case study picked for the morph has a body taller than the viewport", vt2Tall);
const vt2Prog = await vt2.$eval("[data-reader-progress]", (el) => ({ hidden: el.hidden }));
check("the case study's reading line initialised", !vt2Prog.hidden);
await vt2.close();

// Check 3: a pending save survives a navigation -- and specifically because
// it was FLUSHED, not merely because the ordinary 500ms debounce happened to
// fire anyway. Deleting the flush handler wouldn't stop the timer; it would
// still fire on its own and still POST, so "a POST arrived" alone cannot tell
// the two apart. What distinguishes them is timing: a real flush fires from
// astro:before-swap, at the moment of the nav click, so it always lands well
// under 500ms after the toggle; the ordinary timer, by definition of
// setTimeout, can never fire in LESS than its own delay. So this asserts the
// POST landed before toggle + 500ms, not merely that one landed at all. This
// preview server has no Netlify Functions, so /api/progress 404s locally --
// the POST is intercepted, which is enough to prove it fired.
const vt3 = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await vt3.addInitScript(() => sessionStorage.setItem("roadmap-admin-token", "e2e-dummy-token"));
let vt3PostAt = null;
await vt3.route("**/api/progress", async (route) => {
  if (route.request().method() === "POST") vt3PostAt = Date.now();
  await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
// review.ts's own initReview() also runs on /roadmap and, once a token is
// present, fetches /api/review -- unmocked, that 404s against this
// functions-less preview server too, and a fetch() 404 is a genuine console
// error (Chromium logs "Failed to load resource" for it), which the
// strengthened watch() below now catches. Routing it is completing the mock
// to match what a deployed Netlify Function would actually return, not
// silencing a real failure.
await vt3.route("**/api/review", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) });
});
await vt3.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
check("roadmap: a stored admin token turns editing on", (await vt3.locator(".roadmap-page.rm-editing").count()) === 1);
// The checkboxes live in the roadmap's own :target-gated panels (spec §6),
// same as the home Inspector; a clip's plain hash link opens one with no JS.
const vt3ClipId = await vt3.evaluate(() => document.querySelector(".rm-clip[data-clip-id]")?.dataset.clipId ?? null);
await vt3.locator(`.rm-clip[data-clip-id="${vt3ClipId}"]`).click();
await vt3.waitForSelector(`#clip-${vt3ClipId}:target`);
// The site scrolls smoothly (global.css); the hash navigation above starts an
// animated scroll to the panel that can still be settling when the checkbox
// click below waits for its target to stop moving, adding the scroll's whole
// duration to that wait. Jump instantly instead, same ruling as elsewhere in
// this file (scroll with behavior: "instant").
await vt3.evaluate((id) => document.getElementById(`clip-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" }), vt3ClipId);
// Recorded BEFORE the click, not after: the debounce timer starts at the real
// browser-side "change" event, which this timestamp can only ever precede, so
// toggleAt + 500 stays a true lower bound on the ordinary timer's fire time
// regardless of this process's own IPC latency.
const vt3ToggleAt = Date.now();
await vt3.locator(`#clip-${vt3ClipId} input[data-id]`).first().click();
await vt3.waitForTimeout(200); // a nav link clicked well inside the 500ms debounce
await vt3.locator(".tb-link", { hasText: "Writing" }).click();
await vt3.waitForURL(/\/blog\/?$/);
await vt3.waitForTimeout(500);
check(
  "a pending save survives a navigation (the POST landed before the ordinary debounce could have fired it)",
  vt3PostAt !== null && vt3PostAt < vt3ToggleAt + 500,
);
await vt3.close();

// Check 4: listeners do not stack. Leaving and returning to /roadmap must not
// leave a stale run's listeners registered alongside the fresh run's --
// otherwise a single toggle would schedule more than one save.
const vt4 = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
let vt4Posts = 0;
await vt4.route("**/api/progress", async (route) => {
  if (route.request().method() === "POST") vt4Posts++;
  await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
// See vt3 above: the #rm-edit click below hands review.ts a token too, and its
// own loadReview() fetches /api/review.
await vt4.route("**/api/review", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) });
});
await vt4.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
await vt4.locator(".tb-link", { hasText: "Writing" }).click();
await vt4.waitForURL(/\/blog\/?$/);
await vt4.goBack();
await vt4.waitForURL(/\/roadmap\/?$/);
vt4.once("dialog", (d) => d.accept("e2e-dummy-token"));
await vt4.locator("#rm-edit").click();
await vt4.waitForSelector(".roadmap-page.rm-editing");
const vt4ClipId = await vt4.evaluate(() => document.querySelector(".rm-clip[data-clip-id]")?.dataset.clipId ?? null);
await vt4.locator(`.rm-clip[data-clip-id="${vt4ClipId}"]`).click();
await vt4.waitForSelector(`#clip-${vt4ClipId}:target`);
// See check 3: jump instantly rather than waiting out the smooth scroll.
await vt4.evaluate((id) => document.getElementById(`clip-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" }), vt4ClipId);
await vt4.locator(`#clip-${vt4ClipId} input[data-id]`).first().click();
await vt4.waitForTimeout(700); // past the 500ms debounce
check("listeners do not stack: one toggle after a navigate-away-and-back saves exactly once", vt4Posts === 1);
await vt4.close();

// Check 5: reduced motion completes the swap immediately -- nothing makes the
// visitor wait out a cross-fade they asked not to see. data-astro-transition
// stays on <html> for exactly as long as the transition's animations run
// (astro/dist/transitions/router.js), so its removal is "the swap is over."
const vt5 = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await vt5.emulateMedia({ reducedMotion: "reduce" });
await vt5.goto(`${BASE}/`, { waitUntil: "networkidle" });
await vt5.locator('[data-zoom-control] button[data-zoom="all"]').click();
const vt5Id = await vt5.evaluate(() => document.querySelector('.tl-item[data-lane="writing"]:not([data-out])')?.dataset.id ?? null);
await vt5.locator(`.tl-item[data-id="${vt5Id}"] .tl-clip`).click();
await vt5.waitForSelector(`#item-${vt5Id}[data-open]`);
await vt5.evaluate(() => {
  window.__navStart = null;
  document.addEventListener(
    "click",
    () => { window.__navStart = performance.now(); },
    { capture: true, once: true },
  );
});
await vt5.locator(`#item-${vt5Id} .insp-links a`, { hasText: "Read the essay" }).click();
const vt5Elapsed = await vt5.evaluate(
  () =>
    new Promise((resolve) => {
      function poll() {
        if (
          location.pathname.startsWith("/blog/") &&
          document.querySelector("h1") &&
          !document.documentElement.hasAttribute("data-astro-transition")
        ) {
          // null, not a fallback to performance.now() (which would read as
          // "0ms elapsed" and pass): a missing __navStart means the click
          // listener never recorded a start, which must fail the check below,
          // not silently satisfy it.
          resolve(window.__navStart == null ? null : performance.now() - window.__navStart);
          return;
        }
        requestAnimationFrame(poll);
      }
      requestAnimationFrame(poll);
    }),
);
check("reduced motion completes the swap within 100ms of the click", vt5Elapsed !== null && vt5Elapsed < 100);
await vt5.close();

// Check 6: back restores the open panel, and does not replay the playhead
// draw-in. Its URL carries #item-<id> (a deep link), which openDeepLink()
// reads to reopen the panel and to skip the intro on its own -- proving that
// path still runs is exactly what is at stake here.
const vt6 = await fresh(`${BASE}/`);
await vt6.locator('[data-zoom-control] button[data-zoom="all"]').click();
const vt6Id = await vt6.evaluate(() => document.querySelector('.tl-item[data-lane="building"]:not([data-out])')?.dataset.id ?? null);
await vt6.locator(`.tl-item[data-id="${vt6Id}"] .tl-clip`).click();
await vt6.waitForSelector(`#item-${vt6Id}[data-open]`);
await vt6.locator(`#item-${vt6Id} .insp-links a`, { hasText: "Read the case study" }).click();
await vt6.waitForURL(/\/building\//);
await vt6.goBack();
// The panel opened via history.replaceState (spec §8.2), so this history entry's
// URL is "/#item-<id>", not the bare path -- match on pathname, not the whole URL.
await vt6.waitForURL((url) => url.pathname === "/");
await vt6.waitForSelector(`#item-${vt6Id}[data-open]`, { timeout: 4000 }).catch(() => {});
check("back restores the URL to the item hash", (await vt6.evaluate(() => location.hash)) === `#item-${vt6Id}`);
check("back restores the open panel", (await vt6.locator(`#item-${vt6Id}[data-open]`).count()) === 1);
// Named for what this route actually exercises: the #item-<id> deep link alone
// satisfies initMotion's skip, so this cannot catch a regression in `first`/
// `cold` on its own -- the check after check 1, above, covers that half.
check(
  "back through a deep link does not replay the playhead draw-in",
  !((await vt6.locator("[data-playhead]").getAttribute("style")) ?? "").includes("transition"),
);
await vt6.close();

// Check 7 (I-1b): a navigation FROM a reader page's own sidebar. None of the
// six checks above ever click a link while a reader page is the OUTGOING
// document, which is exactly the shape C-1 needed: an essay's <h1> already
// holds "ptitle" (view-transitions.css's [data-morph-dest]) at the same time
// as a "Nearby essays" row wants it. Before the fix, the outgoing document
// held that name twice and the browser skipped the whole transition -- and
// silently: the destination still renders (the router's DOM swap doesn't
// depend on the transition's own choreography), so "did navigation succeed"
// cannot tell the two cases apart. Only the transition's own `ready` promise
// can: it rejects when the browser skips for a duplicate name, and Astro's
// router never looks at `ready` itself (it awaits `updateCallbackDone`), so
// nothing else on the page would surface that rejection. `document.
// startViewTransition` is wrapped here, before the click, to capture it.
const vt7 = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await vt7.goto(`${BASE}${essayHref}`, { waitUntil: "networkidle" });
await vt7.evaluate(() => {
  window.__vtReady = null;
  const orig = document.startViewTransition?.bind(document);
  if (!orig) return; // no View Transitions API here; nothing for this check to prove
  document.startViewTransition = (cb) => {
    const vt = orig(cb);
    vt.ready.then(
      () => { window.__vtReady = "resolved"; },
      (err) => { window.__vtReady = `rejected:${err?.name ?? err}`; },
    );
    return vt;
  };
});
const vt7ErrorsBefore = errors.length;
const nearby = vt7.locator('[aria-label="Nearby essays"] a').first();
await nearby.waitFor();
const vt7Href = await nearby.getAttribute("href");
await nearby.click();
await vt7.waitForURL((url) => url.pathname === new URL(vt7Href, BASE).pathname);
await vt7.waitForFunction(() => window.__vtReady !== null, { timeout: 4000 }).catch(() => {});
check(
  "a sidebar link out of a reader page runs the real transition (its ready promise resolves, not rejects)",
  (await vt7.evaluate(() => window.__vtReady)) === "resolved",
);
check(
  "no duplicate view-transition-name error was logged for that navigation",
  !errors.slice(vt7ErrorsBefore).some((e) => /duplicate view-transition-name/i.test(e)),
);
await vt7.close();

// ---- roadmap: the this-week band recomputes on a stale visit ----
// src/scripts/roadmap-schedule.ts is this branch's headline guarantee: a build
// made in one week and visited weeks later must still recompute the label AND
// reveal the matching phase panel, so the heading can never sit above another
// phase's reading list. Unlike the home timeline (data-timeline/data-now),
// nothing stamps the roadmap's build day on the page, so this reads the real
// "now" state first (a normal load) rather than hardcoding a date that would
// eventually roll past the plan's end. RoadmapArc.astro renders every phase's
// absolute week range as plain dates, independent of the clock, which is what
// lets this pick a target phase and its expected label without importing the
// TS phase table into this plain Node script.
// roadmap.ts and review.ts each unconditionally GET /api/progress on load,
// same as vt3/vt4 above; this preview server has no Netlify Functions, so an
// unmocked GET here 404s and the strengthened watch() below would flag it.
const mockProgress = async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
const rmBase = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await rmBase.route("**/api/progress", mockProgress);
await rmBase.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
const rmBaseLabel = await rmBase.locator("[data-week-label]").textContent();
// All seven panels are always server-rendered (only some `hidden`), so this
// map holds every phase's heading text regardless of which one is showing.
const rmPanels = await rmBase.$$eval("[data-week-panel]", (els) =>
  els.map((el) => ({
    id: el.getAttribute("data-week-panel"),
    name: el.querySelector("[data-week-phase]")?.textContent ?? "",
    hidden: el.hidden,
  })),
);
const rmArc = await rmBase.$$eval("[data-arc-phase]", (els) =>
  els.map((el) => ({
    id: el.getAttribute("data-arc-phase"),
    wk: el.querySelector(".rm-arc-wk")?.textContent ?? "",
    start: el.querySelector("time")?.getAttribute("datetime") ?? "",
  })),
);
await rmBase.close();

// "W1" or "W15–19" (any dash) -> { from: 1, to: 1 } / { from: 15, to: 19 }.
const rmParseWk = (wk) => {
  const m = /^W(\d+)(?:\D+(\d+))?$/.exec(wk.trim());
  const from = Number(m[1]);
  return { from, to: m[2] !== undefined ? Number(m[2]) : from };
};

const rmBaseActiveId = rmPanels.find((p) => !p.hidden)?.id ?? null;
// The last phase chronologically, unless the build day already sits inside it
// -- then fall back to the first, which is still guaranteed different.
const rmTargetArc = rmArc[rmArc.length - 1].id !== rmBaseActiveId ? rmArc[rmArc.length - 1] : rmArc[0];
const rmLastWeek = Math.max(...rmArc.map((p) => rmParseWk(p.wk).to));
const rmTargetFromWeek = rmParseWk(rmTargetArc.wk).from;
const rmExpectedLabel = rmTargetFromWeek === 0 ? "Ramp week" : `Week ${rmTargetFromWeek} of ${rmLastWeek}`;
const rmExpectedName = rmPanels.find((p) => p.id === rmTargetArc.id)?.name ?? null;

// The target phase's own Monday, plus a couple of days so the fixed time sits
// solidly inside it rather than exactly on the boundary.
const rmFuture = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await rmFuture.route("**/api/progress", mockProgress);
await rmFuture.clock.setFixedTime(new Date(Date.parse(rmTargetArc.start) + 2 * DAY));
await rmFuture.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
const rmFutureLabel = await rmFuture.locator("[data-week-label]").textContent();
const rmVisiblePanels = rmFuture.locator("[data-week-panel]:not([hidden])");
const rmVisibleCount = await rmVisiblePanels.count();
const rmVisibleId = rmVisibleCount === 1 ? await rmVisiblePanels.first().getAttribute("data-week-panel") : null;
const rmVisibleName =
  rmVisibleCount === 1 ? await rmVisiblePanels.first().locator("[data-week-phase]").textContent() : null;
await rmFuture.close();

check(
  "roadmap: a stale visit recomputes the week label instead of keeping the build day's",
  rmFutureLabel === rmExpectedLabel && rmFutureLabel !== rmBaseLabel,
);
check("roadmap: exactly one phase panel is revealed after the recompute", rmVisibleCount === 1);
check(
  "roadmap: the revealed panel is the phase whose weeks contain the fixed date",
  rmVisibleId === rmTargetArc.id,
);
check("roadmap: the revealed panel's heading matches that phase's name", rmVisibleName === rmExpectedName);

// ---- roadmap: saved progress reaches the arrangement, not just the meters ----
// Every clip is server-rendered from an EMPTY completed set, so the built page
// ships "0 of N" with the wrong status fill on all three surfaces a clip is
// drawn on -- the desktop clip, the mobile graph row, and the inspector panel's
// kicker. src/scripts/roadmap.ts has to repaint all three from /api/progress.
// It once repainted only the meters and the panel's own N/M, which left the
// clip itself frozen at zero next to a panel already showing 1/5. `is-done` is
// the sharp end of this check: the build can never emit it (nothing is complete
// in an empty set), so seeing it proves the client rewrite actually ran.
const rmProg = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await rmProg.addInitScript(() => sessionStorage.setItem("roadmap-admin-token", "e2e-dummy-token"));
await rmProg.route("**/api/review", async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) }),
);
// Reassigned between loads; the handler reads it at request time, so one route
// serves both the empty page below and the nearly-complete one after the reload.
let rmSaved = [];
await rmProg.route("**/api/progress", async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ completed: rmSaved }) }),
);
await rmProg.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
// A reading clip, because its panel holds nothing but chapter checkboxes: a
// build panel also carries decision-log inputs, which are input[data-id] like
// any other but belong to no clip. Read from the DOM rather than hardcoded, so
// re-dating or re-scoping the plan cannot strand this check on a dead id.
const rmBook = await rmProg.evaluate(
  () => document.querySelector('.rm-clips[data-track="reading"] .rm-clip[data-clip-id]')?.dataset.clipId ?? null,
);
const rmTitle = (await rmProg.locator(`.rm-clip[data-clip-id="${rmBook}"] .rm-clip-title`).textContent())?.trim();
const rmBuiltSub = (await rmProg.locator(`.rm-clip[data-clip-id="${rmBook}"] [data-clip-sub]`).textContent())?.trim();
const rmChapters = await rmProg.$$eval(`#clip-${rmBook} input[data-id]`, (els) => els.map((el) => el.dataset.id));
check("roadmap: the built page really does ship a zeroed clip", /^0 of \d+ /.test(rmBuiltSub ?? ""));

// Load again with every chapter but the last already saved.
rmSaved = rmChapters.slice(0, -1);
await rmProg.reload({ waitUntil: "networkidle" });
const rmSubOf = (sel) => rmProg.locator(`${sel}[data-clip-id="${rmBook}"] [data-clip-sub]`).textContent();
const rmNearSub = (await rmSubOf(".rm-clip"))?.trim();
const rmNearGraph = (await rmSubOf(".rm-graph-row"))?.trim();
check(
  "roadmap: a clip's count is repainted from the saved progress, not left at the build's zero",
  rmNearSub === `${rmChapters.length - 1} of ${rmChapters.length} chapters` && rmNearSub !== rmBuiltSub,
);
check("roadmap: the mobile graph row is repainted too, not just the desktop clip", rmNearGraph === rmNearSub);

// Tick the last chapter: the clip must turn done on every surface, and say so.
await rmProg.waitForSelector(".roadmap-page.rm-editing");
await rmProg.locator(`.rm-clip[data-clip-id="${rmBook}"]`).click();
await rmProg.waitForSelector(`#clip-${rmBook}:target`);
// See check 3 above: jump instantly rather than waiting out the smooth scroll.
await rmProg.evaluate((id) => document.getElementById(`clip-${id}`)?.scrollIntoView({ behavior: "instant", block: "center" }), rmBook);
await rmProg.locator(`#clip-${rmBook} input[data-id="${rmChapters[rmChapters.length - 1]}"]`).click();
const rmDoneSub = (await rmSubOf(".rm-clip"))?.trim();
const rmDoneClips = await rmProg.locator(`.rm-clip[data-clip-id="${rmBook}"].is-done`).count();
const rmDoneRows = await rmProg.locator(`.rm-graph-row[data-clip-id="${rmBook}"].is-done`).count();
const rmKicker = (await rmProg.locator(`#clip-${rmBook} [data-clip-status]`).textContent())?.trim();
const rmSpoken = (await rmProg.locator("#rm-clip-live").textContent())?.trim();
check(
  "roadmap: completing the last child turns the clip done on both the arrangement and the graph",
  rmDoneSub === `${rmChapters.length} of ${rmChapters.length} chapters` && rmDoneClips === 1 && rmDoneRows === 1,
);
check("roadmap: the inspector kicker's spoken status follows the clip", rmKicker === "done");
// The status fill is purely visual and the legend is aria-hidden, so without a
// live region a screen-reader user hears "checked" and nothing about what it
// did. The clip must be named -- an unattributed "5 of 5 chapters, done." is
// not an announcement, it is a riddle.
check(
  `roadmap: the edit is announced, naming the clip and its new state (heard: ${JSON.stringify(rmSpoken)})`,
  !!rmSpoken && rmSpoken.includes(rmTitle) && rmSpoken.includes("done"),
);
await rmProg.close();

// ---- nothing threw anywhere ----
check(`no uncaught page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`, errors.length === 0);

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nall checks passed");

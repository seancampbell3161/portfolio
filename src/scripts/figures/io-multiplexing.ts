// src/scripts/figures/io-multiplexing.ts
// Progressive enhancement for the I/O multiplexing figure (interactions 5,
// spec §7). Without this the figure is its still frame with no controls. The
// script reveals the toolbar and runs wakes by painting whatever the model
// says shows at the elapsed time, on one animation-frame loop, so it holds no
// timers of its own. A hidden tab stops the loop; when the tab returns the
// wake fast-forwards to its end, and the wake is still recorded. Re-runnable:
// registered through onPage, so every navigation gets a fresh run and the
// previous one is aborted before the swap.
import {
  CALL_NAME,
  HOLD_MS,
  MECHANISMS,
  addWake,
  callStatus,
  columns,
  emptyTallies,
  frameAt,
  isCount,
  isMechanism,
  numbered,
  readoutText,
  readyLine,
  resetText,
  schedule,
  tallyText,
  wake as makeWake,
  type Count,
  type Frame,
  type Mechanism,
  type Schedule,
  type Tallies,
  type Wake,
} from "../../lib/figures/io-multiplexing";
import { onPage, type PageCtx } from "../lifecycle";

const IDLE: Frame = { phase: "idle", scan: null };

export function initIoFigure({ signal }: PageCtx): void {
  // The site puts one figure on a page; a second instance on the same page
  // would be ignored, not upgraded.
  const root = document.querySelector<HTMLElement>("[data-io-figure]");
  if (!root) return;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const controls = q("[data-io-controls]");
  const grid = q("[data-io-grid]");
  const step = q<HTMLButtonElement>("[data-io-step]");
  const play = q<HTMLButtonElement>("[data-io-play]");
  const callName = q("[data-io-call-name]");
  const callStatusEl = q("[data-io-call-status]");
  const readyTitle = q("[data-io-ready-title]");
  const readyNote = q("[data-io-ready-note]");
  const readout = q("[data-io-readout]");
  if (!controls || !grid || !step || !play || !callName || !callStatusEl || !readyTitle || !readyNote || !readout) return;

  const mechanismAttr = root.dataset.mechanism;
  let mechanism: Mechanism = isMechanism(mechanismAttr) ? mechanismAttr : "epoll";
  const countAttr = Number(root.dataset.count);
  let count: Count = isCount(countAttr) ? countAttr : 32;
  let tallies: Tallies = emptyTallies();
  let cells: HTMLElement[] = Array.from(grid.querySelectorAll<HTMLElement>("[data-io-cell]"));

  // One wake at a time. `frame` is the pending animation frame, for a wake or
  // for Play's gap; `gapStart` is when the last wake ended.
  let run: { wake: Wake; plan: Schedule; start: number; last: Frame | null; recorded: boolean } | null = null;
  let frame = 0;
  let playing = false;
  let gapStart = 0;

  const clearFrame = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const clearCells = (): void => {
    for (const c of cells) {
      c.removeAttribute("data-state");
      c.removeAttribute("data-seen");
      c.removeAttribute("data-scan");
    }
  };
  const pressGroup = (key: "ioMechanism" | "ioCount", value: string): void => {
    const sel = key === "ioMechanism" ? "[data-io-mechanism]" : "[data-io-count]";
    root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[key] === value)));
  };
  const writeBoxes = (w: Wake | null, m: Mechanism, f: Frame): void => {
    callStatusEl.textContent = callStatus(w, m, count, f);
    const r = readyLine(w, f);
    readyTitle.textContent = r.title;
    readyNote.textContent = r.note;
  };

  function paintIdle(): void {
    root.dataset.phase = "idle";
    clearCells();
    callName.textContent = CALL_NAME[mechanism];
    writeBoxes(null, mechanism, IDLE);
  }

  /** Paints one frame of a wake. Idempotent per frame; the loop calls it only when the frame changes. */
  function paint(w: Wake, f: Frame): void {
    if (f.phase === "idle") {
      paintIdle();
      return;
    }
    root.dataset.phase = f.phase;
    writeBoxes(w, w.mechanism, f);
    switch (f.phase) {
      case "arrive":
        for (const fd of w.ready) cells[fd]?.setAttribute("data-state", "ready");
        break;
      case "sweep": {
        const scan = f.scan ?? 0;
        cells.forEach((c, i) => {
          c.toggleAttribute("data-seen", i <= scan);
          c.toggleAttribute("data-scan", i === scan);
        });
        break;
      }
      case "return":
        // The trail is complete for select and poll (and applied at once under
        // reduced motion, where no sweep ran); epoll touched nothing.
        cells.forEach((c, i) => {
          c.toggleAttribute("data-seen", w.mechanism !== "epoll");
          c.removeAttribute("data-scan");
          if (w.ready.includes(i)) c.setAttribute("data-state", "found");
        });
        break;
      case "handle":
        for (const c of cells) {
          c.removeAttribute("data-state");
          c.removeAttribute("data-seen");
        }
        break;
    }
  }

  function recordWake(w: Wake): void {
    tallies = addWake(tallies, w);
    const row = q(`[data-io-tally="${w.mechanism}"]`);
    if (row) row.textContent = tallyText(tallies[w.mechanism]);
    readout.textContent = readoutText(w);
  }

  function tick(now: number): void {
    frame = 0;
    if (!run) return;
    const elapsed = now - run.start;
    const f = frameAt(run.plan, run.wake.count, Math.min(elapsed, run.plan.duration));
    if (!run.recorded && (f.phase === "return" || f.phase === "handle" || f.phase === "idle")) {
      run.recorded = true;
      recordWake(run.wake);
    }
    if (!run.last || f.phase !== run.last.phase || f.scan !== run.last.scan) {
      paint(run.wake, f);
      run.last = f;
    }
    if (elapsed >= run.plan.duration) {
      endWake();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function startWake(): void {
    clearFrame();
    const w = makeWake(mechanism, count, tallies[mechanism].wakes + 1);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    run = { wake: w, plan: schedule(w.mechanism, w.count, reduce), start: performance.now(), last: null, recorded: false };
    step.setAttribute("aria-disabled", "true");
    // The previous wake's frame may still be up (a reduced-motion wake holds its return frame).
    clearCells();
    callName.textContent = CALL_NAME[w.mechanism];
    tick(run.start);
  }

  function endWake(): void {
    run = null;
    step.removeAttribute("aria-disabled");
    gapStart = performance.now();
    if (playing) waitGap();
  }

  /** Play's pause between wakes, on the same frame loop. */
  function waitGap(): void {
    clearFrame();
    frame = requestAnimationFrame((now) => {
      frame = 0;
      if (!playing || run) return;
      if (now - gapStart >= HOLD_MS.gap) startWake();
      else waitGap();
    });
  }

  function cancelWake(): void {
    clearFrame();
    if (run) {
      run = null;
      step.removeAttribute("aria-disabled");
    }
  }

  function stopPlay(): void {
    playing = false;
    play.setAttribute("aria-pressed", "false");
  }

  function setMechanism(m: Mechanism): void {
    if (m === mechanism) return;
    mechanism = m;
    root.dataset.mechanism = m;
    pressGroup("ioMechanism", m);
    // A running wake keeps the mechanism it started with; otherwise the idle
    // frame repaints for the new one, clearing the still frame or a held
    // reduced-motion frame left over from the previous mechanism.
    if (!run) paintIdle();
  }

  function rebuildGrid(): void {
    const template = cells[0];
    if (!template) return;
    const next: HTMLElement[] = [];
    for (let fd = 0; fd < count; fd++) {
      // Cloning keeps Astro's scoped-style attribute on every new cell.
      const cell = template.cloneNode(true) as HTMLElement;
      cell.dataset.fd = String(fd);
      cell.removeAttribute("data-state");
      cell.removeAttribute("data-seen");
      cell.removeAttribute("data-scan");
      const num = cell.querySelector("span");
      if (num) num.textContent = String(fd);
      next.push(cell);
    }
    grid.replaceChildren(...next);
    grid.style.setProperty("--cols", String(columns(count)));
    grid.toggleAttribute("data-numbered", numbered(count));
    cells = next;
  }

  function setCount(c: Count): void {
    cancelWake();
    stopPlay();
    count = c;
    root.dataset.count = String(c);
    pressGroup("ioCount", String(c));
    rebuildGrid();
    tallies = emptyTallies();
    for (const m of MECHANISMS) {
      const row = q(`[data-io-tally="${m}"]`);
      if (row) row.textContent = tallyText(tallies[m]);
    }
    readout.textContent = resetText(c);
    paintIdle();
  }

  step.addEventListener(
    "click",
    () => {
      if (run) return;
      startWake();
    },
    { signal },
  );
  play.addEventListener(
    "click",
    () => {
      if (playing) {
        stopPlay();
        return;
      }
      playing = true;
      play.setAttribute("aria-pressed", "true");
      if (!run) startWake();
    },
    { signal },
  );
  controls.addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-io-mechanism],[data-io-count]");
      if (!b) return;
      const m = b.dataset.ioMechanism;
      if (isMechanism(m)) setMechanism(m);
      const n = Number(b.dataset.ioCount);
      if (b.dataset.ioCount !== undefined && isCount(n)) setCount(n);
    },
    { signal },
  );

  // Nothing animates unseen: Play turns off when the figure leaves the viewport.
  const visible = new IntersectionObserver((entries) => {
    if (playing && entries.some((entry) => !entry.isIntersecting)) stopPlay();
  });
  visible.observe(root);
  signal.addEventListener("abort", () => {
    visible.disconnect();
    cancelWake();
  });

  // State and DOM agree from the first frame: the run starts with empty
  // tallies, so the rows say so, whatever the markup shipped.
  for (const m of MECHANISMS) {
    const row = q(`[data-io-tally="${m}"]`);
    if (row) row.textContent = tallyText(tallies[m]);
  }

  // Never paintIdle() here: the server-rendered still frame is the figure's
  // resting state and must survive the upgrade, on a cold load and on every
  // navigation back to this essay.
  controls.hidden = false;
  root.toggleAttribute("data-live", true);
}

onPage(initIoFigure);

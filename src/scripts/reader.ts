// src/scripts/reader.ts
// Progressive enhancement for the reader frame (interactions 4): the reading
// line along the transport bar's bottom edge, and the sidebar that stays in
// view while the article scrolls. Without this the line stays hidden and
// nothing sticks; the page reads the same. The math is in src/lib/reading.ts;
// this file only measures and writes. Re-runnable: initReader() tears down the
// previous run first, so a view transition can call it again.
import { readingProgress } from "../lib/reading";

/** Room kept under the sidebar when deciding that it fits (the sticky offset comes from CSS). */
const GAP = 24;

let current: AbortController | null = null;

export function initReader(): void {
  current?.abort();
  const body = document.querySelector<HTMLElement>("[data-reader-body]");
  const line = document.querySelector<HTMLElement>("[data-reader-progress]");
  const aside = document.querySelector<HTMLElement>("[data-reader-aside]");
  if (!body) return;
  const measured = body;
  current = new AbortController();
  const { signal } = current;

  // The line: --p from 0 to 1, hidden while the body fits the viewport. The
  // bar's bottom edge is the reader's eyeline, wherever the line's bar ends.
  let last = "";
  function draw(): void {
    if (!line) return;
    const rect = measured.getBoundingClientRect();
    const p = readingProgress({
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      bar: line.parentElement?.getBoundingClientRect().bottom ?? 0,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    });
    line.hidden = p === null;
    const next = p === null ? "" : String(p);
    if (next !== last) {
      last = next;
      line.style.setProperty("--p", next);
    }
  }

  // The sidebar: data-fits when it sits under the bar with room to spare. CSS
  // turns that into position: sticky at 900px and up; --stick is its offset.
  function fit(): void {
    if (!aside) return;
    const stick = parseFloat(getComputedStyle(aside).getPropertyValue("--stick")) || 0;
    aside.toggleAttribute("data-fits", aside.offsetHeight + stick + GAP <= window.innerHeight);
  }

  // Scroll only moves the line. Anything that changes a height (the viewport,
  // a late image or font in the body, the sidebar's own content) redoes both.
  // One frame serves every event that arrives before it runs; a resize that
  // lands while a scroll's frame is pending still gets its fit.
  let frame = 0;
  let needFit = false;
  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (needFit) {
        needFit = false;
        fit();
      }
      draw();
    });
  }
  const onScroll = () => schedule();
  const onResize = () => {
    needFit = true;
    schedule();
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", onResize, { signal });
  const sizes = new ResizeObserver(onResize);
  sizes.observe(body);
  if (aside) sizes.observe(aside);
  signal.addEventListener("abort", () => {
    sizes.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
  });

  fit();
  draw();
}

initReader();

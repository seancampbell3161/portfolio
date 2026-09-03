// Progressive enhancement for the roadmap arrangement (spec §6). Without this
// file the page already works: the server-rendered "span" window stands, clips
// are anchors, and CSS :target shows the inspector panels. This script adds the
// "All" zoom, re-laying clips and redrawing the ruler and playhead with the same
// pure math the page used at build time (mirroring src/scripts/timeline.ts).
import { roadmapWindow, quarterTicks, type RoadmapClip, type RoadmapZoom } from "../lib/roadmap/arrange";
import { positionIn, packRows, estimateLabelWidth, fraction } from "../lib/timeline/layout";

const ZOOM_KEY = "roadmap-zoom";
const arr = document.querySelector<HTMLElement>(".rm-arr");
const dataEl = document.getElementById("rm-clip-data");
if (arr && dataEl) {
  document.documentElement.classList.add("js");
  const now = new Date();
  const raw = JSON.parse(dataEl.textContent || "[]") as Array<{
    id: string; track: RoadmapClip["track"]; title: string; sublabel?: string;
    start: string; end: string; status: RoadmapClip["status"]; href: string;
  }>;
  const clips: RoadmapClip[] = raw.map((c) => ({
    ...c, kind: "span", start: new Date(c.start), end: new Date(c.end),
  }));
  const estimate = estimateLabelWidth();

  function apply(zoom: RoadmapZoom) {
    const win = roadmapWindow(zoom, now, clips);
    for (const track of ["build", "reading", "foundations"] as const) {
      const placed = clips.filter((c) => c.track === track).flatMap((c) => positionIn(c, win, now) ?? []);
      const rows = packRows(placed, estimate);
      const lane = arr!.querySelector<HTMLElement>(`.rm-clips[data-track="${track}"]`);
      if (!lane) continue;
      for (const p of rows) {
        const el = lane.querySelector<HTMLElement>(`.rm-clip[data-clip-id="${p.item.id}"]`);
        if (!el) continue;
        el.style.setProperty("--x", `${p.x * 100}%`);
        el.style.setProperty("--w", `${p.w * 100}%`);
        el.style.setProperty("--y", String(p.row));
      }
    }
    // redraw ruler
    const ruler = arr!.querySelector<HTMLElement>(".rm-ruler");
    if (ruler) {
      ruler.innerHTML = "";
      for (const t of quarterTicks(win)) {
        const s = document.createElement("span");
        s.className = "rm-tick";
        s.style.left = `${t.x * 100}%`;
        s.textContent = t.label;
        ruler.appendChild(s);
      }
    }
    const ph = arr!.querySelector<HTMLElement>("[data-rm-playhead]");
    if (ph) ph.style.setProperty("--ph", String(fraction(now, win)));
    for (const b of arr!.querySelectorAll<HTMLButtonElement>("[data-rm-zoom]")) {
      b.setAttribute("aria-pressed", String(b.dataset.rmZoom === zoom));
    }
    try { localStorage.setItem(ZOOM_KEY, zoom); } catch {}
  }

  for (const b of arr.querySelectorAll<HTMLButtonElement>("[data-rm-zoom]")) {
    b.addEventListener("click", () => apply(b.dataset.rmZoom as RoadmapZoom));
  }
  let initial: RoadmapZoom = "span";
  try { if (localStorage.getItem(ZOOM_KEY) === "all") initial = "all"; } catch {}
  apply(initial);
}

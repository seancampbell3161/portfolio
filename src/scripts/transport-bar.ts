// src/scripts/transport-bar.ts
// The mobile navigation menu. Unlike most of the site this is not progressive
// enhancement: without scripting the menu does not open at all. Extracted from
// TransportBar.astro so it can be torn down -- its Escape handler is on the
// document, which survives a swap and would otherwise stack one handler per
// navigation.
import { onPage, type PageCtx } from "./lifecycle";

export function initTransportBar({ signal }: PageCtx): void {
  const bar = document.querySelector<HTMLElement>(".tb");
  const toggle = bar?.querySelector<HTMLButtonElement>(".tb-menu");
  const panel = bar?.querySelector<HTMLElement>(".tb-mobile");
  if (!bar || !toggle || !panel) return;

  function setOpen(open: boolean) {
    toggle!.setAttribute("aria-expanded", String(open));
    panel!.hidden = !open;
    bar!.classList.toggle("menu-open", open);
  }

  toggle.addEventListener(
    "click",
    () => setOpen(toggle.getAttribute("aria-expanded") !== "true"),
    { signal },
  );
  for (const a of panel.querySelectorAll("a")) {
    a.addEventListener("click", () => setOpen(false), { signal });
  }
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
    },
    { signal },
  );
}

onPage(initTransportBar);

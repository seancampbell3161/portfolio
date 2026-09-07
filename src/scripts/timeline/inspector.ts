// src/scripts/timeline/inspector.ts
// The inspector's DOM follows the store: whichever item id is open gets
// data-open on its panel and data-selected on its clip. Focus and scrolling are
// side effects of the two entry points below, not of state changes, so a deep
// link can open a panel without stealing focus.
import type { Ctx } from "./state";

const panelFor = (id: string): HTMLElement | null => document.getElementById(`item-${id}`);

export function openItem(ctx: Ctx, id: string, opts: { scroll?: boolean; focus?: boolean } = {}): void {
  const panel = panelFor(id);
  if (!panel || !ctx.elById.has(id)) return;
  ctx.store.set({ openId: id, pinned: null });
  if (opts.scroll) panel.scrollIntoView({ block: "nearest" });
  if (opts.focus !== false) panel.focus({ preventScroll: !opts.scroll });
}

export function closeItem(ctx: Ctx): void {
  const id = ctx.store.get().openId;
  if (!id) return;
  ctx.store.set({ openId: null });
  ctx.elById.get(id)?.querySelector<HTMLElement>(".tl-clip")?.focus();
}

export function initInspector(ctx: Ctx): void {
  ctx.store.subscribe((s, prev) => {
    if (s.openId === prev.openId) return;
    if (prev.openId) {
      panelFor(prev.openId)?.removeAttribute("data-open");
      ctx.elById.get(prev.openId)?.removeAttribute("data-selected");
    }
    if (s.openId) {
      panelFor(s.openId)?.setAttribute("data-open", "");
      ctx.elById.get(s.openId)?.setAttribute("data-selected", "");
    }
  });

  // Delegated on the document, not the timeline root, so a link to an item from
  // anywhere on the page (later: the "On this date" panel) opens it in place.
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element;
      const a = target.closest<HTMLAnchorElement>("a[data-item-link]");
      if (a) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openItem(ctx, a.dataset.itemLink ?? "", { scroll: true });
        return;
      }
      if (target.closest("[data-inspector-close]")) {
        e.preventDefault();
        closeItem(ctx);
      }
    },
    { signal: ctx.signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && ctx.store.get().openId) closeItem(ctx);
    },
    { signal: ctx.signal },
  );
}

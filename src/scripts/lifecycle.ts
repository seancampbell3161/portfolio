// src/scripts/lifecycle.ts
// The document-bound half of the lifecycle contract (src/lib/lifecycle.ts).
// Every enhancement imports onPage from here.
import { createLifecycle } from "../lib/lifecycle";

export type { PageCtx, PageInit } from "../lib/lifecycle";

export const onPage = createLifecycle(document);

// Inspector.astro gates its no-script :target fallback behind html:not(.js).
// Astro's swap copies <html> attributes from the incoming document, so the
// class is lost on the first navigation and the CSS fallback would start
// showing panels while the script also believes it owns them. Both writes are
// needed and neither is redundant: a module first imported *during* a swap
// registers its listener after that navigation's astro:after-swap has already
// fired, so the import-time write covers its own arrival and the listener
// covers every navigation after it.
const markJs = () => document.documentElement.classList.add("js");
markJs();
document.addEventListener("astro:after-swap", markJs);

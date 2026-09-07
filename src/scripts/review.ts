import { reviewCards, type ReviewCard } from "../data/review-cards";
import { unlockedCards, dueCards, completedIdsFromProgress } from "../lib/review/generator";
import { schedule, updateStreak, displayStreak, todayStr } from "../lib/review/sm2";
import { emptyReviewState, type ReviewState, type Rating } from "../lib/review/types";
import { onPage, type PageCtx } from "./lifecycle";

const PROGRESS_API = "/api/progress";
const REVIEW_API = "/api/review";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const THREADS: ReviewCard["thread"][] = [
  "build",
  "reading",
  "foundations",
  "judgment",
  "behavioral",
];

let completedIds = new Set<string>();
let state: ReviewState = emptyReviewState();
let queue: string[] = []; // due card ids, in session order
let authed = false;
let revealed = false;
let saveTimer: number | undefined;
// The signal of the run currently registered. scheduleSave() captures it at
// schedule time so a fired timer's save() knows whether its own page is still
// the one on screen, even though scheduleSave/save live outside initReview's
// closure and can't read its `signal` parameter directly.
let runSignal: AbortSignal | null = null;

const byId = (id: string) => document.getElementById(id);
const setText = (id: string, v: string) => {
  const el = byId(id);
  if (el) el.textContent = v;
};
const setHidden = (id: string, hidden: boolean) => {
  const el = byId(id);
  if (el) el.hidden = hidden;
};
const cardById = (id: string) => reviewCards.find((c) => c.id === id);

// ---- public rotation summary (no token needed) ----
function renderRotation() {
  const unlocked = unlockedCards(reviewCards, completedIds);
  setText("rv-rotation-count", String(unlocked.length));
  setText("rv-dash-rotation", String(unlocked.length));
  for (const t of THREADS) {
    const el = document.querySelector<HTMLElement>(`[data-rv-thread-count="${t}"]`);
    if (el) el.textContent = String(unlocked.filter((c) => c.thread === t).length);
  }
  const none = unlocked.length === 0;
  setHidden("rv-rotation-empty", !none);
  setHidden("rv-rotation-summary", none);
}

// ---- private runner (token present) ----
function setRevealed(on: boolean) {
  revealed = on;
  setHidden("rv-back", !on);
  setHidden("rv-reveal", on);
  setHidden("rv-ratings", !on);
}

function renderRunner() {
  setHidden("rv-runner", !authed);
  if (!authed) return;

  const unlocked = unlockedCards(reviewCards, completedIds);
  const streak = String(displayStreak(state));
  setText("rv-streak", streak);
  setText("rv-dash-streak", streak);
  setText("rv-due-count", String(queue.length));
  setText("rv-dash-due", String(queue.length));
  setHidden("rv-dash-private", false);

  const noUnlocked = unlocked.length === 0;
  const nothingDue = !noUnlocked && queue.length === 0;

  setHidden("rv-runner-locked", !noUnlocked);
  setHidden("rv-runner-done", !nothingDue);
  if (nothingDue) {
    setText("rv-runner-done", `All caught up — ${unlocked.length} cards in rotation.`);
  }
  setHidden("rv-card", queue.length === 0);
  if (queue.length === 0) return;

  const card = cardById(queue[0]);
  if (!card) return;
  const chip = byId("rv-thread");
  if (chip) {
    chip.textContent = card.thread;
    chip.className = `rv-chip rv-chip-${card.thread}`;
  }
  setText("rv-front", card.front);
  setText("rv-back", card.back);
  setRevealed(false);
}

function onRate(rating: Rating) {
  if (!authed || queue.length === 0) return;
  const today = todayStr();
  const id = queue[0];
  const prev =
    state.schedules[id] ?? { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today };
  state.schedules[id] = schedule(prev, rating, today);
  const st = updateStreak(state, today);
  state.streak = st.streak;
  state.lastReviewDate = st.lastReviewDate;

  queue.shift();
  if (rating === 0) queue.push(id); // Again → re-queue behind the rest (still due today)

  renderRunner();
  scheduleSave();
}

// ---- data load ----
async function loadProgress(signal?: AbortSignal | null) {
  try {
    const res = await fetch(PROGRESS_API);
    const data = (await res.json()) as { completed?: string[] };
    // The run that asked for this load may already be gone: don't let a tardy
    // response repaint the module state (or the DOM, below) the next run owns.
    if (signal?.aborted) return;
    completedIds = completedIdsFromProgress(data);
  } catch {
    if (signal?.aborted) return;
    completedIds = new Set();
  }
  renderRotation();
}

async function loadReview(signal?: AbortSignal | null) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    if (signal?.aborted) return;
    authed = false;
    renderRunner();
    return;
  }
  let nextState: ReviewState;
  try {
    const res = await fetch(REVIEW_API, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      if (signal?.aborted) return;
      authed = false;
      renderRunner();
      return;
    }
    if (!res.ok) throw new Error(`review load failed: ${res.status}`);
    nextState = (await res.json()) as ReviewState;
  } catch {
    if (signal?.aborted) return;
    authed = false;
    renderRunner();
    return;
  }
  // Both awaits above (the fetch and the json parse) have to resolve before
  // this run's own signal is checked one last time, or a swap mid-parse could
  // still slip through and assign into a run that no longer owns this state.
  if (signal?.aborted) return;
  state = nextState;
  authed = true;
  queue = dueCards(reviewCards, completedIds, state).map((d) => d.card.id);
  renderRunner();
}

// ---- persistence (mirror progress's Saving…/Saved + revert) ----
function setSaveState(text: string) {
  setText("rv-save-state", text);
}
function showMessage(text: string) {
  const el = byId("rv-message");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

async function save(signal?: AbortSignal | null) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    authed = false;
    renderRunner();
    return;
  }
  setSaveState("Saving…");
  try {
    const res = await fetch(REVIEW_API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(state),
    });
    // Wrong for every run that reads it back, so drop a rejected token
    // regardless of who owns what happens next.
    if (res.status === 401) sessionStorage.removeItem(TOKEN_KEY);
    // The run that scheduled this save may already be gone -- its abort
    // handler flushes on the way out (below), passing THIS VERY CALL an
    // already-aborted signal. That is intentional, not a bug: the fetch above
    // still had to fire, so the write reaches the server either way. Only what
    // happens next is suppressed here, because it would repaint the DOM and
    // module state that the next run now owns.
    if (signal?.aborted) return;
    if (res.status === 401) {
      authed = false;
      setSaveState("");
      showMessage("That token didn't work.");
      renderRunner();
      return;
    }
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    showMessage("");
    setSaveState("Saved");
  } catch {
    if (signal?.aborted) return;
    setSaveState("");
    showMessage("Couldn't save — reloading your saved reviews.");
    await loadReview(signal);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setSaveState("Saving…");
  const signal = runSignal;
  saveTimer = window.setTimeout(() => {
    // The abort handler's "is a save pending?" test is this variable's
    // truthiness -- drop the handle the moment the timer actually fires, or a
    // navigation long after the last edit would see a save as still pending
    // and fire a redundant one.
    saveTimer = undefined;
    void save(signal);
  }, SAVE_DEBOUNCE_MS);
}

// ---- wiring ----
export function initReview({ signal }: PageCtx): void {
  if (!byId("rv-runner")) return;
  runSignal = signal;

  completedIds = new Set<string>();
  state = emptyReviewState();
  queue = [];
  authed = false;
  revealed = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  byId("rv-reveal")?.addEventListener("click", () => setRevealed(true), { signal });
  for (const btn of document.querySelectorAll<HTMLElement>("[data-rv-rate]")) {
    btn.addEventListener("click", () => onRate(Number(btn.dataset.rvRate) as Rating), { signal });
  }

  // The progress "Edit" button collects the shared token via a synchronous
  // window.prompt. Re-check for it right after any click and light up the runner.
  byId("rm-edit")?.addEventListener(
    "click",
    () => {
      // Tethered to this run's signal (spec §6.2), unlike every other timer or
      // observer here which is registered up front: this one is scheduled
      // from inside an event handler instead, at click time, so there is
      // nowhere else to hang the abort listener. Without it, a click on
      // "Edit" moments before navigating away would leave the timer to fire
      // after the DOM (and the `authed`/`state` this closure reads) belong to
      // whatever run replaced it.
      const t = window.setTimeout(() => {
        if (!authed && sessionStorage.getItem(TOKEN_KEY)) void loadReview(signal);
      }, 0);
      signal.addEventListener("abort", () => window.clearTimeout(t), { once: true });
    },
    { signal },
  );

  // Keyboard: space reveals, 1–4 rate (ignore while focus is in a form field).
  document.addEventListener(
    "keydown",
    (e) => {
      if (!authed || (byId("rv-runner")?.hidden ?? true)) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        onRate((Number(e.key) - 1) as Rating);
      }
    },
    { signal },
  );

  // Abort means FLUSH, as in roadmap.ts: a rating given moments before leaving
  // the page must still reach /api/review.
  signal.addEventListener("abort", () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    void save(signal);
  });

  void (async () => {
    await loadProgress(signal); // completedIds first…
    await loadReview(signal); // …then the queue depends on it
  })();
}

onPage(initReview);

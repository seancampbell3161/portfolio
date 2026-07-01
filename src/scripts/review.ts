import { reviewCards, type ReviewCard } from "../data/review-cards";
import { unlockedCards, dueCards, completedIdsFromProgress } from "../lib/review/generator";
import { schedule, updateStreak, displayStreak, todayStr } from "../lib/review/sm2";
import { emptyReviewState, type ReviewState, type Rating } from "../lib/review/types";

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
async function loadProgress() {
  try {
    const res = await fetch(PROGRESS_API);
    const data = (await res.json()) as { completed?: string[] };
    completedIds = completedIdsFromProgress(data);
  } catch {
    completedIds = new Set();
  }
  renderRotation();
}

async function loadReview() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    authed = false;
    renderRunner();
    return;
  }
  try {
    const res = await fetch(REVIEW_API, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      authed = false;
      renderRunner();
      return;
    }
    if (!res.ok) throw new Error(`review load failed: ${res.status}`);
    state = (await res.json()) as ReviewState;
  } catch {
    authed = false;
    renderRunner();
    return;
  }
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

async function save() {
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
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
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
    setSaveState("");
    showMessage("Couldn't save — reloading your saved reviews.");
    await loadReview();
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setSaveState("Saving…");
  saveTimer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
}

// ---- wiring ----
function init() {
  byId("rv-reveal")?.addEventListener("click", () => setRevealed(true));
  for (const btn of document.querySelectorAll<HTMLElement>("[data-rv-rate]")) {
    btn.addEventListener("click", () => onRate(Number(btn.dataset.rvRate) as Rating));
  }

  // The progress "Edit" button collects the shared token via a synchronous
  // window.prompt. Re-check for it right after any click and light up the runner.
  byId("rm-edit")?.addEventListener("click", () => {
    window.setTimeout(() => {
      if (!authed && sessionStorage.getItem(TOKEN_KEY)) void loadReview();
    }, 0);
  });

  // Keyboard: space reveals, 1–4 rate (ignore while focus is in a form field).
  document.addEventListener("keydown", (e) => {
    if (!authed || (byId("rv-runner")?.hidden ?? true)) return;
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === " " && !revealed) {
      e.preventDefault();
      setRevealed(true);
    } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      onRate((Number(e.key) - 1) as Rating);
    }
  });

  void (async () => {
    await loadProgress(); // completedIds first…
    await loadReview(); // …then the queue depends on it
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

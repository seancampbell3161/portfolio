import { deriveStats } from "../data/roadmap";
import type { LogEntry } from "../data/roadmap";
import { onPage, type PageCtx } from "./lifecycle";

const API = "/api/progress";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const completed = new Set<string>();
const logEntries: Record<string, LogEntry> = {};
let editing = false;
let saveTimer: number | undefined;
// The signal of the run currently registered. scheduleSave() captures it at
// schedule time so a fired timer's save() knows whether its own page is still
// the one on screen, even though scheduleSave/save live outside initRoadmap's
// closure and can't read its `signal` parameter directly.
let runSignal: AbortSignal | null = null;
// The flush a departing run fired from its abort handler (§6.5), if one is
// still in flight. Module-scope, not per-run: the run that set it is gone by
// the time it matters, and it is the NEXT run's load() that has to see it.
let pendingFlush: Promise<void> | null = null;

const boxes = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>("input[data-id]"));

function setText(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setWidth(id: string, pct: number) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function statusFor(e: LogEntry | undefined): { text: string; cls: string } {
  if (!e || (!e.prediction && !e.confrontation)) return { text: "not started", cls: "is-none" };
  if (e.confrontation) {
    if (e.verdict) return { text: e.verdict, cls: `is-${e.verdict}` };
    return { text: "confronted", cls: "is-confronted" };
  }
  const conf = e.confidence == null ? "" : ` · ${e.confidence}%`;
  return { text: `predicted${conf}`, cls: "is-predicted" };
}

function applyStatus(details: HTMLElement, e: LogEntry | undefined) {
  const status = details.querySelector<HTMLElement>("[data-log-status]");
  if (!status) return;
  const s = statusFor(e);
  status.textContent = s.text; // textContent — never innerHTML
  status.className = `rm-log-status ${s.cls}`;
}

function renderLogs() {
  for (const details of document.querySelectorAll<HTMLElement>("[data-log-id]")) {
    const id = details.dataset.logId!;
    const e = logEntries[id];
    const pred = details.querySelector<HTMLTextAreaElement>('[data-log-field="prediction"]');
    const conf = details.querySelector<HTMLInputElement>('[data-log-field="confidence"]');
    const conf2 = details.querySelector<HTMLTextAreaElement>('[data-log-field="confrontation"]');
    const verd = details.querySelector<HTMLSelectElement>('[data-log-field="verdict"]');
    if (pred) pred.value = e?.prediction ?? "";
    if (conf) conf.value = e?.confidence == null ? "" : String(e.confidence);
    if (conf2) conf2.value = e?.confrontation ?? "";
    if (verd) verd.value = e?.verdict ?? "";
    applyStatus(details, e);
  }
}

function render() {
  for (const box of boxes()) box.checked = completed.has(box.dataset.id!);

  const s = deriveStats([...completed]);

  setText("rm-build-stages", String(s.build.stagesDone));
  setText("rm-build-courses", String(s.build.coursesDone));
  setWidth("rm-build-bar", s.build.pct);

  setText("rm-read-ch", String(s.reading.chaptersDone));
  setText("rm-read-books", String(s.reading.booksDone));
  setWidth("rm-read-bar", s.reading.pct);

  setText("rm-fnd-done", String(s.foundations.itemsDone));
  setWidth("rm-fnd-bar", s.foundations.pct);

  setText("rm-logs-done", String(s.logsDone));

  for (const el of document.querySelectorAll<HTMLElement>("[data-milestone-pct]")) {
    el.textContent = `${s.build.perMilestone[el.dataset.milestonePct!] ?? 0}%`;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-book-pct]")) {
    const b = s.reading.perBook[el.dataset.bookPct!];
    if (b) el.textContent = `${b.done}/${b.total}`;
  }

  renderLogs();
}

function setSaveState(text: string) {
  setText("rm-save-state", text);
}
function showMessage(text: string) {
  const el = document.getElementById("rm-message");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

function setEditable(on: boolean) {
  editing = on;
  for (const box of boxes()) box.disabled = !on;
  for (const f of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("[data-log-field]")) {
    f.disabled = !on;
  }
  document.querySelector(".roadmap-page")?.classList.toggle("rm-editing", on);
  const btn = document.getElementById("rm-edit");
  if (btn) btn.textContent = on ? "Done" : "Edit";
}

async function load(signal?: AbortSignal | null) {
  // A returning visit can start its GET while the run it replaced is still
  // flushing a POST from its abort handler (M-1): that write is what made the
  // edit survive the navigation in the first place, but the GET has no reason
  // to lose the race and repaint from the state the flush hasn't landed yet --
  // and the very next edit would then re-save that stale snapshot right back
  // over it. Waiting for the flush is enough: it never rejects (see save()'s
  // own catch), so there is nothing to handle here beyond the wait.
  if (pendingFlush) await pendingFlush;
  try {
    const res = await fetch(API);
    const data = (await res.json()) as {
      completed?: string[];
      logEntries?: Record<string, LogEntry>;
    };
    // The run that asked for this load may already be gone: don't let a tardy
    // response repaint the module state (or the DOM, below) the next run owns.
    if (signal?.aborted) return;
    completed.clear();
    for (const id of data.completed ?? []) completed.add(id);
    for (const key of Object.keys(logEntries)) delete logEntries[key];
    for (const [id, e] of Object.entries(data.logEntries ?? {})) logEntries[id] = e;
  } catch {
    if (signal?.aborted) return;
    // leave as-is; render shows zeros on first failure
  }
  render();
}

async function save(signal?: AbortSignal | null) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    setEditable(false);
    return;
  }
  setSaveState("Saving…");
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ completed: [...completed], logEntries: serializableLogEntries() }),
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
      setEditable(false);
      setSaveState("");
      showMessage("That token didn't work.");
      await load(signal);
      return;
    }
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    showMessage("");
    setSaveState("Saved");
  } catch {
    if (signal?.aborted) return;
    setSaveState("");
    showMessage("Couldn't save — your last change was undone.");
    await load(signal);
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

function onLogFieldChange(event: Event) {
  const el = event.target as HTMLElement;
  if (!el.matches?.("[data-log-field]") || !editing) return;
  const details = el.closest<HTMLElement>("[data-log-id]");
  if (!details) return;
  const id = details.dataset.logId!;
  const cur: LogEntry = logEntries[id] ?? {
    prediction: "",
    confidence: null,
    confrontation: "",
    verdict: null,
  };
  const field = el.dataset.logField;
  if (field === "prediction") cur.prediction = (el as HTMLTextAreaElement).value;
  else if (field === "confrontation") cur.confrontation = (el as HTMLTextAreaElement).value;
  else if (field === "confidence") {
    const v = (el as HTMLInputElement).value.trim();
    cur.confidence = v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v))));
  } else if (field === "verdict") {
    const v = (el as HTMLSelectElement).value;
    cur.verdict = v === "" ? null : (v as LogEntry["verdict"]);
  }
  logEntries[id] = cur;
  applyStatus(details, cur);
  scheduleSave();
}

function serializableLogEntries(): Record<string, LogEntry> {
  const out: Record<string, LogEntry> = {};
  for (const [id, e] of Object.entries(logEntries)) {
    // an entry is only real if a phase has prose; a bare confidence or
    // verdict without prediction/confrontation text is not persisted
    if (!e.prediction && !e.confrontation) continue;
    out[id] = e;
  }
  return out;
}

function onToggle(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.matches?.("input[data-id]") || !editing) return;
  const id = input.dataset.id!;
  if (input.checked) completed.add(id);
  else completed.delete(id);
  render();
  scheduleSave();
}

function onEditClick() {
  if (editing) {
    setEditable(false);
    return;
  }
  const token = window.prompt("Enter the admin token to edit progress");
  if (!token) return;
  sessionStorage.setItem(TOKEN_KEY, token);
  showMessage("");
  setEditable(true);
}

export function initRoadmap({ signal }: PageCtx): void {
  if (!document.querySelector(".roadmap-page")) return;
  runSignal = signal;

  // Module state is per-page: a navigation must not carry one page's edits into
  // the next run.
  completed.clear();
  for (const key of Object.keys(logEntries)) delete logEntries[key];
  editing = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  document.addEventListener("change", onToggle, { signal });
  document.addEventListener("input", onLogFieldChange, { signal });
  document.addEventListener("change", onLogFieldChange, { signal });
  document.getElementById("rm-edit")?.addEventListener("click", onEditClick, { signal });

  // Abort means FLUSH here, not cancel -- the opposite of everywhere else on
  // the site. Saves are debounced by 500ms, and under client-side routing
  // leaving the page is something the app does in process: tick a checkbox,
  // click "Writing" within half a second, and the edit would evaporate with the
  // timer. The write is fired instead, and outlives the page.
  signal.addEventListener("abort", () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    // Recorded so the run that replaces this one can wait for it (M-1) before
    // its own load() repaints from whatever the server had before this write
    // landed.
    pendingFlush = save(signal).finally(() => {
      pendingFlush = null;
    });
  });

  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load(signal);
}

onPage(initRoadmap);

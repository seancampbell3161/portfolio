import { deriveStats } from "../data/roadmap";
import type { LogEntry } from "../data/roadmap";

const API = "/api/progress";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const completed = new Set<string>();
const logEntries: Record<string, LogEntry> = {};
let editing = false;
let saveTimer: number | undefined;

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
    return { text: "confronted", cls: "is-partly" };
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

async function load() {
  try {
    const res = await fetch(API);
    const data = (await res.json()) as {
      completed?: string[];
      logEntries?: Record<string, LogEntry>;
    };
    completed.clear();
    for (const id of data.completed ?? []) completed.add(id);
    for (const key of Object.keys(logEntries)) delete logEntries[key];
    for (const [id, e] of Object.entries(data.logEntries ?? {})) logEntries[id] = e;
  } catch {
    // leave as-is; render shows zeros on first failure
  }
  render();
}

async function save() {
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
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setEditable(false);
      setSaveState("");
      showMessage("That token didn't work.");
      await load();
      return;
    }
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    showMessage("");
    setSaveState("Saved");
  } catch {
    setSaveState("");
    showMessage("Couldn't save — your last change was undone.");
    await load();
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setSaveState("Saving…");
  saveTimer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
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
    if (!e.prediction && !e.confrontation && e.confidence == null && !e.verdict) continue;
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

function init() {
  document.addEventListener("change", onToggle);
  document.addEventListener("input", onLogFieldChange);
  document.addEventListener("change", onLogFieldChange);
  document.getElementById("rm-edit")?.addEventListener("click", onEditClick);
  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

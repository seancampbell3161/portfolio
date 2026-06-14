import { deriveStats } from "../data/roadmap";

const API = "/api/progress";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const completed = new Set<string>();
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
  document.querySelector(".roadmap-page")?.classList.toggle("rm-editing", on);
  const btn = document.getElementById("rm-edit");
  if (btn) btn.textContent = on ? "Done" : "Edit";
}

async function load() {
  try {
    const res = await fetch(API);
    const data = (await res.json()) as { completed?: string[] };
    completed.clear();
    for (const id of data.completed ?? []) completed.add(id);
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
      body: JSON.stringify({ completed: [...completed] }),
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
  document.getElementById("rm-edit")?.addEventListener("click", onEditClick);
  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

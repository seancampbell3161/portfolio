import { isAuthorized } from "../tokens.js";
import type { ProgressBlob, LogEntry, RoadmapStore } from "../roadmap-store.js";

export interface ProgressDeps {
  store: RoadmapStore;
  token: string; // expected admin token (from env)
  validIds: Set<string>; // allowlist for `completed` (all IDs)
  validLogIds: Set<string>; // allowlist for `logEntries` keys (log IDs only)
  clock: () => Date;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const MAX_PROSE = 4000;
const VERDICTS = new Set(["right", "partly", "wrong"]);

type LogEntriesResult =
  | { ok: true; value: Record<string, LogEntry> }
  | { ok: false };

function validateLogEntries(raw: unknown, validLogIds: Set<string>): LogEntriesResult {
  if (raw === undefined) return { ok: true, value: {} };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false };

  const out: Record<string, LogEntry> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validLogIds.has(id)) return { ok: false };
    if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false };
    const e = v as Record<string, unknown>;

    const prediction = e.prediction ?? "";
    const confrontation = e.confrontation ?? "";
    const confidence = e.confidence ?? null;
    const verdict = e.verdict ?? null;

    if (typeof prediction !== "string" || prediction.length > MAX_PROSE) return { ok: false };
    if (typeof confrontation !== "string" || confrontation.length > MAX_PROSE) return { ok: false };
    if (
      confidence !== null &&
      (typeof confidence !== "number" || !Number.isInteger(confidence) || confidence < 0 || confidence > 100)
    ) {
      return { ok: false };
    }
    if (verdict !== null && (typeof verdict !== "string" || !VERDICTS.has(verdict))) return { ok: false };

    // drop entirely-empty entries so the blob never stores blanks
    if (prediction === "" && confrontation === "" && confidence === null && verdict === null) continue;

    out[id] = {
      prediction,
      confidence: confidence as number | null,
      confrontation,
      verdict: verdict as LogEntry["verdict"],
    };
  }
  return { ok: true, value: out };
}

export async function handleProgress(req: Request, deps: ProgressDeps): Promise<Response> {
  if (req.method === "GET") {
    const blob = await deps.store.getProgress();
    return json(200, {
      completed: blob?.completed ?? [],
      logEntries: blob?.logEntries ?? {},
      updatedAt: blob?.updatedAt ?? null,
    });
  }

  if (req.method === "POST") {
    if (!isAuthorized(req, deps.token)) {
      return json(401, { error: "unauthorized" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid body" });
    }

    const completed = (body as { completed?: unknown })?.completed;
    if (!Array.isArray(completed) || !completed.every((x) => typeof x === "string")) {
      return json(400, { error: "invalid body" });
    }

    const unknown = completed.filter((id) => !deps.validIds.has(id));
    if (unknown.length) {
      return json(400, { error: "unknown id", ids: unknown });
    }

    const logResult = validateLogEntries((body as { logEntries?: unknown })?.logEntries, deps.validLogIds);
    if (!logResult.ok) {
      return json(400, { error: "invalid logEntries" });
    }

    const blob: ProgressBlob = {
      version: 2,
      updatedAt: deps.clock().toISOString(),
      completed: [...new Set(completed)],
      logEntries: logResult.value,
    };
    await deps.store.setProgress(blob);
    return json(200, { ok: true, updatedAt: blob.updatedAt });
  }

  return json(405, { error: "method not allowed" });
}

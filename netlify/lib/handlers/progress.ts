import { isAuthorized } from "../tokens.js";
import type { ProgressBlob, RoadmapStore } from "../roadmap-store.js";

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

    const blob: ProgressBlob = {
      version: 2,
      updatedAt: deps.clock().toISOString(),
      completed: [...new Set(completed)],
      logEntries: {},
    };
    await deps.store.setProgress(blob);
    return json(200, { ok: true, updatedAt: blob.updatedAt });
  }

  return json(405, { error: "method not allowed" });
}

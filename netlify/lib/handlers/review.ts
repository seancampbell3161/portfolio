import { isAuthorized } from "../tokens.js";
import type { ReviewStore } from "../review-store.js";
import type { ReviewState } from "../../../src/lib/review/types.js";

export interface ReviewDeps {
  store: ReviewStore;
  token: string; // expected admin token (from env)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const EMPTY: ReviewState = { schedules: {}, streak: 0, lastReviewDate: null };

function isReviewState(x: unknown): x is ReviewState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  if (typeof s.schedules !== "object" || s.schedules === null || Array.isArray(s.schedules)) return false;
  if (typeof s.streak !== "number") return false;
  if (!(s.lastReviewDate === null || typeof s.lastReviewDate === "string")) return false;
  return true;
}

// Difference from progress: GET is gated too — the schedule is private.
export async function handleReview(req: Request, deps: ReviewDeps): Promise<Response> {
  if (!isAuthorized(req, deps.token)) {
    return json(401, { error: "unauthorized" });
  }

  if (req.method === "GET") {
    const state = await deps.store.getState();
    return json(200, state ?? EMPTY);
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid body" });
    }
    if (!isReviewState(body)) {
      return json(400, { error: "invalid body" });
    }
    await deps.store.setState(body);
    return json(200, { ok: true });
  }

  return json(405, { error: "method not allowed" });
}

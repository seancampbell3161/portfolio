import { describe, it, expect } from "vitest";
import { handleReview, type ReviewDeps } from "../../handlers/review.js";
import type { ReviewStore } from "../../review-store.js";
import type { ReviewState } from "../../../../src/lib/review/types.js";

function fakeStore(initial: ReviewState | null = null) {
  let state = initial;
  const store: ReviewStore & { current: () => ReviewState | null } = {
    async getState() {
      return state;
    },
    async setState(s) {
      state = s;
    },
    current: () => state,
  };
  return store;
}

function deps(over: Partial<ReviewDeps> = {}): ReviewDeps {
  return { store: fakeStore(), token: "secret", ...over };
}

const sampleState: ReviewState = {
  schedules: { "card.beh.star": { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: "2026-07-02" } },
  streak: 3,
  lastReviewDate: "2026-07-01",
};

const get = (auth?: string) =>
  new Request("http://x/api/review", auth ? { headers: { authorization: auth } } : undefined);
const post = (body: unknown, auth?: string) =>
  new Request("http://x/api/review", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("handleReview auth", () => {
  it("GET without a token is 401", async () => {
    expect((await handleReview(get(), deps())).status).toBe(401);
  });
  it("GET with a bad token is 401", async () => {
    expect((await handleReview(get("Bearer wrong"), deps())).status).toBe(401);
  });
  it("POST without a token is 401", async () => {
    expect((await handleReview(post(sampleState), deps())).status).toBe(401);
  });
});

describe("handleReview GET", () => {
  it("returns the empty default when nothing is stored", async () => {
    const res = await handleReview(get("Bearer secret"), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schedules: {}, streak: 0, lastReviewDate: null });
  });
  it("returns stored state when present", async () => {
    const store = fakeStore(sampleState);
    const res = await handleReview(get("Bearer secret"), deps({ store }));
    expect(await res.json()).toEqual(sampleState);
  });
});

describe("handleReview POST", () => {
  it("persists a valid ReviewState and returns ok", async () => {
    const store = fakeStore();
    const res = await handleReview(post(sampleState, "Bearer secret"), deps({ store }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(store.current()).toEqual(sampleState);
  });
  it("rejects malformed JSON with 400", async () => {
    const res = await handleReview(post("{not json", "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });
  it("rejects a body missing schedules/streak with 400", async () => {
    const res = await handleReview(post({ streak: 1 }, "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });
  it("rejects a bad lastReviewDate type with 400", async () => {
    const res = await handleReview(
      post({ schedules: {}, streak: 0, lastReviewDate: 5 }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });
});

describe("handleReview other methods", () => {
  it("returns 405 for DELETE (after auth)", async () => {
    const req = new Request("http://x/api/review", {
      method: "DELETE",
      headers: { authorization: "Bearer secret" },
    });
    expect((await handleReview(req, deps())).status).toBe(405);
  });
});

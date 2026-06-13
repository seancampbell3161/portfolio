import { describe, it, expect } from "vitest";
import { handleProgress, type ProgressDeps } from "../../handlers/progress.js";
import type { ProgressBlob, RoadmapStore } from "../../roadmap-store.js";

function fakeStore(initial: ProgressBlob | null = null) {
  let blob = initial;
  const store: RoadmapStore & { current: () => ProgressBlob | null } = {
    async getProgress() {
      return blob;
    },
    async setProgress(b) {
      blob = b;
    },
    current: () => blob,
  };
  return store;
}

const clock = () => new Date("2026-06-13T12:00:00Z");
const validIds = new Set(["m1.w1.mon", "m1.w1.log", "m1.w2.wed"]);

function deps(over: Partial<ProgressDeps> = {}): ProgressDeps {
  return { store: fakeStore(), token: "secret", validIds, clock, ...over };
}

const get = () => new Request("http://x/api/progress");
const post = (body: unknown, auth?: string) =>
  new Request("http://x/api/progress", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });

describe("handleProgress GET", () => {
  it("returns empty state when no blob exists", async () => {
    const res = await handleProgress(get(), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: [], updatedAt: null });
  });

  it("returns stored progress when present", async () => {
    const store = fakeStore({
      version: 1,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: ["m1.w1.mon"],
    });
    const res = await handleProgress(get(), deps({ store }));
    expect(await res.json()).toEqual({
      completed: ["m1.w1.mon"],
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  });
});

describe("handleProgress POST auth", () => {
  it("rejects a missing token with 401", async () => {
    const res = await handleProgress(post({ completed: [] }), deps());
    expect(res.status).toBe(401);
  });

  it("rejects a bad token with 401", async () => {
    const res = await handleProgress(post({ completed: [] }, "Bearer wrong"), deps());
    expect(res.status).toBe(401);
  });

  it("rejects all writes when the expected token is empty", async () => {
    const res = await handleProgress(
      post({ completed: [] }, "Bearer anything"),
      deps({ token: "" }),
    );
    expect(res.status).toBe(401);
  });
});

describe("handleProgress POST validation", () => {
  it("rejects an unknown id with 400", async () => {
    const res = await handleProgress(
      post({ completed: ["m1.w1.mon", "bogus"] }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-array completed field with 400", async () => {
    const res = await handleProgress(post({ completed: "nope" }, "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new Request("http://x/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
      body: "{not json",
    });
    const res = await handleProgress(req, deps());
    expect(res.status).toBe(400);
  });
});

describe("handleProgress POST success", () => {
  it("persists the completed array and returns updatedAt", async () => {
    const store = fakeStore();
    const res = await handleProgress(
      post({ completed: ["m1.w1.mon", "m1.w1.log"] }, "Bearer secret"),
      deps({ store }),
    );
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ ok: true, updatedAt: "2026-06-13T12:00:00.000Z" });
    expect(store.current()).toEqual({
      version: 1,
      updatedAt: "2026-06-13T12:00:00.000Z",
      completed: ["m1.w1.mon", "m1.w1.log"],
    });
  });

  it("de-duplicates repeated IDs before storing", async () => {
    const store = fakeStore();
    await handleProgress(
      post({ completed: ["m1.w1.mon", "m1.w1.mon"] }, "Bearer secret"),
      deps({ store }),
    );
    expect(store.current()?.completed).toEqual(["m1.w1.mon"]);
  });

  it("accepts an empty completed array as a reset", async () => {
    const store = fakeStore({
      version: 1,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: ["m1.w1.mon"],
    });
    const res = await handleProgress(post({ completed: [] }, "Bearer secret"), deps({ store }));
    expect(res.status).toBe(200);
    expect(store.current()?.completed).toEqual([]);
  });
});

describe("handleProgress other methods", () => {
  it("returns 405 for unsupported methods", async () => {
    const req = new Request("http://x/api/progress", { method: "DELETE" });
    const res = await handleProgress(req, deps());
    expect(res.status).toBe(405);
  });
});

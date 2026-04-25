import { describe, it, expect } from "vitest";
import { handleSubscribe } from "../../handlers/subscribe.js";
import { handleConfirm } from "../../handlers/confirm.js";
import { handleUnsubscribe } from "../../handlers/unsubscribe.js";
import { memoryStorage } from "../helpers/memory-storage.js";
import { fakeEmail } from "../helpers/fake-email.js";
import type { Deps } from "../../types.js";

const fixedNow = new Date("2026-04-25T12:00:00Z");

describe("subscribe → confirm → unsubscribe round trip", () => {
  it("walks a user through the full lifecycle", async () => {
    const deps: Deps = {
      storage: memoryStorage(),
      email: fakeEmail(),
      clock: () => fixedNow,
      siteUrl: "https://seanthedeveloper.com",
    };

    const subRes = await handleSubscribe(
      new Request("https://seanthedeveloper.com/api/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nf-client-connection-ip": "1.1.1.1",
        },
        body: JSON.stringify({ email: "sean@example.com" }),
      }),
      deps,
    );
    expect(subRes.status).toBe(200);

    const sent = (deps.email as any).sent;
    expect(sent).toHaveLength(1);
    const confirmUrl: string = sent[0].confirmUrl;

    const confirmRes = await handleConfirm(new Request(confirmUrl), deps);
    expect(confirmRes.headers.get("location")).toBe(
      "https://seanthedeveloper.com/newsletter/confirmed",
    );

    const sub = await deps.storage.getSubscriber("sean@example.com");
    expect(sub!.status).toBe("confirmed");

    const unsubUrl = `https://seanthedeveloper.com/api/unsubscribe?token=${sub!.unsubscribeToken}`;
    const unsubRes = await handleUnsubscribe(new Request(unsubUrl), deps);
    expect(unsubRes.headers.get("location")).toBe(
      "https://seanthedeveloper.com/newsletter/unsubscribed",
    );

    const final = await deps.storage.getSubscriber("sean@example.com");
    expect(final!.status).toBe("unsubscribed");
  });
});

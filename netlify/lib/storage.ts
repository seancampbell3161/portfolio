import { getStore } from "@netlify/blobs";
import type {
  Storage,
  Subscriber,
  State,
  RateLimitRecord,
} from "./types.js";

const STATE_KEY = "__state";
const RATE_PREFIX = "__ratelimit:";

export function blobsStorage(): Storage {
  const store = getStore("newsletter");

  const subKey = (email: string) => `sub:${email.toLowerCase()}`;

  return {
    async getSubscriber(email) {
      const v = await store.get(subKey(email), { type: "json" });
      return (v as Subscriber | null) ?? null;
    },
    async putSubscriber(s) {
      await store.setJSON(subKey(s.email), s);
    },
    async listSubscribers() {
      const out: Subscriber[] = [];
      const { blobs } = await store.list({ prefix: "sub:" });
      for (const b of blobs) {
        const v = await store.get(b.key, { type: "json" });
        if (v) out.push(v as Subscriber);
      }
      return out;
    },
    async findSubscriberByConfirmToken(token) {
      for (const s of await this.listSubscribers()) {
        if (s.confirmToken === token) return s;
      }
      return null;
    },
    async findSubscriberByUnsubscribeToken(token) {
      for (const s of await this.listSubscribers()) {
        if (s.unsubscribeToken === token) return s;
      }
      return null;
    },
    async getState() {
      const v = await store.get(STATE_KEY, { type: "json" });
      return (v as State | null) ?? null;
    },
    async putState(s) {
      await store.setJSON(STATE_KEY, s);
    },
    async getRateLimit(ip) {
      const v = await store.get(RATE_PREFIX + ip, { type: "json" });
      return (v as RateLimitRecord | null) ?? null;
    },
    async putRateLimit(ip, r) {
      await store.setJSON(RATE_PREFIX + ip, r);
    },
  };
}

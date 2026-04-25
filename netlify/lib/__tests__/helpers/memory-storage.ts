import type {
  Storage,
  Subscriber,
  State,
  RateLimitRecord,
} from "../../types.js";

export function memoryStorage(): Storage & {
  _subs: Map<string, Subscriber>;
  _state: { current: State | null };
  _rates: Map<string, RateLimitRecord>;
} {
  const subs = new Map<string, Subscriber>();
  const state = { current: null as State | null };
  const rates = new Map<string, RateLimitRecord>();

  return {
    _subs: subs,
    _state: state,
    _rates: rates,

    async getSubscriber(email) {
      return subs.get(email.toLowerCase()) ?? null;
    },
    async putSubscriber(s) {
      subs.set(s.email.toLowerCase(), s);
    },
    async listSubscribers() {
      return [...subs.values()];
    },
    async findSubscriberByConfirmToken(token) {
      for (const s of subs.values()) if (s.confirmToken === token) return s;
      return null;
    },
    async findSubscriberByUnsubscribeToken(token) {
      for (const s of subs.values()) if (s.unsubscribeToken === token) return s;
      return null;
    },
    async getState() {
      return state.current;
    },
    async putState(s) {
      state.current = s;
    },
    async getRateLimit(ip) {
      return rates.get(ip) ?? null;
    },
    async putRateLimit(ip, r) {
      rates.set(ip, r);
    },
  };
}

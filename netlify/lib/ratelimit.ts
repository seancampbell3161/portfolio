import type { Storage } from "./types.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function checkRateLimit(
  storage: Storage,
  ip: string,
  now: Date,
): Promise<boolean> {
  const existing = await storage.getRateLimit(ip);
  if (!existing || now.getTime() - new Date(existing.windowStart).getTime() > WINDOW_MS) {
    await storage.putRateLimit(ip, { attempts: 1, windowStart: now.toISOString() });
    return true;
  }
  if (existing.attempts >= MAX_ATTEMPTS) return false;
  await storage.putRateLimit(ip, {
    attempts: existing.attempts + 1,
    windowStart: existing.windowStart,
  });
  return true;
}

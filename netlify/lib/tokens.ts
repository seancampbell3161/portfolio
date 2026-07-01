import { randomBytes, timingSafeEqual } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

export function isAuthorized(req: Request, expected: string): boolean {
  const provided = bearerToken(req);
  return !!provided && !!expected && constantTimeEquals(provided, expected);
}

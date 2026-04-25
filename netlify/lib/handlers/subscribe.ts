import type { Deps, Subscriber } from "../types.js";
import { isValidEmail } from "../validation.js";
import { generateToken } from "../tokens.js";
import { checkRateLimit } from "../ratelimit.js";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export async function handleSubscribe(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid body" });
  }

  const rawEmail = typeof body?.email === "string" ? body.email : "";
  if (!isValidEmail(rawEmail)) return json(400, { error: "invalid email" });

  const ip = clientIp(req);
  const allowed = await checkRateLimit(deps.storage, ip, deps.clock());
  if (!allowed) return json(429, { error: "too many attempts" });

  const email = rawEmail.trim().toLowerCase();
  const now = deps.clock().toISOString();
  const existing = await deps.storage.getSubscriber(email);

  if (existing?.status === "confirmed") {
    return json(200, { ok: true });
  }

  const confirmToken = generateToken();
  const unsubscribeToken = existing?.unsubscribeToken ?? generateToken();

  const next: Subscriber = {
    email,
    status: "pending",
    createdAt: existing?.createdAt ?? now,
    confirmedAt: null,
    unsubscribedAt: null,
    confirmToken,
    unsubscribeToken,
  };
  await deps.storage.putSubscriber(next);

  await deps.email.sendConfirmation({
    to: email,
    confirmUrl: `${deps.siteUrl}/api/confirm?token=${confirmToken}`,
  });

  return json(200, { ok: true });
}

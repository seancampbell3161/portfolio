import { DISPOSABLE_DOMAINS } from "./disposable-domains.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  const email = input.trim();
  if (email.length === 0 || email.length > 254) return false;
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split("@")[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}

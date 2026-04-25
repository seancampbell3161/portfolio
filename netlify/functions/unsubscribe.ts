import { handleUnsubscribe } from "../lib/handlers/unsubscribe.js";
import { blobsStorage } from "../lib/storage.js";
import { resendSender } from "../lib/email.js";

const apiKey = process.env.RESEND_API_KEY!;
const from = process.env.RESEND_FROM!;
const siteUrl = process.env.SITE_URL ?? "https://seanthedeveloper.com";

export default async (req: Request) =>
  handleUnsubscribe(req, {
    storage: blobsStorage(),
    email: resendSender({ apiKey, from }),
    clock: () => new Date(),
    siteUrl,
  });

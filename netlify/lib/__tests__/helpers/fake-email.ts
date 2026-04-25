import type { EmailSender } from "../../types.js";

export type CapturedEmail =
  | { kind: "confirmation"; to: string; confirmUrl: string }
  | {
      kind: "post";
      to: string;
      postTitle: string;
      postDescription: string;
      postUrl: string;
      unsubscribeUrl: string;
    };

export function fakeEmail(): EmailSender & { sent: CapturedEmail[] } {
  const sent: CapturedEmail[] = [];
  return {
    sent,
    async sendConfirmation({ to, confirmUrl }) {
      sent.push({ kind: "confirmation", to, confirmUrl });
    },
    async sendPostNotification(args) {
      sent.push({ kind: "post", ...args });
    },
  };
}

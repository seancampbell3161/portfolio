// src/scripts/newsletter.ts
// The subscribe form. Not progressive enhancement: without scripting the form
// does not submit. Extracted from Newsletter.astro so it is re-bound after a
// navigation -- the form element is replaced by every swap, so a listener bound
// once at import would be attached to a detached node.
import { onPage, type PageCtx } from "./lifecycle";

export function initNewsletter({ signal }: PageCtx): void {
  const form = document.querySelector<HTMLFormElement>("[data-newsletter-form]");
  const message = document.querySelector<HTMLParagraphElement>("[data-newsletter-message]");
  if (!form || !message) return;

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const button = form.querySelector<HTMLButtonElement>("button");
      const input = form.querySelector<HTMLInputElement>("input[name=email]");
      if (!input || !button) return;
      const email = input.value.trim();
      if (!email) {
        message.textContent = "Please enter an email address.";
        message.dataset.state = "error";
        return;
      }
      button.disabled = true;
      message.textContent = "";
      message.dataset.state = "";
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          form.reset();
          message.textContent = "Check your inbox for a confirmation email.";
          message.dataset.state = "success";
        } else if (res.status === 429) {
          message.textContent = "Too many attempts. Please try again in a few minutes.";
          message.dataset.state = "error";
        } else {
          message.textContent = "That didn't look right — please check the email address.";
          message.dataset.state = "error";
        }
      } catch {
        message.textContent = "Network error. Please try again.";
        message.dataset.state = "error";
      } finally {
        button.disabled = false;
      }
    },
    { signal },
  );
}

onPage(initNewsletter);

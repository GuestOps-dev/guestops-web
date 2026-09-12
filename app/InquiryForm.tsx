"use client";

import { useState } from "react";

export default function InquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    setState("sending"); setError(null);
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "We could not send your inquiry just now.");
      setState("sent"); event.currentTarget.reset();
    } catch (submitError: any) {
      setError(submitError?.message ?? "We could not send your inquiry just now."); setState("idle");
    }
  }

  if (state === "sent") return <div className="marketing-inquiry-success" role="status"><span>✓</span><h3>Thank you — we&apos;ve received your note.</h3><p>Someone from GuestOpsHQ will be in touch soon.</p></div>;
  return <form className="marketing-form" onSubmit={submit}>
    <label>Your name<input name="name" required minLength={2} placeholder="Your name" /></label>
    <label>Work email<input type="email" name="email" required placeholder="you@company.com" /></label>
    <label>Tell us about your properties<textarea name="message" rows={3} placeholder="Number of homes, where you host, and what you need help with…" /></label>
    <label className="marketing-honeypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
    {error ? <p className="marketing-form-error" role="alert">{error} <a href="mailto:info@guestopshq.com">Email us instead</a>.</p> : null}
    <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : <>Start a conversation <span>→</span></>}</button>
    <small>We&apos;ll only use your details to respond to this inquiry.</small>
  </form>;
}

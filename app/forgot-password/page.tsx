"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    setBusy(false);

    if (requestError) {
      setError(requestError.message);
      return;
    }

    setSubmitted(true);
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Reset password</h1>
      <p style={{ marginBottom: 16 }}>
        Enter your email address and we’ll send a password-reset link.
      </p>

      {submitted ? (
        <div
          style={{
            padding: 12,
            background: "#e6ffed",
            border: "1px solid #34c759",
            borderRadius: 10,
          }}
        >
          If an account exists for that email address, a reset link is on its
          way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          {error ? (
            <div
              style={{
                padding: 12,
                background: "#fee",
                border: "1px solid #f99",
                borderRadius: 10,
              }}
            >
              <strong>Unable to send reset email:</strong> {error}
            </div>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
          </label>

          <button
            disabled={busy}
            type="submit"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div style={{ marginTop: 16, fontSize: 13 }}>
        <Link href="/login">Back to login</Link>
      </div>
    </main>
  );
}

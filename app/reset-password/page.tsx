"use client";

import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function ResetPasswordInner() {
  const searchParams = useSearchParams();

  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareSession() {
      const code = searchParams.get("code");

      if (!code) {
        if (!cancelled) {
          setSessionError("Invalid or expired recovery link.");
          setSessionLoading(false);
        }
        return;
      }

      try {
        const sb = getSupabaseBrowserClient();
        const { error } = await sb.auth.exchangeCodeForSession(code);

        if (cancelled) return;

        if (error) {
          setSessionError("Invalid or expired recovery link.");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSessionError("Invalid or expired recovery link.");
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    }

    prepareSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password || !confirm) {
      setError("Please fill out both password fields.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const sb = getSupabaseBrowserClient();
      const { error } = await sb.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      setSuccess(true);
      setBusy(false);
    } catch (err) {
      console.error(err);
      setError("Unexpected error. Please try again.");
      setBusy(false);
    }
  }

  if (sessionLoading) {
    return (
      <main style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
        Loading…
      </main>
    );
  }

  if (sessionError) {
    return (
      <main style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Reset password</h1>
        <div
          style={{
            padding: 12,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 10,
          }}
        >
          {sessionError}
        </div>
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link href="/login">Back to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Reset password</h1>

      {success ? (
        <div
          style={{
            padding: 12,
            background: "#e6ffed",
            border: "1px solid #34c759",
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <strong>Password updated.</strong> You can now{" "}
          <Link href="/login">log in</Link>.
        </div>
      ) : null}

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <strong>Update failed:</strong> {error}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
        </label>

        <button
          disabled={busy || success}
          type="submit"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: busy || success ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>Loading…</main>}>
      <ResetPasswordInner />
    </Suspense>
  );
}


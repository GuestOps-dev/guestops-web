"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export default function SmsConsentPage() {
  const [phone, setPhone] = useState("");
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const phoneE164 = normalizePhone(phone);
    if (!phoneE164) {
      setError("Enter a valid mobile phone number.");
      return;
    }
    if (!consented) {
      setError("Please confirm your consent to receive guest-service messages.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: insertError } = await supabase
      .from("sms_opt_in_consents")
      .insert({ phone_e164: phoneE164 });
    setBusy(false);

    if (insertError) {
      setError("We could not record your consent. Please try again.");
      return;
    }
    setSuccess(true);
  }

  return (
    <main style={{ maxWidth: 620, margin: "48px auto", padding: 16, lineHeight: 1.6 }}>
      <h1>Guest SMS Consent</h1>
      <p>
        Majestic Monkeys LLC operates GuestOpsHQ. Guests may opt in to receive
        transactional SMS messages about their reservation and stay.
      </p>

      {success ? (
        <div
          role="status"
          style={{ padding: 16, border: "1px solid #34c759", background: "#e6ffed", borderRadius: 10 }}
        >
          Your SMS consent has been recorded. Message frequency varies by
          reservation activity, typically 1–5 messages per stay.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          {error ? (
            <div role="alert" style={{ padding: 12, border: "1px solid #f99", background: "#fee", borderRadius: 10 }}>
              {error}
            </div>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <span>Mobile phone number</span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 555-5555"
              required
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #bbb" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              style={{ marginTop: 5 }}
            />
            <span>
              I agree to receive transactional SMS messages from Majestic
              Monkeys LLC, operating GuestOpsHQ, about my reservation and
              guest services. Message frequency varies, typically 1–5 messages
              per stay. Message and data rates may apply. Reply STOP to opt out
              or HELP for help. Consent is not a condition of purchase.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: "#111", color: "#fff", cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Recording consent…" : "Agree and continue"}
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link href="/privacy">Privacy Policy</Link>{" · "}
        <Link href="/sms-terms">SMS Terms</Link>
      </p>
    </main>
  );
}

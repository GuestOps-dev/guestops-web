# GuestOpsHQ - Code Index

Generated: 2026-02-24 17:04:20
Commit: c80ba6ee7db7ef15fe85fc1116840d9ae50fe0e2

NOTE: This is a curated snapshot of important code and routes.
Do NOT store secrets here.

========================================

## Key UI Files
- app/dashboard/page.tsx
- app/dashboard/InboxClient.tsx
- app/dashboard/conversations/[id]/page.tsx

========================================
## API Routes (App Router)

app/api:
- app\api\conversations\[id]\read\route.ts
- app\api\conversations\route.ts
- app\api\messages\send\route.ts
- app\api\properties\route.ts
- app\api\twilio\inbound\route.ts
- app\api\twilio\status\route.ts

src/app/api:
- src\app\api\me\memberships\route.ts

========================================
## Critical Files (FULL CONTENT)

These are included in full to let a new chat patch safely without uploading the repo.


----- FILE: app/api/conversations/route.ts -----
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

type StatusFilter = "open" | "closed" | "all";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "open") as StatusFilter;
  const propertyId = url.searchParams.get("propertyId"); // optional

  // 1) Prefer Bearer auth (API-style)
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  let supabase: any = null;

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase: sb, user, error } = await requireApiAuth(req);
    if (error || !user) {
      return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
    }
    supabase = sb;
  } else {
    // 2) Fallback: cookie session (dashboard-style)
    // Still RLS-bound. No service role.
    supabase = await getSupabaseRlsServerClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Build query (RLS is the truth; optional filters narrow further)
  let q = supabase
    .from("conversations")
    .select(
      "id, property_id, guest_number, service_number, channel, provider, status, priority, assigned_to, updated_at, last_message_at, last_inbound_at, last_outbound_at, last_read_at"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (propertyId) q = q.eq("property_id", propertyId);

  // Be permissive: donâ€™t accidentally filter everything due to status mismatches
  if (status === "open") {
    // Your DB says status=open exists, so we honor it.
    q = q.eq("status", "open");
  } else if (status === "closed") {
    q = q.eq("status", "closed");
  } else {
    // "all" => no status filter
  }

  const { data, error } = await q;

  if (error) {
    // IMPORTANT: Return 500 with details so we don't get silent 400s
    return NextResponse.json(
      { error: error.message, hint: (error as any).hint ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
----- END FILE: app/api/conversations/route.ts -----

----- FILE: app/api/messages/send/route.ts -----
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requireApiAuth } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

function requireNonEmptyString(v: unknown, field: string) {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

function requireUuid(v: unknown, field: string) {
  const s = requireNonEmptyString(v, field);
  if (!s) return null;
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  return ok ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireApiAuth(req);

    const idempotencyKey =
      req.headers.get("x-idempotency-key")?.trim() || null;

    const json = await req.json().catch(() => null);

    const conversationId = requireUuid(json?.conversation_id, "conversation_id");
    const propertyId = requireUuid(json?.property_id, "property_id");
    const body = requireNonEmptyString(json?.body, "body");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing/invalid conversation_id" },
        { status: 400 }
      );
    }
    if (!propertyId) {
      return NextResponse.json(
        { error: "Missing/invalid property_id" },
        { status: 400 }
      );
    }
    if (!body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;

    // Cast supabase to any for table typing issues (we'll fix Database typing later)
    const sb: any = supabase as any;

    const { data: convo, error: convoErr } = await sb
      .from("conversations")
      .select(
        "id, property_id, guest_number, service_number, from_e164, to_e164"
      )
      .eq("id", conversationId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (convoErr) {
      console.error("Conversation lookup error:", convoErr);
      return NextResponse.json({ error: "Query failed" }, { status: 400 });
    }
    if (!convo) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const c: any = convo;
    const toE164 = c.guest_number ?? c.from_e164; // guest
    const fromE164 = c.service_number ?? c.to_e164; // your Twilio #

    if (!toE164 || !fromE164) {
      return NextResponse.json(
        { error: "Conversation missing routing numbers" },
        { status: 400 }
      );
    }

    const insertRes = await sb
      .from("outbound_messages")
      .insert({
        conversation_id: conversationId,
        to_e164: toE164,
        from_e164: fromE164,
        body,
        status: "queued",
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (insertRes.error) {
      if (idempotencyKey) {
        const existing = await sb
          .from("outbound_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing.data) {
          return NextResponse.json({ ok: true, outbound: existing.data });
        }
      }

      console.error("Outbound insert error:", insertRes.error);
      return NextResponse.json(
        { error: insertRes.error.message },
        { status: 500 }
      );
    }

    const outboundId = insertRes.data.id;

    try {
      const msg = await client.messages.create({
        to: toE164,
        from: fromE164,
        body,
        statusCallback: `${origin}/api/twilio/status`,
      });

      const updated = await sb
        .from("outbound_messages")
        .update({
          status: "queued",
          twilio_message_sid: msg.sid,
        })
        .eq("id", outboundId)
        .select("*")
        .single();

      const now = new Date().toISOString();
      await sb
        .from("conversations")
        .update({
          updated_at: now,
          last_message_at: now,
          last_outbound_at: now,
          from_e164: toE164,
          to_e164: fromE164,
        })
        .eq("id", conversationId)
        .eq("property_id", propertyId);

      return NextResponse.json({
        ok: true,
        outbound: updated.data ?? null,
      });
    } catch (e: any) {
      const errorText = e?.message || "Twilio send failed";

      await sb
        .from("outbound_messages")
        .update({ status: "failed", error: errorText })
        .eq("id", outboundId);

      return NextResponse.json({ ok: false, error: errorText }, { status: 502 });
    }
  } catch (err: any) {
    const msg = err?.message === "Unauthorized" ? "Unauthorized" : "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
----- END FILE: app/api/messages/send/route.ts -----

----- FILE: src/app/api/me/memberships/route.ts -----
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

/**
 * GET /api/me/memberships
 * Bearer-token authenticated. RLS enforced.
 */
export async function GET(req: Request) {
  const { supabase, user, error } = await requireApiAuth(req);

  if (error || !user) {
    return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error: rpcError } = await supabase.rpc("my_property_memberships");

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ memberships: data ?? [] }, { status: 200 });
}
----- END FILE: src/app/api/me/memberships/route.ts -----

----- FILE: src/lib/api/requireApiAuth.ts -----
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type RequireApiAuthResult = {
  supabase: SupabaseClient;
  user: User | null;
  accessToken: string | null;
  error: string | null;
};

/**
 * Bearer-token auth for API routes.
 *
 * - Reads Authorization: Bearer <access_token>
 * - Creates a Supabase client bound to that JWT so RLS enforces property isolation
 * - Validates token via supabase.auth.getUser()
 *
 * NOTE:
 * - Uses ANON key (NOT service role) to preserve RLS.
 * - Service role is for webhooks only (elsewhere).
 */
export async function requireApiAuth(req: Request): Promise<RequireApiAuthResult> {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  const token = parseBearerToken(authHeader);
  if (!token) {
    return {
      supabase: makeRlsClient(null),
      user: null,
      accessToken: null,
      error: "Missing or invalid Authorization header",
    };
  }

  const supabase = makeRlsClient(token);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      supabase,
      user: null,
      accessToken: token,
      error: error?.message ?? "Unauthorized",
    };
  }

  return {
    supabase,
    user: data.user,
    accessToken: token,
    error: null,
  };
}

function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function makeRlsClient(accessToken: string | null): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  if (!url || !anonKey) {
    // Throwing here makes build-time failures obvious in logs if env is misconfigured.
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY)"
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}
----- END FILE: src/lib/api/requireApiAuth.ts -----

----- FILE: src/lib/supabase/getSupabaseRlsServerClient.ts -----
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-session, RLS-bound Supabase client for Server Components / Route Handlers.
 * Uses the logged-in user's session (no service role).
 */
export async function getSupabaseRlsServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY)"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}
----- END FILE: src/lib/supabase/getSupabaseRlsServerClient.ts -----

----- FILE: src/lib/supabaseServer.ts -----
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * RLS-bound server client for Server Components.
 * IMPORTANT: In Server Components, cookies are effectively read-only.
 * So set/remove must be no-ops to avoid runtime issues.
 */
export async function getSupabaseRlsServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      // no-ops in Server Components (prevents Next 16 cookie write errors)
      set() {},
      remove() {},
    },
  });
}

/**
 * Service role client (bypasses RLS).
 * ONLY for trusted server-to-server operations (Twilio webhooks, cron/jobs).
 */
let _service: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (_service) return _service;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  _service = createClient(url, secret, { auth: { persistSession: false } });
  return _service;
}

/**
 * Backwards-compatible export:
 * Return RLS-bound client (safe for dashboard/server pages).
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  return getSupabaseRlsServerClient();
}

// Backwards-compatible alias
export async function supabaseServer(): Promise<SupabaseClient> {
  return getSupabaseRlsServerClient();
}
----- END FILE: src/lib/supabaseServer.ts -----

----- FILE: src/lib/supabaseBrowser.ts -----
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  browserClient = createBrowserClient(url, anon);
  return browserClient;
}

// Backwards-compatible alias (if older code uses it)
export function supabaseBrowser(): SupabaseClient {
  return getSupabaseBrowserClient();
}
----- END FILE: src/lib/supabaseBrowser.ts -----

----- FILE: app/dashboard/page.tsx -----
import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PropertyWorkspaceProvider } from "./PropertyWorkspaceProvider";

export default async function DashboardPage() {
  const sb = await getSupabaseServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await (sb as any).rpc(
    "my_property_memberships"
  );

  const propertyOptions =
    (memberships ?? []).map((m: any) => ({
      id: m.property_id,
      name: m.property_name,
    })) ?? [];

  const allowedPropertyIds = propertyOptions.map((p: any) => p.id);

  return (
    <PropertyWorkspaceProvider
      allowedPropertyIds={allowedPropertyIds}
      propertyOptions={propertyOptions}
    >
      <InboxClient />
    </PropertyWorkspaceProvider>
  );
}
----- END FILE: app/dashboard/page.tsx -----

----- FILE: app/dashboard/InboxClient.tsx -----
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePropertyWorkspace } from "./PropertyWorkspaceProvider";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ConversationRow = {
  id: string;
  property_id: string;

  guest_number: string;
  service_number: string | null;

  channel: string;
  provider: string;

  status: string | null;
  priority: string | null;
  assigned_to: string | null;

  updated_at: string;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_read_at: string | null;
};

type StatusFilter = "open" | "closed" | "all";

function isUnread(c: ConversationRow) {
  if (!c.last_inbound_at) return false;
  if (!c.last_read_at) return true;
  return new Date(c.last_inbound_at).getTime() > new Date(c.last_read_at).getTime();
}

function sortByUpdatedDesc(a: ConversationRow, b: ConversationRow) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export default function InboxClient() {
  const {
    selectedPropertyId,
    setSelectedPropertyId,
    allowedPropertyIds,
    propertyOptions,
  } = usePropertyWorkspace();

  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [rawCount, setRawCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const sb = useMemo(() => getSupabaseBrowserClient(), []);
  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of propertyOptions) map.set(p.id, p.name);
    return map;
  }, [propertyOptions]);

  async function getAccessToken(): Promise<string> {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("No Supabase session");
    return data.session.access_token;
  }

  async function refetch() {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);

      if (selectedPropertyId !== "all") {
        params.set("propertyId", selectedPropertyId);
      }

      const res = await fetch(`/api/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Failed to load conversations: ${res.status} ${text}`);
      }

      const data = (text ? JSON.parse(text) : []) as ConversationRow[];
      setRawCount(Array.isArray(data) ? data.length : 0);

      // IMPORTANT:
      // Only apply allowedPropertyIds filtering if we actually have memberships.
      // If allowedPropertyIds is empty, do NOT drop everything â€” show what RLS returns.
      const filtered =
        allowedPropertyIds.length > 0
          ? (data ?? []).filter((c) => allowedPropertyIds.includes(c.property_id))
          : (data ?? []);

      setRows([...filtered].sort(sortByUpdatedDesc));
    } catch (e: any) {
      console.error("Inbox refetch error:", e);
      setError(e?.message ?? "Failed to load conversations");
      setRows([]);
      setRawCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedPropertyId, allowedPropertyIds.join(",")]);

  function displayPropertyName(propertyId: string) {
    return propertyNameById.get(propertyId) ?? propertyId;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, opacity: 0.75 }}>
          {loading ? "Refreshingâ€¦" : `${rows.length} threads â€¢ ${unreadCount} unread`}
          <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.65 }}>
            (debug: allowed={allowedPropertyIds.length}, selected={selectedPropertyId}, apiRows={rawCount})
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>

          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 240,
            }}
          >
            <option value="all">All properties</option>
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fafafa",
            color: "#555",
            fontSize: 13,
          }}
        >
          No conversations visible for your assigned properties.
        </div>
      ) : null}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
            gap: 12,
            padding: 12,
            background: "#fafafa",
            fontWeight: 600,
          }}
        >
          <div>Guest</div>
          <div>Twilio #</div>
          <div>Property</div>
          <div>Last Message</div>
          <div>Status</div>
          <div>Open</div>
        </div>

        {rows.map((c) => {
          const unread = isUnread(c);

          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 2fr 2fr 1.2fr 1fr 1fr",
                gap: 12,
                padding: 12,
                borderTop: "1px solid #eee",
                background: unread ? "#fffdf3" : "white",
              }}
            >
              <div style={{ fontWeight: unread ? 700 : 500 }}>
                {unread ? "â— " : ""}
                {c.guest_number}
              </div>
              <div>
                <code>{c.service_number ?? "-"}</code>
              </div>
              <div>
                <code>{displayPropertyName(c.property_id)}</code>
              </div>
              <div>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "-"}</div>
              <div>{c.status ?? "-"}</div>
              <div>
                <Link href={`/dashboard/conversations/${c.id}`}>Open</Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
----- END FILE: app/dashboard/InboxClient.tsx -----

----- FILE: app/dashboard/conversations/[id]/page.tsx -----
Missing: app/dashboard/conversations/[id]/page.tsx

========================================
## Additional Helpers (HEAD ONLY)


----- FILE: src/lib/supabaseApiAuth.ts -----
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type ApiAuthContext = {
  token: string;
  supabase: any;
  userId: string;
  role?: string | null;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getBearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new Error("Unauthorized");
  return token;
}

/**
 * Canonical: Bearer token -> RLS-bound Supabase client
 */
export async function requireApiAuth(req: NextRequest): Promise<ApiAuthContext> {
  const token = getBearerToken(req);

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Bind JWT to all PostgREST calls. RLS evaluates as this user.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  }) as any;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    token,
    supabase,
    userId: data.user.id,
    role: (profile as any)?.role ?? null,
  };
}

/* =========================================================
   Legacy compatibility exports (do not remove yet)
   ========================================================= */

export async function requireSupabaseUser(req: NextRequest) {
  const { supabase, userId, role, token } = await requireApiAuth(req);
  return { supabase, user: { id: userId }, role, token };
}

export function requirePropertyId(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) {
    const err: any = new Error("Missing property_id");
    err.status = 400;
    throw err;
  }
  const s = v.trim();
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  if (!ok) {
    const err: any = new Error("Invalid property_id");
    err.status = 400;
    throw err;
  }
  return s;
}

export async function assertCanAccessProperty(supabase: any, propertyId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !data) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}
----- END FILE: src/lib/supabaseApiAuth.ts -----

----- FILE: src/lib/access/getMyMemberships.ts -----
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";

export type MyPropertyMembership = {
  org_id: string;
  property_id: string;
  property_name: string;
  org_role: "org_owner" | "org_admin" | "org_staff" | null;
  property_role: "property_manager" | "concierge" | "ops" | "viewer";
};

export async function getMyMemberships(): Promise<MyPropertyMembership[]> {
  const supabase = await getSupabaseRlsServerClient();

  const { data, error } = await supabase.rpc("my_property_memberships");
  if (error) throw new Error(`Failed to load memberships: ${error.message}`);

  return (data ?? []) as MyPropertyMembership[];
}
----- END FILE: src/lib/access/getMyMemberships.ts -----

----- FILE: src/lib/access/fetchMembershipsClient.ts -----
export type MyPropertyMembership = {
  org_id: string;
  property_id: string;
  property_name: string;
  org_role: "org_owner" | "org_admin" | "org_staff" | null;
  property_role: "property_manager" | "concierge" | "ops" | "viewer";
};

export async function fetchMembershipsClient(accessToken: string) {
  const res = await fetch("/api/me/memberships", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch memberships: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { memberships: MyPropertyMembership[] };
  return json.memberships ?? [];
}
----- END FILE: src/lib/access/fetchMembershipsClient.ts -----

----- FILE: src/lib/access/validateSelectedProperty.ts -----
export function validateSelectedProperty(
  selected: string | null,
  allowedPropertyIds: string[]
) {
  if (!selected || selected === "all") return "all";
  return allowedPropertyIds.includes(selected) ? selected : "all";
}
----- END FILE: src/lib/access/validateSelectedProperty.ts -----

========================================
## Env var names referenced (best effort)

- HANDOFF_VIEW_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN

========================================
End of Code Index

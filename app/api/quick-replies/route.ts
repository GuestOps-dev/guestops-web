import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import {
  assertCanAccessProperty,
  requirePropertyId,
} from "@/lib/supabaseApiAuth";

async function getSupabaseFromReq(req: Request) {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req as any);
    if (!error && user) {
      return { supabase, user };
    }
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase: null, user: null, error: "Unauthorized" };
  }
  return { supabase, user: data.user };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let pid: string;
  try {
    pid = requirePropertyId(propertyId);
    await assertCanAccessProperty(auth.supabase, pid);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json(
      { error: e?.message ?? "Invalid or missing property_id" },
      { status }
    );
  }

  let q = (auth.supabase as any)
    .from("quick_replies")
    .select("id, property_id, title, body, is_active, created_at, updated_at")
    .eq("property_id", pid)
    .order("title", { ascending: true })
    .order("created_at", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;

  if (error) {
    console.error("Quick replies list error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      {
        error: (error as any).message ?? "Failed to load quick replies",
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: code }
    );
  }

  return NextResponse.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    property_id?: string;
    title?: string;
    body?: string;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let pid: string;
  try {
    pid = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase, pid);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json(
      { error: e?.message ?? "Invalid or missing property_id" },
      { status }
    );
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const bodyText = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !bodyText) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  const is_active =
    typeof body?.is_active === "boolean" ? body.is_active : true;

  const { data, error } = await (auth.supabase as any)
    .from("quick_replies")
    .insert({
      property_id: pid,
      title,
      body: bodyText,
      category: null,
      is_active,
      created_by: auth.user.id,
    })
    .select("id, property_id, title, body, is_active, created_at, updated_at")
    .single();

  if (error) {
    console.error("Quick reply create error:", error);
    const code = (error as any).code === "42501" ? 403 : 500;
    return NextResponse.json(
      {
        error: (error as any).message ?? "Failed to create quick reply",
        code: (error as any).code ?? null,
        hint: (error as any).hint ?? null,
      },
      { status: code }
    );
  }

  return NextResponse.json(data, { status: 201 });
}

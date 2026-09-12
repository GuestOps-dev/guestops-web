import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

type TaskPayload = {
  property_id?: unknown;
  conversation_id?: unknown;
  guest_id?: unknown;
  booking_id?: unknown;
  title?: unknown;
  due_at?: unknown;
  assigned_to_user_id?: unknown;
};

async function getSupabaseFromReq(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!error && user) return { supabase, user, error: null };
  }

  const supabase = await getSupabaseRlsServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase: null, user: null, error: "Unauthorized" };
  return { supabase, user: data.user, error: null };
}

function optionalUuid(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : undefined;
}

function optionalIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

const TASK_COLUMNS = "id, property_id, conversation_id, guest_id, booking_id, title, status, due_at, assigned_to_user_id, created_by_user_id, created_at, completed_at";

export async function GET(req: Request) {
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let propertyId: string;
  try {
    propertyId = requirePropertyId(url.searchParams.get("propertyId"));
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Invalid property" }, { status: error?.status ?? 400 });
  }

  let query = (auth.supabase as any)
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("property_id", propertyId)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const conversationId = optionalUuid(url.searchParams.get("conversationId"));
  if (conversationId === undefined) return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  if (conversationId) query = query.eq("conversation_id", conversationId);

  const { data, error } = await query;
  if (error) {
    console.error("Task list error:", error);
    return NextResponse.json({ error: "Unable to load tasks" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  let body: TaskPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let propertyId: string;
  try {
    propertyId = requirePropertyId(body.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Invalid property" }, { status: error?.status ?? 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const conversationId = optionalUuid(body.conversation_id);
  const guestId = optionalUuid(body.guest_id);
  const bookingId = optionalUuid(body.booking_id);
  const dueAt = optionalIsoDate(body.due_at);
  const assignedTo = optionalUuid(body.assigned_to_user_id);
  if (!title || title.length > 280) return NextResponse.json({ error: "Task title must be between 1 and 280 characters" }, { status: 400 });
  if ([conversationId, guestId, bookingId, dueAt, assignedTo].some((value) => value === undefined)) {
    return NextResponse.json({ error: "Invalid task details" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase as any)
    .from("tasks")
    .insert({
      property_id: propertyId,
      conversation_id: conversationId,
      guest_id: guestId,
      booking_id: bookingId,
      title,
      due_at: dueAt,
      assigned_to_user_id: assignedTo,
      created_by_user_id: auth.user.id,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    console.error("Task create error:", error);
    return NextResponse.json({ error: "Unable to create task" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

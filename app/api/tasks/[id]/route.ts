import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty } from "@/lib/supabaseApiAuth";

type TaskUpdate = { property_id?: unknown; title?: unknown; status?: unknown; due_at?: unknown };
const TASK_COLUMNS = "id, property_id, conversation_id, guest_id, booking_id, title, status, due_at, assigned_to_user_id, created_by_user_id, created_at, completed_at";

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

function optionalIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

  const auth = await getSupabaseFromReq(req);
  if (!auth.supabase || !auth.user) return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });

  let body: TaskUpdate;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.property_id !== "string") return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  try {
    await assertCanAccessProperty(auth.supabase, body.property_id);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Invalid property" }, { status: error?.status ?? 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 280) return NextResponse.json({ error: "Task title must be between 1 and 280 characters" }, { status: 400 });
    updates.title = title;
  }
  if (body.status !== undefined) {
    if (body.status !== "open" && body.status !== "completed") return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
    updates.status = body.status;
    updates.completed_at = body.status === "completed" ? new Date().toISOString() : null;
  }
  if (body.due_at !== undefined) {
    const dueAt = optionalIsoDate(body.due_at);
    if (dueAt === undefined) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    updates.due_at = dueAt;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid task fields to update" }, { status: 400 });

  const { data, error } = await (auth.supabase as any)
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("property_id", body.property_id)
    .select(TASK_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("Task update error:", error);
    return NextResponse.json({ error: "Unable to update task" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(data);
}

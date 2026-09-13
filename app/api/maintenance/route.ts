import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

export const runtime = "nodejs";

const COLUMNS = "id, property_id, conversation_id, guest_id, booking_id, source_message_id, title, description, category, priority, status, recurrence_key, occurrence_count, first_reported_at, last_reported_at, resolved_at, created_at";
const CATEGORIES = new Set(["hvac", "plumbing", "electrical", "appliance", "lock_access", "damage", "pest", "cleaning", "safety", "general"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function uuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()) ? value.trim() : null; }

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const propertyId = requirePropertyId(req.nextUrl.searchParams.get("property_id"));
    await assertCanAccessProperty(auth.supabase, propertyId);
    const { data, error } = await (auth.supabase as any).from("maintenance_issues").select(COLUMNS).eq("property_id", propertyId).order("status").order("last_reported_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to load maintenance issues" }, { status: error?.status ?? 400 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
    const title = clean(body?.title, 280); if (!title) return NextResponse.json({ error: "An issue title is required" }, { status: 400 });
    const category = clean(body?.category, 40) || "general"; if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Invalid maintenance category" }, { status: 400 });
    const priority = clean(body?.priority, 20) || "normal"; if (!PRIORITIES.has(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    const recurrenceKey = clean(body?.recurrence_key, 160).toLocaleLowerCase() || null;
    const sb = auth.supabase as any;
    if (recurrenceKey) {
      const { data: existing } = await sb.from("maintenance_issues").select(COLUMNS).eq("property_id", propertyId).eq("recurrence_key", recurrenceKey).in("status", ["open", "in_progress"]).maybeSingle();
      if (existing) {
        const { data, error } = await sb.from("maintenance_issues").update({ occurrence_count: existing.occurrence_count + 1, last_reported_at: new Date().toISOString(), description: clean(body?.description, 6000) || existing.description, priority: priority === "normal" ? existing.priority : priority, updated_at: new Date().toISOString() }).eq("id", existing.id).select(COLUMNS).single();
        if (error) throw error;
        return NextResponse.json({ issue: data, recurring: true }, { status: 200 });
      }
    }
    const { data, error } = await sb.from("maintenance_issues").insert({ property_id: propertyId, conversation_id: uuid(body?.conversation_id), guest_id: uuid(body?.guest_id), booking_id: uuid(body?.booking_id), source_message_id: uuid(body?.source_message_id), title, description: clean(body?.description, 6000) || null, category, priority, status: "open", recurrence_key: recurrenceKey, created_by_user_id: auth.user.id }).select(COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ issue: data, recurring: false }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to save maintenance issue" }, { status: error?.status ?? 400 }); }
}

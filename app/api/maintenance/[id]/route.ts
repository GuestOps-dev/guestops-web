import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

const COLUMNS = "id, property_id, conversation_id, guest_id, booking_id, source_message_id, title, description, category, priority, status, recurrence_key, occurrence_count, first_reported_at, last_reported_at, resolved_at, created_at";
const STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(req);
  if (!auth.supabase || !auth.user || auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params; const body = await req.json(); const propertyId = requirePropertyId(body?.property_id);
    await assertCanAccessProperty(auth.supabase, propertyId);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.status === "string") { if (!STATUSES.has(body.status)) return NextResponse.json({ error: "Invalid maintenance status" }, { status: 400 }); updates.status = body.status; updates.resolved_at = ["resolved", "closed"].includes(body.status) ? new Date().toISOString() : null; }
    if (typeof body?.priority === "string" && ["low", "normal", "high", "urgent"].includes(body.priority)) updates.priority = body.priority;
    if (typeof body?.title === "string" && body.title.trim()) updates.title = body.title.trim().slice(0, 280);
    if (typeof body?.description === "string") updates.description = body.description.trim().slice(0, 6000) || null;
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    const { data, error } = await (auth.supabase as any).from("maintenance_issues").update(updates).eq("id", id).eq("property_id", propertyId).select(COLUMNS).maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ error: "Maintenance issue not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to update maintenance issue" }, { status: error?.status ?? 400 }); }
}

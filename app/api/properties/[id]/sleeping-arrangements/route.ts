import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseRlsServerClient } from "@/lib/supabase/getSupabaseRlsServerClient";
import { assertCanAccessProperty, requirePropertyId } from "@/lib/supabaseApiAuth";

function clean(value: unknown, limit: number) { return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""; }
function positiveInteger(value: unknown, max: number) { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= max ? n : null; }

async function client(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    try { const auth = await requireApiAuth(req); return { supabase: auth.supabase, user: auth.user }; } catch { /* fall through */ }
  }
  const supabase = await getSupabaseRlsServerClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

async function access(req: NextRequest, rawId: string) {
  const auth = await client(req);
  if (!auth.user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const propertyId = requirePropertyId(rawId);
  await assertCanAccessProperty(auth.supabase, propertyId);
  return { sb: auth.supabase as any, propertyId };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const { sb, propertyId } = await access(req, id);
    const { data: rooms, error: roomsError } = await sb.from("property_rooms").select("id, name, room_type, notes, sort_order").eq("property_id", propertyId).order("sort_order").order("created_at");
    if (roomsError) throw roomsError;
    const roomIds = (rooms ?? []).map((room: any) => room.id);
    const { data: beds, error: bedsError } = roomIds.length ? await sb.from("property_beds").select("id, room_id, bed_type, quantity, sleeps, notes").in("room_id", roomIds).order("created_at") : { data: [], error: null };
    if (bedsError) throw bedsError;
    return NextResponse.json({ rooms: (rooms ?? []).map((room: any) => ({ ...room, beds: (beds ?? []).filter((bed: any) => bed.room_id === room.id) })) });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to load sleeping arrangements" }, { status: error?.status ?? 500 }); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const { sb, propertyId } = await access(req, id); const body = await req.json();
    if (body.action === "room") {
      const name = clean(body.name, 120); const roomType = clean(body.room_type, 30) || "bedroom";
      if (!name || !["bedroom", "loft", "living_area", "other"].includes(roomType)) return NextResponse.json({ error: "Enter a room name and valid room type." }, { status: 400 });
      const { count } = await sb.from("property_rooms").select("id", { count: "exact", head: true }).eq("property_id", propertyId);
      const { data, error } = await sb.from("property_rooms").insert({ property_id: propertyId, name, room_type: roomType, notes: clean(body.notes, 1000) || null, sort_order: count ?? 0 }).select("id, name, room_type, notes, sort_order").single();
      if (error) throw error; return NextResponse.json(data, { status: 201 });
    }
    if (body.action === "bed") {
      const roomId = clean(body.room_id, 80); const bedType = clean(body.bed_type, 30); const quantity = positiveInteger(body.quantity, 12); const sleeps = positiveInteger(body.sleeps, 24);
      if (!roomId || !["king", "queen", "full", "twin", "bunk", "sofa_bed", "other"].includes(bedType) || !quantity || !sleeps) return NextResponse.json({ error: "Enter valid bed details." }, { status: 400 });
      const { data: room } = await sb.from("property_rooms").select("id").eq("id", roomId).eq("property_id", propertyId).maybeSingle();
      if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      const { data, error } = await sb.from("property_beds").insert({ room_id: roomId, bed_type: bedType, quantity, sleeps, notes: clean(body.notes, 500) || null }).select("id, room_id, bed_type, quantity, sleeps, notes").single();
      if (error) throw error; return NextResponse.json(data, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to save sleeping arrangement" }, { status: error?.status ?? 500 }); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const { sb, propertyId } = await access(req, id); const body = await req.json(); const entityId = clean(body.entity_id, 80);
    if (!entityId || !["room", "bed"].includes(body.entity)) return NextResponse.json({ error: "Invalid item." }, { status: 400 });
    if (body.entity === "room") { const { error } = await sb.from("property_rooms").delete().eq("id", entityId).eq("property_id", propertyId); if (error) throw error; }
    else { const { data: bed } = await sb.from("property_beds").select("id, property_rooms!inner(property_id)").eq("id", entityId).maybeSingle(); if (!bed || (bed as any).property_rooms.property_id !== propertyId) return NextResponse.json({ error: "Bed not found." }, { status: 404 }); const { error } = await sb.from("property_beds").delete().eq("id", entityId); if (error) throw error; }
    return NextResponse.json({ deleted: true });
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? "Unable to remove item" }, { status: error?.status ?? 500 }); }
}

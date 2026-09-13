import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const orgRoles = ["org_owner", "org_admin", "org_staff"] as const;
const propertyRoles = ["property_manager", "concierge", "ops", "viewer"] as const;

type OrgRole = (typeof orgRoles)[number];
type PropertyRole = (typeof propertyRoles)[number];

function validUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function teamContext(supabase: any, propertyId: string) {
  const { data, error } = await supabase.rpc("my_property_memberships");
  if (error) throw new Error("Unable to check workspace access.");
  const selected = (data ?? []).find((item: any) => item.property_id === propertyId);
  if (!selected?.org_id) {
    const unavailable = new Error("That property is not available to this account.");
    Object.assign(unavailable, { status: 403 });
    throw unavailable;
  }
  if (selected.org_role !== "org_owner" && selected.org_role !== "org_admin") {
    const forbidden = new Error("Only an organization owner or admin can manage the team.");
    Object.assign(forbidden, { status: 403 });
    throw forbidden;
  }
  const properties = Array.from(new Map((data ?? [])
    .filter((item: any) => item.org_id === selected.org_id)
    .map((item: any) => [item.property_id, { id: item.property_id, name: item.property_name }]))
    .values());
  return { orgId: selected.org_id as string, properties };
}

export async function GET(req: Request) {
  try {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!supabase || !user || error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const propertyId = new URL(req.url).searchParams.get("property_id");
    if (!validUuid(propertyId)) return NextResponse.json({ error: "Choose a property first." }, { status: 400 });
    const { orgId, properties } = await teamContext(supabase, propertyId as string);
    const service = getSupabaseServiceClient() as any;
    const propertyIds = properties.map((property: any) => property.id);
    const [{ data: members, error: memberError }, { data: assignments, error: assignmentError }] = await Promise.all([
      service.from("org_users").select("user_id, org_role, created_at, profiles:user_id(id, full_name)").eq("org_id", orgId).order("created_at"),
      propertyIds.length ? service.from("property_users").select("property_id, profile_id, property_role").in("property_id", propertyIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (memberError || assignmentError) throw new Error("Unable to load the team.");
    const memberRows = (members ?? []).map((member: any) => ({
      user_id: member.user_id,
      full_name: member.profiles?.full_name ?? null,
      org_role: member.org_role,
      created_at: member.created_at,
      assignments: (assignments ?? []).filter((assignment: any) => assignment.profile_id === member.user_id).map((assignment: any) => ({
        property_id: assignment.property_id,
        property_role: assignment.property_role,
      })),
    }));
    return NextResponse.json({ properties, members: memberRows });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status === 500) console.error("GET /api/team error:", err);
    return NextResponse.json({ error: status === 500 ? "Unable to load the team." : err?.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, error } = await requireApiAuth(req);
    if (!supabase || !user || error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const propertyId = body?.property_id;
    const email = text(body?.email, 254).toLowerCase();
    const fullName = text(body?.full_name, 120);
    const orgRole = body?.org_role as OrgRole;
    const propertyRole = body?.property_role as PropertyRole;
    if (!validUuid(propertyId) || !/^\S+@\S+\.\S+$/.test(email) || !orgRoles.includes(orgRole) || !propertyRoles.includes(propertyRole)) {
      return NextResponse.json({ error: "Enter a valid email, organization role, and property role." }, { status: 400 });
    }
    if (orgRole === "org_owner") return NextResponse.json({ error: "Ownership changes are handled separately for safety." }, { status: 400 });
    const { orgId } = await teamContext(supabase, propertyId);
    const service = getSupabaseServiceClient() as any;
    const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: `${new URL(req.url).origin}/login`,
    });
    if (inviteError || !invitation?.user?.id) {
      return NextResponse.json({ error: inviteError?.message ?? "Unable to send the invitation." }, { status: 400 });
    }
    const invitedUserId = invitation.user.id;
    const { error: profileError } = await service.from("profiles").upsert({ id: invitedUserId, full_name: fullName || null }, { onConflict: "id" });
    if (profileError) throw new Error("The invitation was sent, but the team profile could not be prepared.");
    const { error: orgError } = await service.from("org_users").upsert({ org_id: orgId, user_id: invitedUserId, org_role: orgRole }, { onConflict: "org_id,user_id" });
    if (orgError) throw new Error("The invitation was sent, but organization access could not be saved.");
    const { error: assignmentError } = await service.from("property_users").upsert({ property_id: propertyId, profile_id: invitedUserId, property_role: propertyRole }, { onConflict: "property_id,profile_id" });
    if (assignmentError) throw new Error("The invitation was sent, but property access could not be saved.");
    return NextResponse.json({ invited: true }, { status: 201 });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status === 500) console.error("POST /api/team error:", err);
    return NextResponse.json({ error: status === 500 ? "Unable to invite the team member." : err?.message }, { status });
  }
}

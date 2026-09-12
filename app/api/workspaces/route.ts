import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export const runtime = "nodejs";

function workspaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 && name.length <= 120 ? name : null;
}

/**
 * The customer-facing boundary for SaaS workspaces. A workspace maps 1:1 to
 * an organization; houses and all guest data stay underneath that boundary.
 */
export async function GET(req: NextRequest) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user || error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error: queryError } = await (supabase as any)
    .from("org_users")
    .select("org_id, org_role, orgs:org_id(id, name, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (queryError) {
    console.error("GET /api/workspaces error:", queryError);
    return NextResponse.json({ error: "Unable to load workspaces" }, { status: 500 });
  }

  const workspaces = (data ?? [])
    .map((row: any) => ({
      id: row.orgs?.id ?? row.org_id,
      name: row.orgs?.name ?? "Workspace",
      role: row.org_role,
      created_at: row.orgs?.created_at ?? null,
    }))
    .filter((workspace: any) => typeof workspace.id === "string");

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const { supabase, user, error } = await requireApiAuth(req);
  if (!supabase || !user || error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = workspaceName(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Workspace name must be between 2 and 120 characters" },
      { status: 400 }
    );
  }

  const { data, error: createError } = await (supabase as any)
    .rpc("create_customer_workspace", { _name: name });

  if (createError) {
    console.error("POST /api/workspaces error:", createError);
    return NextResponse.json({ error: "Unable to create workspace" }, { status: 500 });
  }

  const workspace = Array.isArray(data) ? data[0] : data;
  if (!workspace?.org_id) {
    return NextResponse.json({ error: "Workspace was not created" }, { status: 500 });
  }

  return NextResponse.json(
    { workspace: { id: workspace.org_id, name: workspace.org_name, role: "org_owner" } },
    { status: 201 }
  );
}

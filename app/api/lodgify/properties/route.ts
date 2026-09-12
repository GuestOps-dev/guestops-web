import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/requireApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LodgifyProperty = { id?: unknown; name?: unknown };

/**
 * This intentionally exposes only a rental's Lodgify ID and name to signed-in
 * staff. The private API key and the wider Lodgify response stay server-side.
 */
export async function GET(req: Request) {
  const { user, error } = await requireApiAuth(req);
  if (!user) return NextResponse.json({ error: error ?? "Unauthorized" }, { status: 401 });

  const apiKey = process.env.LODGIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Lodgify has not been connected yet." },
      { status: 503 }
    );
  }

  try {
    const response = await fetch("https://api.lodgify.com/v1/properties", {
      headers: { "X-ApiKey": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Lodgify property list failed:", response.status);
      return NextResponse.json({ error: "Unable to reach Lodgify right now." }, { status: 502 });
    }

    const payload = (await response.json()) as LodgifyProperty[];
    const properties = Array.isArray(payload)
      ? payload
          .map((property) => ({
            id: typeof property.id === "number" ? property.id : Number(property.id),
            name: typeof property.name === "string" ? property.name.trim() : "",
          }))
          .filter((property) => Number.isSafeInteger(property.id) && property.id > 0 && property.name)
      : [];

    return NextResponse.json({ properties }, { status: 200 });
  } catch (err) {
    console.error("Lodgify property list error:", err);
    return NextResponse.json({ error: "Unable to reach Lodgify right now." }, { status: 502 });
  }
}

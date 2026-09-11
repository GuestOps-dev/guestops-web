import { NextResponse } from "next/server";

/**
 * Retired after the dashboard moved to the RLS-bound conversation endpoint.
 * Keeping an explicit response prevents old clients from silently reaching a
 * service-role path.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been retired. Use /api/conversations/:id/outbound." },
    { status: 410 }
  );
}

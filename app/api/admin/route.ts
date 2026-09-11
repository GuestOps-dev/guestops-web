import { NextResponse } from "next/server";

/**
 * Retired: this endpoint exposed an administrative database snapshot behind a
 * URL query secret. Operational diagnostics now stay in authenticated tools.
 */
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been retired." },
    { status: 410 }
  );
}

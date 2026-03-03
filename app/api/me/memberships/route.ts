import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, hit: "memberships route" }, { status: 200 });
}
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const USER = process.env.DASHBOARD_USER;
const PASS = process.env.DASHBOARD_PASS;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect only dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");

  if (!auth) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    });
  }

  const base64 = auth.split(" ")[1];
  const [user, pass] = atob(base64).split(":");

  if (user === USER && pass === PASS) {
    return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
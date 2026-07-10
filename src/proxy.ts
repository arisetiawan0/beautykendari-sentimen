import { NextRequest, NextResponse } from "next/server";

import {
  DASHBOARD_SESSION_COOKIE,
  dashboardAuthConfigured,
  verifyDashboardSession,
} from "@/lib/dashboard-auth";

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const configured = dashboardAuthConfigured();

  if (!configured) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    if (isApi) {
      return Response.json({ error: "Autentikasi dashboard belum dikonfigurasi" }, { status: 503 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("setup", "1");
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifyDashboardSession(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (isApi) return Response.json({ error: "Sesi dashboard berakhir" }, { status: 401 });

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/api/dashboard/:path*", "/api/alerts/:path*"],
};

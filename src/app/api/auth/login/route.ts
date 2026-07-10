import { z } from "zod";

import {
  DASHBOARD_SESSION_COOKIE,
  constantTimeEqual,
  dashboardAuthConfigured,
  dashboardSessionToken,
} from "@/lib/dashboard-auth";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!dashboardAuthConfigured()) {
    return Response.json({ error: "Autentikasi dashboard belum dikonfigurasi" }, { status: 503 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Password wajib diisi" }, { status: 400 });

  const expectedPassword = process.env.DASHBOARD_PASSWORD ?? "";
  if (!constantTimeEqual(parsed.data.password, expectedPassword)) {
    return Response.json({ error: "Password tidak cocok" }, { status: 401 });
  }

  const token = await dashboardSessionToken();
  if (!token) return Response.json({ error: "Konfigurasi sesi tidak lengkap" }, { status: 503 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `${DASHBOARD_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    },
  });
}

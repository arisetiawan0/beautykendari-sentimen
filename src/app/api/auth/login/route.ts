import { z } from "zod";

import {
  DASHBOARD_SESSION_COOKIE,
  createDashboardSession,
  dashboardAuthConfigured,
  sessionMaxAgeSeconds,
} from "@/lib/dashboard-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

type DashboardUser = {
  id: string;
  username: string;
  display_name: string | null;
};

export async function POST(request: Request) {
  if (!dashboardAuthConfigured()) {
    return Response.json({ error: "Autentikasi dashboard belum dikonfigurasi" }, { status: 503 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Username dan password wajib diisi" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("verify_dashboard_user", {
    login_username: parsed.data.username,
    login_password: parsed.data.password,
  });

  if (error) {
    return Response.json({ error: "Autentikasi dashboard gagal" }, { status: 500 });
  }

  const user = (Array.isArray(data) ? data[0] : data) as DashboardUser | undefined;
  if (!user) return Response.json({ error: "Username atau password tidak cocok" }, { status: 401 });

  const token = await createDashboardSession({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
  });
  if (!token) return Response.json({ error: "Konfigurasi sesi tidak lengkap" }, { status: 503 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `${DASHBOARD_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    },
  });
}

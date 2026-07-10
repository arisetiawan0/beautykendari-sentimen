import { createSupabaseAdmin } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  handled_by: z.string().trim().min(1).max(80).default("admin"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "ID alert tidak valid" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Nama penindak lanjut tidak valid" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: "handled",
      handled_by: parsed.data.handled_by,
      handled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) return Response.json({ error: "Alert tidak ditemukan" }, { status: 404 });

  return Response.json({ data });
}

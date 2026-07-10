import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  dashboardFilterSchema,
  searchParamsObject,
  validationMessage,
} from "@/lib/dashboard";
import { z } from "zod";

const trendsSchema = dashboardFilterSchema.extend({
  period: z.enum(["day", "week"]).default("day"),
});

export async function GET(request: Request) {
  const parsed = trendsSchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }

  const { period, date_from: dateFrom, date_to: dateTo, platform, post_id: postId } = parsed.data;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("comments_analyzed")
    .select("sentiment, analyzed_at, raw_comments!inner(id, post_id, is_spam, posts!inner(id, platform))")
    .eq("raw_comments.is_spam", false)
    .order("analyzed_at", { ascending: true });

  if (dateFrom) query = query.gte("analyzed_at", dateFrom);
  if (dateTo) query = query.lte("analyzed_at", dateTo);
  if (platform) query = query.eq("raw_comments.posts.platform", platform);
  if (postId) query = query.eq("raw_comments.post_id", postId);

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const grouped: Record<string, { positive: number; negative: number; neutral: number; total: number }> = {};

  data?.forEach((item) => {
    const value = new Date(item.analyzed_at);
    if (period === "week") {
      const day = value.getUTCDay() || 7;
      value.setUTCDate(value.getUTCDate() - day + 1);
    }
    const date = value.toISOString().split("T")[0];
    if (!grouped[date]) {
      grouped[date] = { positive: 0, negative: 0, neutral: 0, total: 0 };
    }
    const sentiment = item.sentiment as "positive" | "negative" | "neutral";
    grouped[date][sentiment]++;
    grouped[date].total++;
  });

  const trendData = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      ...counts,
    }));

  return Response.json({ data: trendData });
}

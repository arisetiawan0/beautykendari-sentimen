import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  dashboardFilterSchema,
  paginationSchema,
  searchParamsObject,
  unwrapRelation,
  validationMessage,
} from "@/lib/dashboard";
import { z } from "zod";

const alertsSchema = dashboardFilterSchema.merge(paginationSchema).extend({
  status: z.enum(["pending", "handled"]).optional(),
});

export async function GET(request: Request) {
  const parsed = alertsSchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }

  const {
    status,
    platform,
    post_id: postId,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    page_size: pageSize,
  } = parsed.data;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("alerts")
    .select(`
      id, status, handled_by, handled_at, created_at,
      comments_analyzed!inner(
        id, raw_comment_id, sentiment, category, confidence, summary_reason, analyzed_at,
        raw_comments!inner(
          id, post_id, username, comment_text, commented_at, like_count, is_spam,
          posts!inner(id, platform, post_url, caption, account_name)
        )
      )
    `, { count: "exact" })
    .eq("comments_analyzed.raw_comments.is_spam", false)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (platform) query = query.eq("comments_analyzed.raw_comments.posts.platform", platform);
  if (postId) query = query.eq("comments_analyzed.raw_comments.post_id", postId);
  if (dateFrom) query = query.gte("comments_analyzed.analyzed_at", dateFrom);
  if (dateTo) query = query.lte("comments_analyzed.analyzed_at", dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).flatMap((item) => {
    const analysis = unwrapRelation(item.comments_analyzed);
    const rawComment = analysis ? unwrapRelation(analysis.raw_comments) : null;
    const post = rawComment ? unwrapRelation(rawComment.posts) : null;
    if (!analysis || !rawComment || !post) return [];

    return [{
        id: item.id,
        status: item.status,
        handled_by: item.handled_by,
        handled_at: item.handled_at,
        created_at: item.created_at,
        comment: {
          id: analysis.id,
          raw_comment_id: analysis.raw_comment_id,
          username: rawComment.username,
          comment_text: rawComment.comment_text,
          commented_at: rawComment.commented_at,
          like_count: rawComment.like_count,
          sentiment: analysis.sentiment,
          category: analysis.category,
          confidence: Number(analysis.confidence),
          summary_reason: analysis.summary_reason,
          analyzed_at: analysis.analyzed_at,
          post,
        },
    }];
  });

  return Response.json({
    data: mapped,
    total: count || 0,
    page,
    page_size: pageSize,
  });
}

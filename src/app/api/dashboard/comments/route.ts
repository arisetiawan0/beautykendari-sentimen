import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  categorySchema,
  dashboardFilterSchema,
  paginationSchema,
  searchParamsObject,
  sentimentSchema,
  unwrapRelation,
  validationMessage,
} from "@/lib/dashboard";
import { z } from "zod";

const commentsSchema = dashboardFilterSchema.merge(paginationSchema).extend({
  sentiment: sentimentSchema.optional(),
  category: categorySchema.optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
});

export async function GET(request: Request) {
  const parsed = commentsSchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }

  const {
    platform,
    sentiment,
    category,
    post_id: postId,
    min_confidence: minConfidence,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    page_size: pageSize,
  } = parsed.data;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("comments_analyzed")
    .select(`
      id, raw_comment_id, sentiment, category, confidence, summary_reason, analyzed_at,
      raw_comments!inner(
        id, post_id, username, comment_text, commented_at, like_count, is_spam,
        posts!inner(id, platform, post_url, caption, account_name)
      )
    `, { count: "exact" })
    .eq("raw_comments.is_spam", false)
    .order("analyzed_at", { ascending: false });

  if (platform) query = query.eq("raw_comments.posts.platform", platform);
  if (sentiment) query = query.eq("sentiment", sentiment);
  if (category) query = query.eq("category", category);
  if (postId) query = query.eq("raw_comments.post_id", postId);
  if (minConfidence !== undefined) query = query.gte("confidence", minConfidence);
  if (dateFrom) query = query.gte("analyzed_at", dateFrom);
  if (dateTo) query = query.lte("analyzed_at", dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const mapped = (data ?? []).flatMap((item) => {
    const rawComment = unwrapRelation(item.raw_comments);
    const post = rawComment ? unwrapRelation(rawComment.posts) : null;
    if (!rawComment || !post) return [];

    return [{
      id: item.id,
      raw_comment_id: item.raw_comment_id,
      username: rawComment.username,
      comment_text: rawComment.comment_text,
      commented_at: rawComment.commented_at,
      like_count: rawComment.like_count,
      sentiment: item.sentiment,
      category: item.category,
      confidence: Number(item.confidence),
      summary_reason: item.summary_reason,
      analyzed_at: item.analyzed_at,
      post,
    }];
  });

  return Response.json({
    data: mapped,
    total: count || 0,
    page,
    page_size: pageSize,
  });
}

import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  dashboardFilterSchema,
  paginationSchema,
  searchParamsObject,
  validationMessage,
} from "@/lib/dashboard";

const postsSchema = dashboardFilterSchema.merge(paginationSchema);

export async function GET(request: Request) {
  const parsed = postsSchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }

  const {
    platform,
    date_from: dateFrom,
    date_to: dateTo,
    post_id: postId,
    page,
    page_size: pageSize,
  } = parsed.data;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("posts")
    .select(`
      id, platform, post_url, caption, account_name, posted_at, last_scraped_at,
      raw_comments(id, is_spam, comments_analyzed(sentiment))
    `, { count: "exact" })
    .order("posted_at", { ascending: false });

  if (platform) query = query.eq("platform", platform);
  if (postId) query = query.eq("id", postId);
  if (dateFrom) query = query.gte("posted_at", dateFrom);
  if (dateTo) query = query.lte("posted_at", dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const postsWithSentiment = data?.map((post) => {
    const comments = post.raw_comments.filter((comment) => !comment.is_spam);
    const analyzed = comments.flatMap((comment) => comment.comments_analyzed ?? []);
    return {
      id: post.id,
      platform: post.platform,
      post_url: post.post_url,
      caption: post.caption,
      account_name: post.account_name,
      posted_at: post.posted_at,
      last_scraped_at: post.last_scraped_at,
      comment_count: comments.length,
      positive: analyzed.filter((comment) => comment.sentiment === "positive").length,
      negative: analyzed.filter((comment) => comment.sentiment === "negative").length,
      neutral: analyzed.filter((comment) => comment.sentiment === "neutral").length,
    };
  });

  return Response.json({
    data: postsWithSentiment || [],
    total: count || 0,
    page,
    page_size: pageSize,
  });
}

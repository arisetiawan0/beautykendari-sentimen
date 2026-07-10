import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  dashboardFilterSchema,
  searchParamsObject,
  validationMessage,
} from "@/lib/dashboard";

export async function GET(request: Request) {
  const parsed = dashboardFilterSchema.safeParse(
    searchParamsObject(new URL(request.url).searchParams),
  );

  if (!parsed.success) {
    return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }

  const { platform, date_from: dateFrom, date_to: dateTo, post_id: postId } = parsed.data;
  const supabase = createSupabaseAdmin();

  function applyPostFilters<T extends { eq: Function; gte: Function; lte: Function }>(query: T) {
    let filtered = query;
    if (platform) filtered = filtered.eq("platform", platform);
    if (postId) filtered = filtered.eq("id", postId);
    if (dateFrom) filtered = filtered.gte("posted_at", dateFrom);
    if (dateTo) filtered = filtered.lte("posted_at", dateTo);
    return filtered;
  }

  function applyCommentFilters<T extends { eq: Function; gte: Function; lte: Function }>(query: T) {
    let filtered = query;
    if (platform) filtered = filtered.eq("raw_comments.posts.platform", platform);
    if (postId) filtered = filtered.eq("raw_comments.post_id", postId);
    if (dateFrom) filtered = filtered.gte("analyzed_at", dateFrom);
    if (dateTo) filtered = filtered.lte("analyzed_at", dateTo);
    return filtered;
  }

  const postCountQuery = applyPostFilters(
    supabase.from("posts").select("id", { count: "exact", head: true }),
  );
  const igCountQuery = applyPostFilters(
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("platform", "ig"),
  );
  const tiktokCountQuery = applyPostFilters(
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("platform", "tiktok"),
  );

  let rawCommentsQuery = supabase
    .from("raw_comments")
    .select("id, posts!inner(id, platform, posted_at)", { count: "exact", head: true });
  if (platform) rawCommentsQuery = rawCommentsQuery.eq("posts.platform", platform);
  if (postId) rawCommentsQuery = rawCommentsQuery.eq("post_id", postId);
  if (dateFrom) rawCommentsQuery = rawCommentsQuery.gte("scraped_at", dateFrom);
  if (dateTo) rawCommentsQuery = rawCommentsQuery.lte("scraped_at", dateTo);

  let spamQuery = supabase
    .from("raw_comments")
    .select("id, posts!inner(id, platform)", { count: "exact", head: true })
    .eq("is_spam", true);
  if (platform) spamQuery = spamQuery.eq("posts.platform", platform);
  if (postId) spamQuery = spamQuery.eq("post_id", postId);
  if (dateFrom) spamQuery = spamQuery.gte("scraped_at", dateFrom);
  if (dateTo) spamQuery = spamQuery.lte("scraped_at", dateTo);

  const sentimentQuery = (sentiment: "positive" | "negative" | "neutral") =>
    applyCommentFilters(
      supabase
        .from("comments_analyzed")
        .select("id, raw_comments!inner(id, post_id, is_spam, posts!inner(id, platform))", {
          count: "exact",
          head: true,
        })
        .eq("sentiment", sentiment)
        .eq("raw_comments.is_spam", false),
    );

  let alertsQuery = supabase
    .from("alerts")
    .select(
      "id, comments_analyzed!inner(id, analyzed_at, raw_comments!inner(id, post_id, posts!inner(id, platform)))",
      { count: "exact", head: true },
    )
    .eq("status", "pending");
  if (platform) alertsQuery = alertsQuery.eq("comments_analyzed.raw_comments.posts.platform", platform);
  if (postId) alertsQuery = alertsQuery.eq("comments_analyzed.raw_comments.post_id", postId);
  if (dateFrom) alertsQuery = alertsQuery.gte("comments_analyzed.analyzed_at", dateFrom);
  if (dateTo) alertsQuery = alertsQuery.lte("comments_analyzed.analyzed_at", dateTo);

  let latestScrapeQuery = supabase
    .from("posts")
    .select("last_scraped_at")
    .not("last_scraped_at", "is", null)
    .order("last_scraped_at", { ascending: false })
    .limit(1);
  if (platform) latestScrapeQuery = latestScrapeQuery.eq("platform", platform);
  if (postId) latestScrapeQuery = latestScrapeQuery.eq("id", postId);

  const results = await Promise.all([
    postCountQuery,
    rawCommentsQuery,
    spamQuery,
    sentimentQuery("positive"),
    sentimentQuery("negative"),
    sentimentQuery("neutral"),
    alertsQuery,
    igCountQuery,
    tiktokCountQuery,
    latestScrapeQuery,
  ]);

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 500 });

  const [posts, comments, spam, positive, negative, neutral, alerts, ig, tiktok, latest] = results;
  const sentimentCounts = {
    positive: positive.count ?? 0,
    negative: negative.count ?? 0,
    neutral: neutral.count ?? 0,
  };

  return Response.json({
    total_posts: posts.count ?? 0,
    total_comments: comments.count ?? 0,
    total_analyzed: sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral,
    sentiment_counts: sentimentCounts,
    spam_count: spam.count ?? 0,
    pending_alerts: alerts.count ?? 0,
    platforms: { ig: ig.count ?? 0, tiktok: tiktok.count ?? 0 },
    last_scraped_at: latest.data?.[0]?.last_scraped_at ?? null,
  });
}

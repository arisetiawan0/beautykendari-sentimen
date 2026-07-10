import type { SupabaseClient } from "@supabase/supabase-js";

import type { Platform } from "@/lib/config";
import { getConfig, getNegativeAlertConfidence } from "@/lib/config";
import { scrapePlatformComments } from "@/lib/apify/comments";
import { discoverPlatformPosts } from "@/lib/apify/posts";
import { cleanCommentText, isLikelySpam } from "@/lib/comments/preprocess";
import { createCommentHash } from "@/lib/comments/hash";
import { classifyCommentsWithMimo } from "@/lib/sentiment/mimo";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type PipelineOptions = {
  platform?: Platform;
  postLimit?: number;
  commentLimit?: number;
  maxPosts?: number;
  batchSize?: number;
};

type PostRow = {
  id: string;
  platform: Platform;
  post_url: string;
};

type RawCommentRow = {
  id: string;
  cleaned_text: string | null;
  comment_text: string;
};

type AnalysisRow = {
  id: string;
  raw_comment_id: string;
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
};

function getPlatforms(platform?: Platform) {
  return platform ? [platform] : (["ig", "tiktok"] satisfies Platform[]);
}

export function parsePlatform(value: unknown) {
  if (value === "ig" || value === "tiktok") {
    return value;
  }

  return undefined;
}

export function parseNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && !Number.isNaN(Number(value)) && Number(value) > 0) {
    return Number(value);
  }

  return fallback;
}

async function recordJobStart(supabase: SupabaseClient, jobName: string) {
  const { data, error } = await supabase
    .from("job_runs")
    .insert({ job_name: jobName, status: "success" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function recordJobFinish(
  supabase: SupabaseClient,
  jobRunId: string,
  status: "success" | "failed",
  details?: Record<string, unknown>,
  errorMessage?: string,
) {
  const { error } = await supabase
    .from("job_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      details,
      error_message: errorMessage,
    })
    .eq("id", jobRunId);

  if (error) {
    throw error;
  }
}

export async function runTrackedJob<T>(
  jobName: string,
  handler: (supabase: SupabaseClient) => Promise<T>,
) {
  const supabase = createSupabaseAdmin();
  const jobRunId = await recordJobStart(supabase, jobName);

  try {
    const result = await handler(supabase);

    await recordJobFinish(supabase, jobRunId, "success", { result });

    return { ok: true, jobRunId, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected job error";

    await recordJobFinish(supabase, jobRunId, "failed", undefined, message);
    throw error;
  }
}

export async function discoverPostsJob(
  supabase: SupabaseClient,
  { platform, postLimit = 20 }: PipelineOptions = {},
) {
  const posts = (
    await Promise.all(
      getPlatforms(platform).map((platformName) =>
        discoverPlatformPosts({ platform: platformName, limit: postLimit }),
      ),
    )
  ).flat();

  if (posts.length === 0) {
    return { discovered: 0, upserted: 0 };
  }

  const rows = posts.map((post) => ({
    platform: post.platform,
    platform_post_id: post.platformPostId,
    post_url: post.postUrl,
    caption: post.caption,
    posted_at: post.postedAt,
    account_name: post.accountName,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("posts")
    .upsert(rows, { onConflict: "platform,post_url" })
    .select("id");

  if (error) {
    throw error;
  }

  return { discovered: posts.length, upserted: data?.length ?? 0 };
}

export async function scrapeCommentsJob(
  supabase: SupabaseClient,
  { platform, commentLimit = 150, maxPosts = 25 }: PipelineOptions = {},
) {
  let query = supabase
    .from("posts")
    .select("id, platform, post_url")
    .eq("is_active", true)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(maxPosts);

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data: posts, error } = await query;

  if (error) {
    throw error;
  }

  let scraped = 0;
  let attemptedInsert = 0;

  for (const post of (posts ?? []) as PostRow[]) {
    const comments = await scrapePlatformComments({
      platform: post.platform,
      postUrl: post.post_url,
      limit: commentLimit,
    });

    scraped += comments.length;

    const rows = comments.map((comment) => {
      const cleanedText = cleanCommentText(comment.commentText);
      const isSpam = isLikelySpam(cleanedText);

      return {
        post_id: post.id,
        platform_comment_id: comment.platformCommentId,
        username: comment.username,
        comment_text: comment.commentText,
        cleaned_text: cleanedText,
        commented_at: comment.commentedAt,
        like_count: comment.likeCount,
        is_spam: isSpam,
        is_processed: isSpam,
        comment_hash: createCommentHash({
          platform: post.platform,
          postId: post.id,
          username: comment.username,
          commentText: comment.commentText,
          commentedAt: comment.commentedAt,
          platformCommentId: comment.platformCommentId,
        }),
      };
    });

    if (rows.length > 0) {
      attemptedInsert += rows.length;
      const { error: insertError } = await supabase
        .from("raw_comments")
        .upsert(rows, { onConflict: "comment_hash", ignoreDuplicates: true });

      if (insertError) {
        throw insertError;
      }
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", post.id);

    if (updateError) {
      throw updateError;
    }
  }

  return { posts: posts?.length ?? 0, scraped, attemptedInsert };
}

export async function analyzeCommentsJob(
  supabase: SupabaseClient,
  { batchSize = 50 }: PipelineOptions = {},
) {
  const config = getConfig();
  const negativeAlertConfidence = getNegativeAlertConfidence();
  const { data: comments, error } = await supabase
    .from("raw_comments")
    .select("id, cleaned_text, comment_text")
    .eq("is_processed", false)
    .eq("is_spam", false)
    .order("scraped_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw error;
  }

  const pendingComments = (comments ?? []) as RawCommentRow[];

  if (pendingComments.length === 0) {
    return { analyzed: 0, alertsCreated: 0 };
  }

  const classifications = await classifyCommentsWithMimo(
    pendingComments.map((comment) => ({
      id: comment.id,
      text: comment.cleaned_text || comment.comment_text,
    })),
  );

  const knownCommentIds = new Set(pendingComments.map((comment) => comment.id));
  const rows = classifications
    .filter((classification) => knownCommentIds.has(classification.id))
    .map((classification) => ({
      raw_comment_id: classification.id,
      sentiment: classification.sentiment,
      category: classification.category,
      confidence: classification.confidence,
      summary_reason: classification.summary_reason,
      model: config.mimoModel,
    }));

  if (rows.length === 0) {
    return { analyzed: 0, alertsCreated: 0 };
  }

  const { data: analyses, error: analysisError } = await supabase
    .from("comments_analyzed")
    .upsert(rows, { onConflict: "raw_comment_id" })
    .select("id, raw_comment_id, sentiment, confidence");

  if (analysisError) {
    throw analysisError;
  }

  const processedIds = rows.map((row) => row.raw_comment_id);
  const { error: updateError } = await supabase
    .from("raw_comments")
    .update({ is_processed: true })
    .in("id", processedIds);

  if (updateError) {
    throw updateError;
  }

  const alertRows = ((analyses ?? []) as AnalysisRow[])
    .filter(
      (analysis) =>
        analysis.sentiment === "negative" && analysis.confidence >= negativeAlertConfidence,
    )
    .map((analysis) => ({ comment_analysis_id: analysis.id, status: "pending" }));

  if (alertRows.length > 0) {
    const { error: alertError } = await supabase
      .from("alerts")
      .upsert(alertRows, { onConflict: "comment_analysis_id", ignoreDuplicates: true });

    if (alertError) {
      throw alertError;
    }
  }

  return { analyzed: rows.length, alertsCreated: alertRows.length };
}

export async function runAllJob(supabase: SupabaseClient, options: PipelineOptions = {}) {
  const discover = await discoverPostsJob(supabase, options);
  const scrape = await scrapeCommentsJob(supabase, options);
  const analyze = await analyzeCommentsJob(supabase, options);

  return { discover, scrape, analyze };
}

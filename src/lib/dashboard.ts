import { z } from "zod";

export const platformSchema = z.enum(["ig", "tiktok"]);
export const sentimentSchema = z.enum(["positive", "negative", "neutral"]);
export const categorySchema = z.enum([
  "pertanyaan_produk",
  "komplain",
  "pujian",
  "spam",
  "lainnya",
]);

const optionalDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid")
  .optional();

export const dashboardFilterSchema = z.object({
  platform: platformSchema.optional(),
  date_from: optionalDate,
  date_to: optionalDate,
  post_id: z.string().uuid().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export function searchParamsObject(searchParams: URLSearchParams) {
  return Object.fromEntries(
    Array.from(searchParams.entries()).filter(([, value]) => value !== ""),
  );
}

export function validationMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(", ");
}

export function unwrapRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type Platform = z.infer<typeof platformSchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;
export type Category = z.infer<typeof categorySchema>;

export interface DashboardSummary {
  total_posts: number;
  total_comments: number;
  total_analyzed: number;
  sentiment_counts: Record<Sentiment, number>;
  spam_count: number;
  pending_alerts: number;
  platforms: Record<Platform, number>;
  last_scraped_at: string | null;
}

export interface TrendPoint {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export interface PostSummary {
  id: string;
  platform: Platform;
  post_url: string;
  caption: string | null;
  account_name: string;
  posted_at: string | null;
  last_scraped_at: string | null;
  comment_count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface AnalyzedComment {
  id: string;
  raw_comment_id: string;
  username: string;
  comment_text: string;
  commented_at: string | null;
  like_count: number | null;
  sentiment: Sentiment;
  category: Category;
  confidence: number;
  summary_reason: string | null;
  analyzed_at: string;
  post: {
    id: string;
    platform: Platform;
    post_url: string;
    caption: string | null;
    account_name: string;
  };
}

export interface DashboardAlert {
  id: string;
  status: "pending" | "handled";
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  comment: AnalyzedComment;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

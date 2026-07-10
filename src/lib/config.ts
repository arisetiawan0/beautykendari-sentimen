const DEFAULT_NEGATIVE_ALERT_CONFIDENCE = 0.75;

export type Platform = "ig" | "tiktok";

export function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

export function getConfig() {
  return {
    igUsername: process.env.IG_USERNAME ?? "beauty.kendari",
    tiktokUsername: process.env.TIKTOK_USERNAME ?? "beauty.kendari",
    mimoModel: process.env.MIMO_MODEL ?? "mimo-v2.5-pro",
    negativeAlertConfidence: Number(
      process.env.NEGATIVE_ALERT_CONFIDENCE ?? DEFAULT_NEGATIVE_ALERT_CONFIDENCE,
    ),
  };
}

export function getSupabaseConfig() {
  return {
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getApifyConfig() {
  return {
    apifyToken: getRequiredEnv("APIFY_TOKEN"),
    igPostsActorId: getRequiredEnv("APIFY_IG_POSTS_ACTOR_ID"),
    igCommentsActorId: getRequiredEnv("APIFY_IG_COMMENTS_ACTOR_ID"),
    tiktokPostsActorId: getRequiredEnv("APIFY_TIKTOK_POSTS_ACTOR_ID"),
    tiktokCommentsActorId: getRequiredEnv("APIFY_TIKTOK_COMMENTS_ACTOR_ID"),
    igUsername: process.env.IG_USERNAME ?? "beauty.kendari",
    tiktokUsername: process.env.TIKTOK_USERNAME ?? "beauty.kendari",
  };
}

export function getMimoConfig() {
  return {
    mimoApiKey: getRequiredEnv("MIMO_API_KEY"),
    mimoApiBaseUrl: getRequiredEnv("MIMO_API_BASE_URL"),
    mimoModel: process.env.MIMO_MODEL ?? "mimo-v2.5-pro",
  };
}

export function getCronSecret() {
  return getRequiredEnv("CRON_SECRET");
}

export function getNegativeAlertConfidence() {
  return Number(process.env.NEGATIVE_ALERT_CONFIDENCE ?? DEFAULT_NEGATIVE_ALERT_CONFIDENCE);
}

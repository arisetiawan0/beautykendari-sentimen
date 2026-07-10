import type { Platform } from "@/lib/config";
import { getApifyConfig } from "@/lib/config";
import { getActorInputOverride, runApifyActor } from "@/lib/apify/client";
import { compactNormalized, normalizeComment } from "@/lib/apify/normalize";

type ScrapeCommentsOptions = {
  platform: Platform;
  postUrl: string;
  limit?: number;
};

export async function scrapePlatformComments({
  platform,
  postUrl,
  limit = 150,
}: ScrapeCommentsOptions) {
  const config = getApifyConfig();
  const actorId = platform === "ig" ? config.igCommentsActorId : config.tiktokCommentsActorId;
  const envName = platform === "ig" ? "APIFY_IG_COMMENTS_INPUT_JSON" : "APIFY_TIKTOK_COMMENTS_INPUT_JSON";
  const overrideInput = getActorInputOverride(envName);
  const defaultInput =
    platform === "ig"
      ? actorId === "apify/instagram-comment-scraper"
        ? {
            directUrls: [postUrl],
            resultsLimit: limit,
            includeNestedComments: false,
          }
        : {
            startUrls: [postUrl],
            maxItems: limit,
            fetchReplies: false,
          }
      : actorId === "clockworks/tiktok-comments-scraper"
        ? {
            postURLs: [postUrl],
            commentsPerPost: limit,
            maxRepliesPerComment: 0,
            resultsPerPage: 1,
          }
        : {
            startUrls: [postUrl],
            maxItems: limit,
            includeReplies: false,
          };

  const input = overrideInput
    ? JSON.parse(JSON.stringify(overrideInput).replaceAll("{{POST_URL}}", postUrl))
    : defaultInput;

  const items = await runApifyActor<Record<string, unknown>>({ actorId, input });

  return compactNormalized(items.map(normalizeComment));
}

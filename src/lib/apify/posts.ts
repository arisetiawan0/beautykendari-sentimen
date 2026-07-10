import type { Platform } from "@/lib/config";
import { getApifyConfig } from "@/lib/config";
import { getActorInputOverride, runApifyActor } from "@/lib/apify/client";
import { compactNormalized, normalizePost } from "@/lib/apify/normalize";

type DiscoverPostsOptions = {
  platform: Platform;
  limit?: number;
};

export async function discoverPlatformPosts({ platform, limit = 20 }: DiscoverPostsOptions) {
  const config = getApifyConfig();
  const accountName = platform === "ig" ? config.igUsername : config.tiktokUsername;
  const actorId = platform === "ig" ? config.igPostsActorId : config.tiktokPostsActorId;
  const envName = platform === "ig" ? "APIFY_IG_POSTS_INPUT_JSON" : "APIFY_TIKTOK_POSTS_INPUT_JSON";
  const overrideInput = getActorInputOverride(envName);
  const defaultInput =
    platform === "ig"
      ? {
          directUrls: [`https://www.instagram.com/${accountName}/`],
          resultsType: "posts",
          resultsLimit: limit,
        }
      : actorId === "clockworks/tiktok-scraper"
        ? {
            profiles: [accountName],
            resultsPerPage: limit,
            profileScrapeSections: ["videos"],
            profileSorting: "latest",
            excludePinnedPosts: false,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            shouldDownloadSlideshowImages: false,
            shouldDownloadAvatars: false,
            shouldDownloadMusicCovers: false,
            commentsPerPost: 0,
            topLevelCommentsPerPost: 0,
            maxRepliesPerComment: 0,
            proxyCountryCode: "None",
          }
        : {
            usernames: [accountName],
            maxItems: limit,
            shouldDownloadVideos: false,
          };

  const items = await runApifyActor<Record<string, unknown>>({
    actorId,
    input: overrideInput ?? defaultInput,
  });

  return compactNormalized(items.map((item) => normalizePost(platform, accountName, item)));
}

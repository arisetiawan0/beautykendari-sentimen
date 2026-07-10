import type { Platform } from "@/lib/config";

export type NormalizedPost = {
  platform: Platform;
  platformPostId: string | null;
  postUrl: string;
  caption: string | null;
  postedAt: string | null;
  accountName: string;
};

export type NormalizedComment = {
  platformCommentId: string | null;
  username: string;
  commentText: string;
  commentedAt: string | null;
  likeCount: number | null;
};

type UnknownRecord = Record<string, unknown>;

function getString(item: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = key.includes(".")
      ? key.split(".").reduce<unknown>((current, pathPart) => {
          if (!current || typeof current !== "object") {
            return undefined;
          }

          return (current as UnknownRecord)[pathPart];
        }, item)
      : item[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function getNumber(item: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = item[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function getDateString(item: UnknownRecord, keys: string[]) {
  const rawValue = getString(item, keys);

  if (!rawValue) {
    return null;
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function normalizePost(
  platform: Platform,
  accountName: string,
  item: UnknownRecord,
) {
  const postUrl = getString(item, ["url", "postUrl", "post_url", "postPage", "webVideoUrl", "shareUrl"]);

  if (!postUrl) {
    return null;
  }

  return {
    platform,
    platformPostId: getString(item, ["id", "postId", "shortCode", "shortcode", "awemeId"]),
    postUrl,
    caption: getString(item, ["caption", "title", "text", "description", "desc"]),
    postedAt: getDateString(item, ["timestamp", "postedAt", "posted_at", "uploadedAtFormatted", "createTimeISO"]),
    accountName,
  } satisfies NormalizedPost;
}

export function normalizeComment(item: UnknownRecord) {
  const username = getString(item, [
    "username",
    "ownerUsername",
    "uniqueId",
    "user.username",
    "authorMeta.name",
    "authorName",
    "user",
  ]);
  const commentText = getString(item, ["text", "message", "comment", "commentText", "comment_text"]);

  if (!username || !commentText) {
    return null;
  }

  return {
    platformCommentId: getString(item, ["id", "commentId", "cid"]),
    username,
    commentText,
    commentedAt: getDateString(item, ["timestamp", "createdAt", "created_at", "commentedAt", "createTimeISO"]),
    likeCount: getNumber(item, ["likes", "likeCount", "likesCount", "diggCount"]),
  } satisfies NormalizedComment;
}

export function compactNormalized<T>(items: Array<T | null>) {
  return items.filter((item): item is T => item !== null);
}

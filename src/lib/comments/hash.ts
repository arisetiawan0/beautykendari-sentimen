import { createHash } from "node:crypto";

import type { Platform } from "@/lib/config";

type CommentHashInput = {
  platform: Platform;
  postId: string;
  username: string;
  commentText: string;
  commentedAt: string | null;
  platformCommentId?: string | null;
};

export function createCommentHash({
  platform,
  postId,
  username,
  commentText,
  commentedAt,
  platformCommentId,
}: CommentHashInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        platform,
        postId,
        username: username.toLowerCase(),
        commentText: commentText.trim(),
        commentedAt,
        platformCommentId,
      }),
    )
    .digest("hex");
}

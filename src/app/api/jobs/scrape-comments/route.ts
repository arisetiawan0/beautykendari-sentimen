import { requireCronAuth, readJsonBody, toJobErrorResponse, toJobResponse } from "@/lib/jobs/auth";
import { parseNumber, parsePlatform, runTrackedJob, scrapeCommentsJob } from "@/lib/jobs/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCronAuth(request);

    const body = await readJsonBody(request);
    const result = await runTrackedJob("scrape-comments", (supabase) =>
      scrapeCommentsJob(supabase, {
        platform: parsePlatform(body.platform),
        commentLimit: parseNumber(body.commentLimit, 150),
        maxPosts: parseNumber(body.maxPosts, 25),
      }),
    );

    return toJobResponse(result);
  } catch (error) {
    return toJobErrorResponse(error);
  }
}

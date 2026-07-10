import { requireCronAuth, readJsonBody, toJobErrorResponse, toJobResponse } from "@/lib/jobs/auth";
import { discoverPostsJob, parseNumber, parsePlatform, runTrackedJob } from "@/lib/jobs/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCronAuth(request);

    const body = await readJsonBody(request);
    const result = await runTrackedJob("discover-posts", (supabase) =>
      discoverPostsJob(supabase, {
        platform: parsePlatform(body.platform),
        postLimit: parseNumber(body.postLimit, 20),
      }),
    );

    return toJobResponse(result);
  } catch (error) {
    return toJobErrorResponse(error);
  }
}

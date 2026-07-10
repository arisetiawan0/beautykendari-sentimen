import { requireCronAuth, readJsonBody, toJobErrorResponse, toJobResponse } from "@/lib/jobs/auth";
import { parseNumber, parsePlatform, runAllJob, runTrackedJob } from "@/lib/jobs/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCronAuth(request);

    const body = await readJsonBody(request);
    const result = await runTrackedJob("run-all", (supabase) =>
      runAllJob(supabase, {
        platform: parsePlatform(body.platform),
        postLimit: parseNumber(body.postLimit, 20),
        commentLimit: parseNumber(body.commentLimit, 150),
        maxPosts: parseNumber(body.maxPosts, 25),
        batchSize: parseNumber(body.batchSize, 50),
      }),
    );

    return toJobResponse(result);
  } catch (error) {
    return toJobErrorResponse(error);
  }
}

import { requireCronAuth, readJsonBody, toJobErrorResponse, toJobResponse } from "@/lib/jobs/auth";
import { analyzeCommentsJob, parseNumber, runTrackedJob } from "@/lib/jobs/pipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCronAuth(request);

    const body = await readJsonBody(request);
    const result = await runTrackedJob("analyze-comments", (supabase) =>
      analyzeCommentsJob(supabase, {
        batchSize: parseNumber(body.batchSize, 50),
      }),
    );

    return toJobResponse(result);
  } catch (error) {
    return toJobErrorResponse(error);
  }
}

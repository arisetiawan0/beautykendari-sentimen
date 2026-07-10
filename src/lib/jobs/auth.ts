import { getCronSecret } from "@/lib/config";

export function requireCronAuth(request: Request) {
  const cronSecretValue = getCronSecret();
  const authorization = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");

  if (authorization === `Bearer ${cronSecretValue}` || cronSecret === cronSecretValue) {
    return;
  }

  throw new Error("Unauthorized job request");
}

export async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {} as Record<string, unknown>;
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export function toJobResponse<T>(result: T, status = 200) {
  return Response.json(result, { status });
}

export function toJobErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected job error";
  const status = message === "Unauthorized job request" ? 401 : 500;

  return Response.json({ ok: false, error: message }, { status });
}

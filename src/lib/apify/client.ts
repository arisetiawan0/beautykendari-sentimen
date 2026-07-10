import { getApifyConfig } from "@/lib/config";

type ActorRunOptions = {
  actorId: string;
  input: Record<string, unknown>;
};

export async function runApifyActor<T>({ actorId, input }: ActorRunOptions) {
  const { apifyToken } = getApifyConfig();
  const encodedActorId = encodeURIComponent(actorId);
  const url = new URL(
    `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items`,
  );

  url.searchParams.set("token", apifyToken);
  url.searchParams.set("format", "json");
  url.searchParams.set("clean", "true");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apify actor ${actorId} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T[];
}

export function getActorInputOverride(envName: string) {
  const rawValue = process.env[envName];

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Record<string, unknown>;
  } catch {
    throw new Error(`${envName} must be valid JSON`);
  }
}

export const DASHBOARD_SESSION_COOKIE = "beauty_dashboard_session";

export function dashboardAuthConfigured() {
  return Boolean(process.env.DASHBOARD_PASSWORD && process.env.DASHBOARD_SESSION_SECRET);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function dashboardSessionToken() {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!password || !secret) return null;
  return sha256(`${secret}:${password}`);
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

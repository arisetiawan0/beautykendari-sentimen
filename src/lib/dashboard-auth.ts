export const DASHBOARD_SESSION_COOKIE = "beauty_dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type DashboardSessionUser = {
  id: string;
  username: string;
  displayName?: string | null;
};

type DashboardSessionPayload = {
  sub: string;
  username: string;
  displayName?: string | null;
  iat: number;
  exp: number;
};

export function dashboardAuthConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.DASHBOARD_SESSION_SECRET,
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string) {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createDashboardSession(user: DashboardSessionUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload: DashboardSessionPayload = {
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(body);
  if (!signature) return null;
  return `${body}.${signature}`;
}

export async function verifyDashboardSession(token: string | undefined) {
  if (!token) return null;

  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;

  const expectedSignature = await sign(body);
  if (!expectedSignature || !constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as DashboardSessionPayload;
    if (!payload.sub || !payload.username || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionMaxAgeSeconds() {
  return SESSION_TTL_SECONDS;
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  AUTH_REQUIRED_ENV_VARS,
  getAdminEmail,
  getGoogleClientId,
  getSessionCookieAttributes,
  getSessionSecret,
  GOOGLE_VERIFY_TIMEOUT_MS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SEC,
} from "./config.js";
import { fetchWithTimeout } from "./http.js";

export interface AuthSessionUser {
  email: string;
  name: string;
  picture: string | null;
  isAdmin: boolean;
}

interface SessionPayload extends AuthSessionUser {
  exp: number;
}

interface GoogleTokenInfoResponse {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
}

export function getMissingAuthConfig() {
  return AUTH_REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function isAuthConfigured() {
  return getMissingAuthConfig().length === 0;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signSessionValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function parseCookies(req: IncomingMessage) {
  const raw = req.headers.cookie ?? "";
  const parsed = new Map<string, string>();
  for (const chunk of raw.split(";")) {
    const [name, ...rest] = chunk.trim().split("=");
    if (!name) continue;
    parsed.set(name, rest.join("="));
  }
  return parsed;
}

export async function verifyGoogleCredential(credential: string): Promise<AuthSessionUser> {
  const normalized = String(credential ?? "").trim();
  if (!normalized) {
    throw new Error("Missing Google credential");
  }

  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const response = await fetchWithTimeout(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(normalized)}`,
    undefined,
    GOOGLE_VERIFY_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error(`Google token verification failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GoogleTokenInfoResponse;
  const aud = payload.aud?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const emailVerified = (payload.email_verified ?? "").toLowerCase() === "true";

  if (!aud || aud !== googleClientId) {
    throw new Error("Google token audience mismatch");
  }
  if (!email || !emailVerified) {
    throw new Error("Google account email is missing or not verified");
  }

  return {
    email,
    name: payload.name?.trim() || email,
    picture: payload.picture?.trim() || null,
    isAdmin: email === getAdminEmail(),
  };
}

export function createSessionCookie(user: AuthSessionUser) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured");
  }

  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signSessionValue(encodedPayload, secret);
  const cookieAttributes = getSessionCookieAttributes();
  return `${SESSION_COOKIE_NAME}=${encodedPayload}.${signature}; ${cookieAttributes.serialized}; Max-Age=${SESSION_TTL_SEC}`;
}

export function clearSessionCookie() {
  const cookieAttributes = getSessionCookieAttributes();
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes.serialized}; Max-Age=0`;
}

export function getAuthSession(req: IncomingMessage): AuthSessionUser | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const rawCookie = parseCookies(req).get(SESSION_COOKIE_NAME);
  if (!rawCookie) return null;

  const [encodedPayload, signature] = rawCookie.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signSessionValue(encodedPayload, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!parsed?.email || !parsed?.exp || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      email: parsed.email,
      name: parsed.name,
      picture: parsed.picture ?? null,
      isAdmin: parsed.isAdmin === true,
    };
  } catch {
    return null;
  }
}

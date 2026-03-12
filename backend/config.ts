export const PORT = Number(process.env.PORT || 3001);
export const SYNC_TIMEOUT_MS = 180000;
export const MAX_ALLOWED_PRICE_WON = 14500000;
export const STALE_SYNC_THRESHOLD_MS = 6 * 60 * 60 * 1000;
export const STARTUP_REACTIVATE_HOURS = 72;
export const AUTO_SYNC_ON_STARTUP = true;

export const SESSION_COOKIE_NAME = "car_dashboard_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
export const GOOGLE_VERIFY_TIMEOUT_MS = 10000;
export const AUTH_REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "ADMIN_EMAIL",
  "AUTH_SESSION_SECRET",
] as const;

const DEFAULT_DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET?.trim() ?? "";
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getSessionCookieAttributes() {
  const sameSite = isProduction() ? "None" : "Lax";
  const secure = isProduction();

  return {
    sameSite,
    secure,
    serialized: `Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}`,
  };
}

export function getAllowedCorsOrigins() {
  const raw = (process.env.CORS_ALLOWED_ORIGINS ?? "").trim();
  const configured = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  if (!isProduction()) {
    return DEFAULT_DEV_CORS_ORIGINS;
  }

  return [];
}

export function shouldAllowAnyCorsOrigin() {
  return !isProduction() && getAllowedCorsOrigins().length === 0;
}

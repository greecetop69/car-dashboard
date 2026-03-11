export const PORT = Number(process.env.PORT || 3001);
export const SYNC_TIMEOUT_MS = 180000;
export const MAX_ALLOWED_PRICE_WON = 14500000;
export const STALE_SYNC_THRESHOLD_MS = 6 * 60 * 60 * 1000;
export const STARTUP_REACTIVATE_HOURS = 72;
export const AUTO_SYNC_ON_STARTUP = true;

export const SESSION_COOKIE_NAME = "car_dashboard_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_PATH = "Path=/; HttpOnly; SameSite=Lax";
export const GOOGLE_VERIFY_TIMEOUT_MS = 10000;
export const AUTH_REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "ADMIN_EMAIL",
  "AUTH_SESSION_SECRET",
] as const;

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

export function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET?.trim() ?? "";
}

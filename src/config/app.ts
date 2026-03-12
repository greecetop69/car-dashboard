const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, "");

export const appConfig = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "",
  apiUrl: normalizedApiUrl,
  apiTimeoutMs: 30_000,
} as const;

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return normalizedApiUrl ? `${normalizedApiUrl}/api` : "/api";
  }

  // In production the frontend is served behind Vercel rewrites.
  // Using same-origin /api keeps the auth cookie first-party on iOS Safari.
  return "/api";
}

export const apiBaseUrl = resolveApiBaseUrl();

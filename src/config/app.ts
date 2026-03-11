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

  if (!normalizedApiUrl || normalizedApiUrl === "/" || normalizedApiUrl === "/api") {
    return "/api";
  }

  if (/^https?:\/\//i.test(normalizedApiUrl)) {
    return `${normalizedApiUrl}/api`;
  }

  return normalizedApiUrl.startsWith("/api") ? normalizedApiUrl : `${normalizedApiUrl}/api`;
}

export const apiBaseUrl = resolveApiBaseUrl();

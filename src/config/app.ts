const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";

export const appConfig = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "",
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
  apiTimeoutMs: 30_000,
} as const;

export const apiBaseUrl =
  import.meta.env.DEV ? "/api" : appConfig.apiUrl ? `${appConfig.apiUrl}/api` : "/api";

const AUTH_DEBUG_FLAG_KEY = "car_dashboard_auth_debug_enabled";
const AUTH_DEBUG_LOGS_KEY = "car_dashboard_auth_debug_logs";
const MAX_AUTH_DEBUG_ENTRIES = 200;

interface AuthDebugEntry {
  ts: string;
  event: string;
  details?: unknown;
}

declare global {
  interface Window {
    __authDebug?: {
      getLogs: () => AuthDebugEntry[];
      clearLogs: () => void;
      log: (event: string, details?: unknown) => void;
    };
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function syncAuthDebugFlagFromUrl() {
  if (!canUseStorage()) return;

  const params = new URLSearchParams(window.location.search);
  const debug = params.get("debug");

  if (debug === "1") {
    window.localStorage.setItem(AUTH_DEBUG_FLAG_KEY, "1");
  }

  if (debug === "0") {
    window.localStorage.removeItem(AUTH_DEBUG_FLAG_KEY);
    window.localStorage.removeItem(AUTH_DEBUG_LOGS_KEY);
  }
}

export function isAuthDebugEnabled() {
  if (!canUseStorage()) return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") return true;

  return window.localStorage.getItem(AUTH_DEBUG_FLAG_KEY) === "1";
}

export function getAuthDebugLogs(): AuthDebugEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(AUTH_DEBUG_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthDebugEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearAuthDebugLogs() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_DEBUG_LOGS_KEY);
}

export function logAuthDebug(event: string, details?: unknown) {
  if (!isAuthDebugEnabled() || !canUseStorage()) return;

  const entry: AuthDebugEntry = {
    ts: new Date().toISOString(),
    event,
    details,
  };

  const next = [...getAuthDebugLogs(), entry].slice(-MAX_AUTH_DEBUG_ENTRIES);
  window.localStorage.setItem(AUTH_DEBUG_LOGS_KEY, JSON.stringify(next));
  console.info("[auth-debug]", event, details ?? "");
}

export function exposeAuthDebugHelpers() {
  if (typeof window === "undefined") return;

  window.__authDebug = {
    getLogs: getAuthDebugLogs,
    clearLogs: clearAuthDebugLogs,
    log: logAuthDebug,
  };
}

export function logAuthDebugBoot() {
  if (!isAuthDebugEnabled()) return;

  exposeAuthDebugHelpers();
  logAuthDebug("app_boot", {
    href: window.location.href,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent,
  });

  const existingLogs = getAuthDebugLogs();
  if (existingLogs.length > 0) {
    console.info("[auth-debug] history", existingLogs);
  }
}

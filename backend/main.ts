import "dotenv/config";
import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from "node:http";
import {
    clearSessionCookie,
    createSessionCookie,
    getAuthSession,
    getMissingAuthConfig,
    isAuthConfigured,
    verifyGoogleCredential,
} from "./auth.js";
import {
    AUTO_SYNC_ON_STARTUP,
    getAllowedCorsOrigins,
    MAX_ALLOWED_PRICE_WON,
    PORT,
    shouldAllowAnyCorsOrigin,
    STALE_SYNC_THRESHOLD_MS,
    STARTUP_REACTIVATE_HOURS,
    SYNC_TIMEOUT_MS,
} from "./config.js";
import {
    deactivateMissingPartialOriginCars,
    deleteCarsAbovePrice,
    getCarsFromDb,
    getNotificationsFromDb,
    markNotificationsRead,
    pruneOldNotifications,
    reactivateFilteredOutKbchaCars,
    reactivateRecentlySeenInactiveCars,
    runMigrations,
    saveParsedCars,
    setCarFavorite,
} from "./db.js";
import { fetchEncarCars } from "./encarService.js";
import { fetchKbchaCars } from "./kbchaService.js";
import { fetchKcarCars } from "./kcarService.js";
import { getInspectionSummaryWithCarCache } from "./inspectionService.js";
import type { CarOrigin, ParsedCarsResponse } from "./carSources.js";
import { readJsonBody, sendJson } from "./http.js";

let syncInFlight: Promise<SyncResult> | null = null;
let syncTimer: NodeJS.Timeout | null = null;

function getCorsHeaders(req: IncomingMessage): Record<string, string> {
    const origin = req.headers.origin;
    const allowedOrigins = getAllowedCorsOrigins();
    const allowAnyOrigin = shouldAllowAnyCorsOrigin();

    const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (!origin) {
        return headers;
    }

    if (!allowAnyOrigin && !allowedOrigins.includes(origin)) {
        return headers;
    }

    headers["Access-Control-Allow-Origin"] = allowAnyOrigin ? origin : origin;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Credentials"] = "true";

    return headers;
}

function isCorsOriginAllowed(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (!origin) return true;

    if (shouldAllowAnyCorsOrigin()) {
        return true;
    }

    const allowedOrigins = getAllowedCorsOrigins();
    if (allowedOrigins.length === 0) return false;

    return allowedOrigins.includes(origin);
}

function sendCorsForbidden(
    send: (statusCode: number, payload: unknown) => void,
) {
    send(403, { error: "Origin is not allowed by CORS policy" });
}

function hasAdminAccess(session: ReturnType<typeof getAuthSession>) {
    return session?.isAdmin === true;
}

function sendAdminRequired(
    send: (statusCode: number, payload: unknown) => void,
) {
    send(403, { error: "Admin access required" });
}

function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
) {
    let timeout: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeout) clearTimeout(timeout);
    }) as Promise<T>;
}

interface SyncResult {
    syncedCars: number;
    updatedAt: string;
}

interface SourceSyncTask {
    origin: CarOrigin;
    fetchCars: () => Promise<ParsedCarsResponse>;
}

async function syncCars(options?: {
    allowDeactivate?: boolean;
}): Promise<SyncResult> {
    const allowDeactivate = options?.allowDeactivate ?? true;
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async (): Promise<SyncResult> => {
        let syncedCars = 0;
        await withTimeout(
            (async () => {
                const sourceTasks: SourceSyncTask[] = [
                    { origin: "encar", fetchCars: fetchEncarCars },
                    { origin: "kbcha", fetchCars: fetchKbchaCars },
                    { origin: "kcar", fetchCars: fetchKcarCars },
                ];
                const settled = await Promise.allSettled(
                    sourceTasks.map(async (task) => ({
                        origin: task.origin,
                        payload: await task.fetchCars(),
                    })),
                );
                const successful = settled.flatMap((entry) =>
                    entry.status === "fulfilled" ? [entry.value] : [],
                );
                const failed = settled.flatMap((entry, index) =>
                    entry.status === "rejected"
                        ? [
                              {
                                  origin: sourceTasks[index].origin,
                                  reason: entry.reason,
                              },
                          ]
                        : [],
                );

                for (const failure of failed) {
                    console.error(
                        `[sync] ${failure.origin} source failed:`,
                        failure.reason,
                    );
                }
                if (successful.length === 0) {
                    throw new Error("All car sources failed during sync");
                }

                const parsedCars = successful.flatMap(
                    (item) => item.payload.cars,
                );
                syncedCars = parsedCars.length;
                const deactivateOrigins = successful.flatMap((item) =>
                    item.payload.cars.length > 0 && !item.payload.isPartial
                        ? [item.origin]
                        : [],
                );

                await saveParsedCars(parsedCars, {
                    deactivateOrigins: allowDeactivate ? deactivateOrigins : [],
                });

                const kbcha = successful.find(
                    (item) => item.origin === "kbcha",
                )?.payload;
                if (allowDeactivate && kbcha?.isPartial) {
                    const deactivatedKbcha =
                        await deactivateMissingPartialOriginCars({
                            origin: "kbcha",
                            seenSourceIds: kbcha.cars.map(
                                (item) => item.sourceId,
                            ),
                            filter: kbcha.filter,
                        });
                    if (deactivatedKbcha > 0) {
                        console.log(
                            `[sync] Deactivated ${deactivatedKbcha} sold KBCHA cars within partial filter`,
                        );
                    }
                }

                if (kbcha?.isPartial && kbcha.filter) {
                    const restored = await reactivateFilteredOutKbchaCars(
                        kbcha.filter,
                    );
                    if (restored > 0) {
                        console.log(
                            `[sync] Restored ${restored} KBCHA cars that are outside partial filter`,
                        );
                    }
                }

                const deletedExpensive = await deleteCarsAbovePrice(
                    MAX_ALLOWED_PRICE_WON,
                );
                if (deletedExpensive > 0) {
                    console.log(
                        `[sync] Deleted ${deletedExpensive} cars above ₩ ${MAX_ALLOWED_PRICE_WON.toLocaleString("ru-RU")}`,
                    );
                }
            })(),
            SYNC_TIMEOUT_MS,
            "Sync timeout exceeded",
        );
        return {
            syncedCars,
            updatedAt: new Date().toISOString(),
        };
    })()
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            syncInFlight = null;
        });

    return syncInFlight;
}

function getKishinevNowParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Chisinau",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date());

    const read = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? "";
    return {
        year: read("year"),
        month: read("month"),
        day: read("day"),
        hour: read("hour"),
        minute: read("minute"),
    };
}

async function pruneNotificationsWithLog() {
    try {
        const deleted = await pruneOldNotifications();
        if (deleted > 0) {
            console.log(
                `[notifications] Pruned ${deleted} records older than 3 days`,
            );
        }
    } catch (error) {
        console.error(
            "[notifications] Failed to prune old notifications:",
            error,
        );
    }
}

function startHourlySyncScheduler() {
    let lastRunHourKey = "";

    const tick = async () => {
        const now = getKishinevNowParts();
        const hourKey = `${now.year}-${now.month}-${now.day} ${now.hour}`;
        const shouldRun = now.minute === "00";

        if (!shouldRun || lastRunHourKey === hourKey) return;

        lastRunHourKey = hourKey;
        try {
            await syncCars();
            await pruneNotificationsWithLog();
            console.log(
                `[sync] Hourly sync completed for Europe/Chisinau hour ${hourKey}:00`,
            );
        } catch (error) {
            console.error("[sync] Hourly sync failed:", error);
        }
    };

    void pruneNotificationsWithLog();
    void tick();
    syncTimer = setInterval(() => {
        void tick();
    }, 30_000);
    syncTimer.unref();
}

async function handleCarsRequest(forceRefresh: boolean, canSync: boolean) {
    if (syncInFlight) {
        await syncInFlight;
    }

    const current = await getCarsFromDb();
    const updatedAtMs = new Date(current.updatedAt).getTime();
    const isStale =
        Number.isFinite(updatedAtMs) &&
        Date.now() - updatedAtMs > STALE_SYNC_THRESHOLD_MS;

    if ((forceRefresh || current.cars.length === 0) && canSync) {
        await syncCars({ allowDeactivate: false });
        return getCarsFromDb();
    }

    if (isStale && canSync) {
        await syncCars({ allowDeactivate: false });
        return getCarsFromDb();
    }

    return current;
}

const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
        const send = (
            statusCode: number,
            payload: unknown,
            headers?: Record<string, string | string[]>,
        ) =>
            sendJson(res, statusCode, payload, {
                ...getCorsHeaders(req),
                ...headers,
            });
        const authSession = getAuthSession(req);

        if (!req.url) {
            send(400, { error: "Bad Request" });
            return;
        }

        if (req.method === "OPTIONS") {
            send(204, {});
            return;
        }

        const url = new URL(req.url, `http://${req.headers.host}`);

        if (!isCorsOriginAllowed(req)) {
            sendCorsForbidden(send);
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/health") {
            send(200, {
                status: "ok",
                uptimeSec: Math.round(process.uptime()),
                authConfigured: isAuthConfigured(),
            });
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/auth/session") {
            send(200, {
                authenticated: Boolean(authSession),
                user: authSession,
                authConfigured: isAuthConfigured(),
            });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/auth/google") {
            try {
                const payload = (await readJsonBody(req)) as {
                    credential?: unknown;
                };
                if (
                    typeof payload.credential !== "string" ||
                    payload.credential.trim().length === 0
                ) {
                    send(400, { error: "Field credential is required" });
                    return;
                }

                const user = await verifyGoogleCredential(payload.credential);
                send(
                    200,
                    { authenticated: true, user },
                    {
                        "Set-Cookie": createSessionCookie(user),
                    },
                );
            } catch (error) {
                send(401, {
                    error: "Failed to authenticate with Google",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/auth/logout") {
            send(
                200,
                { authenticated: false, user: null },
                {
                    "Set-Cookie": clearSessionCookie(),
                },
            );
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/sync") {
            if (!hasAdminAccess(authSession)) {
                sendAdminRequired(send);
                return;
            }
            try {
                const result = await syncCars();
                await pruneNotificationsWithLog();
                send(200, {
                    status: "ok",
                    syncedCars: result.syncedCars,
                    updatedAt: result.updatedAt,
                });
            } catch (error) {
                send(500, {
                    error: "Failed to sync cars",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/cars") {
            const forceRefresh = url.searchParams.get("refresh") === "1";
            if (forceRefresh && !hasAdminAccess(authSession)) {
                sendAdminRequired(send);
                return;
            }
            try {
                const data = await handleCarsRequest(
                    forceRefresh,
                    hasAdminAccess(authSession),
                );
                send(200, data);
            } catch (error) {
                send(500, {
                    error: "Failed to load cars",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/notifications") {
            try {
                const limit = Number(url.searchParams.get("limit") ?? 100);
                const data = await getNotificationsFromDb(limit);
                send(200, data);
            } catch (error) {
                send(500, {
                    error: "Failed to load notifications",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (
            req.method === "POST" &&
            url.pathname === "/api/notifications/read"
        ) {
            try {
                const payload = (await readJsonBody(req)) as { ids?: unknown };
                const idsRaw = Array.isArray(payload.ids) ? payload.ids : [];
                const ids = idsRaw
                    .map((item) => Number(item))
                    .filter((value) => Number.isInteger(value) && value > 0);

                const updated = await markNotificationsRead(ids);
                send(200, { status: "ok", updated });
            } catch (error) {
                send(500, {
                    error: "Failed to mark notifications as read",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (
            req.method === "POST" &&
            /^\/api\/cars\/\d+\/favorite$/.test(url.pathname)
        ) {
            if (!hasAdminAccess(authSession)) {
                sendAdminRequired(send);
                return;
            }
            const id = Number(url.pathname.split("/")[3]);
            if (!Number.isInteger(id) || id <= 0) {
                send(400, { error: "Invalid car id" });
                return;
            }

            try {
                const payload = (await readJsonBody(req)) as {
                    isFavorite?: unknown;
                };
                if (typeof payload.isFavorite !== "boolean") {
                    send(400, { error: "Field isFavorite must be boolean" });
                    return;
                }

                const updated = await setCarFavorite(id, payload.isFavorite);
                if (updated === "notFound") {
                    send(404, { error: "Car not found" });
                    return;
                }
                if (updated === "inactive") {
                    send(409, {
                        error: "Cannot add inactive car to favorites",
                    });
                    return;
                }

                send(200, { status: "ok", id, isFavorite: payload.isFavorite });
            } catch (error) {
                send(500, {
                    error: "Failed to update favorite",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        if (
            req.method === "GET" &&
            url.pathname.startsWith("/api/inspection/")
        ) {
            const vehicleId = Number(url.pathname.split("/").pop());
            if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
                send(400, { error: "Invalid vehicleId" });
                return;
            }
            try {
                const fallbackRaw = url.searchParams.get("fallbackIds") ?? "";
                const fallbackIds = fallbackRaw
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isInteger(n) && n > 0);
                const carIdRaw = url.searchParams.get("carId");
                const carId = carIdRaw != null ? Number(carIdRaw) : null;
                const validCarId =
                    carId != null && Number.isInteger(carId) && carId > 0
                        ? carId
                        : null;

                const data = await getInspectionSummaryWithCarCache(
                    vehicleId,
                    fallbackIds,
                    validCarId,
                );
                send(200, data);
            } catch (error) {
                send(500, {
                    error: "Failed to load inspection",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                });
            }
            return;
        }

        send(404, { error: "Not found" });
    },
);

await runMigrations();
const missingAuthConfig = getMissingAuthConfig();
if (missingAuthConfig.length > 0) {
    console.warn(
        `[auth] Missing environment variables: ${missingAuthConfig.join(", ")}. Google auth will stay unavailable until they are set.`,
    );
}
if (
    process.env.NODE_ENV === "production" &&
    getAllowedCorsOrigins().length === 0
) {
    console.warn(
        "[cors] CORS_ALLOWED_ORIGINS is empty in production. Cross-site auth requests will be rejected until allowed frontend origins are configured.",
    );
}
startHourlySyncScheduler();
void (async () => {
    try {
        const reactivated = await reactivateRecentlySeenInactiveCars(
            STARTUP_REACTIVATE_HOURS,
        );
        if (reactivated > 0) {
            console.log(
                `[startup] Reactivated ${reactivated} recently seen inactive cars`,
            );
        }
    } catch (error) {
        console.error(
            "[startup] Failed to reactivate recently seen cars:",
            error,
        );
    }

    if (!AUTO_SYNC_ON_STARTUP) return;

    try {
        await syncCars({ allowDeactivate: false });
        await pruneNotificationsWithLog();
    } catch (error) {
        console.error("[sync] Startup sync failed:", error);
    }
})();

server.listen(PORT, () => {
    console.log(`Backend server listening on http://localhost:${PORT}`);
});

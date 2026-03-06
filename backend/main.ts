import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  getCarsFromDb,
  getNotificationsFromDb,
  markNotificationsRead,
  runMigrations,
  saveParsedCars,
  setCarFavorite,
} from "./db.js";
import { fetchEncarCars } from "./encarService.js";
import { fetchKbchaCars } from "./kbchaService.js";
import { getInspectionSummaryWithCarCache } from "./inspectionService.js";
import type { CarOrigin } from "./carSources.js";
import { readJsonBody, sendJson } from "./http.js";

const PORT = Number(process.env.PORT || 3001);
const SYNC_TIMEOUT_MS = 180000;

let syncInFlight: Promise<SyncResult> | null = null;
let syncTimer: NodeJS.Timeout | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
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

async function syncCars(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async (): Promise<SyncResult> => {
    let syncedCars = 0;
    await withTimeout(
      (async () => {
        const [encar, kbcha] = await Promise.all([fetchEncarCars(), fetchKbchaCars()]);
        syncedCars = encar.cars.length + kbcha.cars.length;
        const deactivateOrigins: CarOrigin[] = [];
        if (encar.cars.length > 0) deactivateOrigins.push("encar");
        if (kbcha.cars.length > 0) deactivateOrigins.push("kbcha");

        await saveParsedCars([...encar.cars, ...kbcha.cars], { deactivateOrigins });
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

  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function startDailySyncScheduler() {
  let lastRunDate = "";

  const tick = async () => {
    const now = getKishinevNowParts();
    const dateKey = `${now.year}-${now.month}-${now.day}`;
    const shouldRun = now.hour === "07" && now.minute === "30";

    if (!shouldRun || lastRunDate === dateKey) return;

    lastRunDate = dateKey;
    try {
      await syncCars();
      console.log(`[sync] Daily sync completed at 07:30 Europe/Chisinau (${dateKey})`);
    } catch (error) {
      console.error("[sync] Daily sync failed:", error);
    }
  };

  void tick();
  syncTimer = setInterval(() => {
    void tick();
  }, 30_000);
  syncTimer.unref();
}

async function handleCarsRequest(forceRefresh: boolean) {
  const current = await getCarsFromDb();
  if (forceRefresh || current.cars.length === 0) {
    await syncCars();
    return getCarsFromDb();
  }
  return current;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", uptimeSec: Math.round(process.uptime()) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sync") {
    try {
      const result = await syncCars();
      sendJson(res, 200, {
        status: "ok",
        syncedCars: result.syncedCars,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to sync cars",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/cars") {
    const forceRefresh = url.searchParams.get("refresh") === "1";
    try {
      const data = await handleCarsRequest(forceRefresh);
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to load cars",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/notifications") {
    try {
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const data = await getNotificationsFromDb(limit);
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to load notifications",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/notifications/read") {
    try {
      const payload = (await readJsonBody(req)) as { ids?: unknown };
      const idsRaw = Array.isArray(payload.ids) ? payload.ids : [];
      const ids = idsRaw
        .map((item) => Number(item))
        .filter((value) => Number.isInteger(value) && value > 0);

      const updated = await markNotificationsRead(ids);
      sendJson(res, 200, { status: "ok", updated });
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to mark notifications as read",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.method === "POST" && /^\/api\/cars\/\d+\/favorite$/.test(url.pathname)) {
    const id = Number(url.pathname.split("/")[3]);
    if (!Number.isInteger(id) || id <= 0) {
      sendJson(res, 400, { error: "Invalid car id" });
      return;
    }

    try {
      const payload = (await readJsonBody(req)) as { isFavorite?: unknown };
      if (typeof payload.isFavorite !== "boolean") {
        sendJson(res, 400, { error: "Field isFavorite must be boolean" });
        return;
      }

      const updated = await setCarFavorite(id, payload.isFavorite);
      if (!updated) {
        sendJson(res, 404, { error: "Car not found" });
        return;
      }

      sendJson(res, 200, { status: "ok", id, isFavorite: payload.isFavorite });
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to update favorite",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/inspection/")) {
    const vehicleId = Number(url.pathname.split("/").pop());
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      sendJson(res, 400, { error: "Invalid vehicleId" });
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
        carId != null && Number.isInteger(carId) && carId > 0 ? carId : null;

      const data = await getInspectionSummaryWithCarCache(
        vehicleId,
        fallbackIds,
        validCarId,
      );
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, {
        error: "Failed to load inspection",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

await runMigrations();
startDailySyncScheduler();

server.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

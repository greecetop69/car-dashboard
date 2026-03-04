import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getCarsFromDb, runMigrations, saveParsedCars, setCarFavorite } from "./db.js";
import { fetchEncarCars } from "./encarService.js";
import { getInspectionSummaryWithCarCache } from "./inspectionService.js";

const PORT = Number(process.env.PORT || 3001);

let syncInFlight: Promise<void> | null = null;

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function syncCars() {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const parsed = await fetchEncarCars();
    await saveParsedCars(parsed.cars);
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
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
      await syncCars();
      const data = await getCarsFromDb();
      sendJson(res, 200, {
        status: "ok",
        syncedCars: data.meta.count,
        updatedAt: data.updatedAt,
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

server.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

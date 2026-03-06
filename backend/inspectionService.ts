import { AppDataSource } from "./db/data-source.js";
import { Car } from "./db/entities/Car.js";
import { fetchWithTimeout } from "./http.js";

interface InspectionType {
  code?: string | null;
  title?: string | null;
}

interface InspectionOuterItem {
  type?: InspectionType | null;
  statusTypes?: InspectionType[] | null;
  attributes?: string[] | null;
}

interface InspectionPayload {
  vehicleId?: number;
  master?: {
    accdient?: boolean;
    simpleRepair?: boolean;
    detail?: {
      vin?: string | null;
      modelYear?: string | null;
      firstRegistrationDate?: string | null;
      mileage?: number | null;
      transmissionType?: InspectionType | null;
      waterlog?: boolean | null;
    } | null;
  } | null;
  outers?: InspectionOuterItem[] | null;
}

export interface InspectionDamageItem {
  part: string;
  statuses: string[];
  attributes: string[];
}

export interface InspectionSummary {
  vehicleId: number;
  notFound: boolean;
  vin: string | null;
  modelYear: string | null;
  firstRegistrationDate: string | null;
  mileage: number | null;
  transmission: string | null;
  accident: boolean | null;
  simpleRepair: boolean | null;
  waterlog: boolean | null;
  damages: InspectionDamageItem[];
  replacedParts: string[];
  fetchedAt: string;
}

export type InspectionConditionKey =
  | "clean"
  | "repair"
  | "replace"
  | "replaceRepair"
  | "notFound";

interface OpenRecordPayload {
  openData?: boolean;
  myAccidentCost?: number | null;
  otherAccidentCost?: number | null;
}

const INSPECTION_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Referer: "https://www.encar.com/",
  Origin: "https://www.encar.com",
  Accept: "application/json",
};

const cache = new Map<number, { data: InspectionSummary; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const INSPECTION_TIMEOUT_MS = 12000;

function buildInspectionCacheKey(car: Car) {
  return `${car.sourceId}|${car.priceWon}|${car.modifiedDate}|${car.hasInspection ? 1 : 0}`;
}

function parsePersistedSummary(raw: unknown): InspectionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<InspectionSummary>;
  if (!Number.isInteger(candidate.vehicleId) || typeof candidate.notFound !== "boolean") {
    return null;
  }
  return {
    vehicleId: candidate.vehicleId as number,
    notFound: Boolean(candidate.notFound),
    vin: candidate.vin ?? null,
    modelYear: candidate.modelYear ?? null,
    firstRegistrationDate: candidate.firstRegistrationDate ?? null,
    mileage: candidate.mileage ?? null,
    transmission: candidate.transmission ?? null,
    accident: candidate.accident ?? null,
    simpleRepair: candidate.simpleRepair ?? null,
    waterlog: candidate.waterlog ?? null,
    damages: Array.isArray(candidate.damages) ? candidate.damages : [],
    replacedParts: Array.isArray(candidate.replacedParts) ? candidate.replacedParts : [],
    fetchedAt: typeof candidate.fetchedAt === "string" ? candidate.fetchedAt : new Date(0).toISOString(),
  };
}

async function getCarById(carId: number) {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  const repo = AppDataSource.getRepository(Car);
  return repo.findOne({ where: { id: carId } });
}

function getConditionKey(summary: InspectionSummary): InspectionConditionKey {
  if (summary.notFound) return "notFound";

  const hasReplace = summary.replacedParts.length > 0;
  const hasRepair = summary.simpleRepair === true;

  if (hasReplace && hasRepair) return "replaceRepair";
  if (hasReplace) return "replace";
  if (hasRepair) return "repair";
  return "clean";
}

function normalizeDamageItem(item: InspectionOuterItem): InspectionDamageItem {
  const part = item.type?.title?.trim() || "Неизвестная деталь";
  const statuses = (item.statusTypes ?? [])
    .map((s) => s.title?.trim())
    .filter((x): x is string => Boolean(x));
  const attributes = (item.attributes ?? []).filter((x): x is string => Boolean(x));

  return { part, statuses, attributes };
}

function parseInspection(payload: InspectionPayload, vehicleId: number): InspectionSummary {
  const detail = payload.master?.detail;
  const damages = (payload.outers ?? []).map(normalizeDamageItem);
  const replacedParts = damages
    .filter((d) => d.statuses.some((s) => s.includes("교환") || s.includes("교체")))
    .map((d) => d.part);

  return {
    vehicleId,
    notFound: false,
    vin: detail?.vin?.trim() || null,
    modelYear: detail?.modelYear?.trim() || null,
    firstRegistrationDate: detail?.firstRegistrationDate ?? null,
    mileage: detail?.mileage ?? null,
    transmission: detail?.transmissionType?.title?.trim() || null,
    accident: payload.master?.accdient ?? null,
    simpleRepair: payload.master?.simpleRepair ?? null,
    waterlog: detail?.waterlog ?? null,
    damages,
    replacedParts,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getInspectionSummary(vehicleId: number): Promise<InspectionSummary> {
  const cached = cache.get(vehicleId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const response = await fetchWithTimeout(
    `https://api.encar.com/v1/readside/inspection/vehicle/${vehicleId}`,
    { headers: INSPECTION_HEADERS },
    INSPECTION_TIMEOUT_MS,
  );

  if (response.status === 404) {
    const notFoundPayload: InspectionSummary = {
      vehicleId,
      notFound: true,
      vin: null,
      modelYear: null,
      firstRegistrationDate: null,
      mileage: null,
      transmission: null,
      accident: null,
      simpleRepair: null,
      waterlog: null,
      damages: [],
      replacedParts: [],
      fetchedAt: new Date().toISOString(),
    };
    cache.set(vehicleId, { data: notFoundPayload, cachedAt: Date.now() });
    return notFoundPayload;
  }

  if (!response.ok) {
    throw new Error(`Inspection API returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as InspectionPayload;
  const parsed = parseInspection(payload, vehicleId);
  cache.set(vehicleId, { data: parsed, cachedAt: Date.now() });
  return parsed;
}

export async function getInspectionSummaryWithFallback(
  primaryVehicleId: number,
  fallbackIds: number[],
): Promise<InspectionSummary> {
  const candidates = [primaryVehicleId, ...fallbackIds].filter(
    (id, idx, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === idx,
  );

  let lastNotFound: InspectionSummary | null = null;
  for (const candidate of candidates) {
    const result = await getInspectionSummary(candidate);
    if (!result.notFound) return result;
    lastNotFound = result;
  }

  return (
    lastNotFound ?? {
      vehicleId: primaryVehicleId,
      notFound: true,
      vin: null,
      modelYear: null,
      firstRegistrationDate: null,
      mileage: null,
      transmission: null,
      accident: null,
      simpleRepair: null,
      waterlog: null,
      damages: [],
      replacedParts: [],
      fetchedAt: new Date().toISOString(),
    }
  );
}

export async function getInspectionSummaryWithCarCache(
  primaryVehicleId: number,
  fallbackIds: number[],
  carId: number | null,
): Promise<InspectionSummary> {
  if (carId == null) {
    return getInspectionSummaryWithFallback(primaryVehicleId, fallbackIds);
  }

  const car = await getCarById(carId);
  if (!car) {
    return getInspectionSummaryWithFallback(primaryVehicleId, fallbackIds);
  }

  const expectedCacheKey = buildInspectionCacheKey(car);
  const persisted = parsePersistedSummary(car.inspectionSummaryJson);
  if (persisted && car.inspectionCacheKey === expectedCacheKey) {
    if (!car.inspectionCondition) {
      car.inspectionCondition = getConditionKey(persisted);
      car.inspectionFetchedAt = car.inspectionFetchedAt ?? new Date();
      await AppDataSource.getRepository(Car).save(car);
    }
    return persisted;
  }

  const fresh = await getInspectionSummaryWithFallback(primaryVehicleId, fallbackIds);
  car.inspectionSummaryJson = fresh;
  car.inspectionCacheKey = expectedCacheKey;
  car.inspectionFetchedAt = new Date();
  car.inspectionCondition = getConditionKey(fresh);
  await AppDataSource.getRepository(Car).save(car);
  return fresh;
}

function getConditionFromOpenRecord(payload: OpenRecordPayload): InspectionConditionKey | null {
  const myAccidentCost =
    typeof payload.myAccidentCost === "number" && Number.isFinite(payload.myAccidentCost)
      ? payload.myAccidentCost
      : null;
  const otherAccidentCost =
    typeof payload.otherAccidentCost === "number" && Number.isFinite(payload.otherAccidentCost)
      ? payload.otherAccidentCost
      : null;

  if (myAccidentCost == null && otherAccidentCost == null) return null;
  const total = (myAccidentCost ?? 0) + (otherAccidentCost ?? 0);
  return total > 0 ? "repair" : "clean";
}

async function getEncarOpenRecordCondition(vehicleId: number): Promise<InspectionConditionKey | null> {
  const response = await fetchWithTimeout(
    `https://api.encar.com/v1/readside/record/vehicle/${vehicleId}/open`,
    { headers: INSPECTION_HEADERS },
    INSPECTION_TIMEOUT_MS,
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Open-record API returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as OpenRecordPayload;
  return getConditionFromOpenRecord(payload);
}

export async function getEncarOpenRecordConditionWithFallback(
  primaryVehicleId: number,
  fallbackIds: number[],
): Promise<InspectionConditionKey | null> {
  const candidates = [primaryVehicleId, ...fallbackIds].filter(
    (id, idx, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === idx,
  );

  for (const candidate of candidates) {
    try {
      const condition = await getEncarOpenRecordCondition(candidate);
      if (condition) return condition;
    } catch {
      // Continue to next candidate.
    }
  }

  return null;
}

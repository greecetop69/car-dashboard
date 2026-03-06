import { AppDataSource } from "./db/data-source.js";
import { Car } from "./db/entities/Car.js";
import { CarPriceHistory } from "./db/entities/CarPriceHistory.js";
import type { CarOrigin, ParsedCarRecord } from "./carSources.js";
import { getWonToEurRate } from "./fx.js";
import { getInspectionSummaryWithCarCache } from "./inspectionService.js";
import { In } from "typeorm";

const ENABLE_INSPECTION_BACKFILL_ON_READ = ["1", "true", "yes"].includes(
  (process.env.ENABLE_INSPECTION_BACKFILL_ON_READ ?? "").toLowerCase(),
);

export interface PriceHistoryRow {
  priceWon: number;
  recordedAt: string;
}

export interface CarRow {
  id: number;
  origin: CarOrigin;
  sourceId: string;
  isActive: boolean;
  isNew: boolean;
  isFavorite: boolean;
  year: number;
  mileageKm: number;
  price: number;
  priceWon: number;
  url: string;
  inspectionUrl: string;
  diagnosisUrl: string;
  accidentUrl: string;
  hasInspection: boolean;
  inspectionCondition: "clean" | "repair" | "replace" | "replaceRepair" | "notFound" | null;
  mainPhoto: string | null;
  photos: ParsedCarRecord["photos"];
  badge: string;
  modifiedDate: string;
  previousPriceWon: number | null;
  priceDeltaWon: number;
  priceTrend: "up" | "down" | "same";
  priceHistory: PriceHistoryRow[];
}

export interface CarsApiResponse {
  cars: CarRow[];
  meta: {
    count: number;
    minYear: number;
    maxYear: number;
    minMileage: number;
    maxMileage: number;
    minPrice: number;
    maxPrice: number;
  };
  updatedAt: string;
}

function toBoolFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "bigint") return value === 1n;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "y";
  }
  if (Buffer.isBuffer(value)) {
    const raw = value.toString("utf8").trim();
    return raw === "1";
  }
  return false;
}

function deriveInspectionCondition(rawSummary: unknown): CarRow["inspectionCondition"] {
  let normalized: unknown = rawSummary;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
      return null;
    }
  }
  if (!normalized || typeof normalized !== "object") return null;

  const summary = normalized as {
    notFound?: unknown;
    simpleRepair?: unknown;
    replacedParts?: unknown;
    myAccidentCnt?: unknown;
    accidentCnt?: unknown;
  };
  if (summary.notFound === true) return "notFound";
  const hasReplace = Array.isArray(summary.replacedParts) && summary.replacedParts.length > 0;
  const hasRepair = summary.simpleRepair === true;
  const rawAccidentCount =
    typeof summary.myAccidentCnt === "number"
      ? summary.myAccidentCnt
      : typeof summary.accidentCnt === "number"
        ? summary.accidentCnt
        : null;
  const hasAccidentCount = rawAccidentCount != null && Number.isFinite(rawAccidentCount);

  if (hasReplace && hasRepair) return "replaceRepair";
  if (hasReplace) return "replace";
  if (hasRepair) return "repair";
  if (hasAccidentCount) return rawAccidentCount > 0 ? "repair" : "clean";
  return "clean";
}

function getInspectionIdCandidatesFromRow(row: {
  source_id: string;
  url: string;
  main_photo: string | null;
}): number[] {
  const fromPhoto = row.main_photo?.match(/\/(\d+)_\d+\.(?:jpg|jpeg|png)/i)?.[1] ?? null;
  const fromUrl = row.url?.match(/\/detail\/(\d+)/i)?.[1] ?? null;
  const fromSource = row.source_id ?? null;

  return [fromPhoto, fromUrl, fromSource]
    .map((value) => Number(value))
    .filter((id, idx, arr) => Number.isInteger(id) && id > 0 && arr.indexOf(id) === idx);
}

export async function initializeDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

export async function runMigrations() {
  await initializeDatabase();
  await AppDataSource.runMigrations();
}

function dedupeParsedCarsByOriginSource(parsedCars: ParsedCarRecord[]) {
  const map = new Map<string, ParsedCarRecord>();
  for (const car of parsedCars) {
    map.set(`${car.origin}:${car.sourceId}`, car);
  }
  return [...map.values()];
}

export async function saveParsedCars(
  parsedCars: ParsedCarRecord[],
  options?: { deactivateOrigins?: CarOrigin[] },
) {
  await initializeDatabase();
  const syncSeenAt = new Date();
  const uniqueParsedCars = dedupeParsedCarsByOriginSource(parsedCars);
  const deactivateOrigins =
    options?.deactivateOrigins?.filter((item, idx, arr) => arr.indexOf(item) === idx) ??
    ["encar", "kbcha"];

  await AppDataSource.transaction(async (manager) => {
    const carRepo = manager.getRepository(Car);
    const historyRepo = manager.getRepository(CarPriceHistory);
    const seenKeys: string[] = [];

    for (const parsed of uniqueParsedCars) {
      seenKeys.push(`${parsed.origin}:${parsed.sourceId}`);
      let car = await carRepo.findOne({
        where: { origin: parsed.origin, sourceId: parsed.sourceId },
      });

      if (!car) {
        car = carRepo.create({
          origin: parsed.origin,
          sourceId: parsed.sourceId,
          year: parsed.year,
          mileageKm: parsed.mileageKm,
          priceWon: String(parsed.priceWon),
          url: parsed.url,
          inspectionUrl: parsed.inspectionUrl,
          diagnosisUrl: parsed.diagnosisUrl,
          accidentUrl: parsed.accidentUrl,
          hasInspection: parsed.hasInspection,
          inspectionCondition:
            parsed.inspectionCondition !== undefined ? parsed.inspectionCondition : null,
          mainPhoto: parsed.mainPhoto,
          photosJson: parsed.photos,
          badge: parsed.badge,
          modifiedDate: parsed.modifiedDate,
          isActive: true,
          isNew: true,
          isFavorite: false,
          lastSeenAt: syncSeenAt,
        });
      } else {
        car.origin = parsed.origin;
        car.year = parsed.year;
        car.mileageKm = parsed.mileageKm;
        car.priceWon = String(parsed.priceWon);
        car.url = parsed.url;
        car.inspectionUrl = parsed.inspectionUrl;
        car.diagnosisUrl = parsed.diagnosisUrl;
        car.accidentUrl = parsed.accidentUrl;
        car.hasInspection = parsed.hasInspection;
        if (parsed.inspectionCondition !== undefined) {
          car.inspectionCondition = parsed.inspectionCondition;
        }
        car.mainPhoto = parsed.mainPhoto;
        car.photosJson = parsed.photos;
        car.badge = parsed.badge;
        car.modifiedDate = parsed.modifiedDate;
        car.isActive = true;
        car.isNew = false;
        car.lastSeenAt = syncSeenAt;
      }

      car = await carRepo.save(car);

      const lastHistory = await historyRepo.findOne({
        where: { carId: car.id },
        order: { recordedAt: "DESC" },
      });

      if (!lastHistory || Number(lastHistory.priceWon) !== parsed.priceWon) {
        const history = historyRepo.create({
          carId: car.id,
          priceWon: String(parsed.priceWon),
        });
        await historyRepo.save(history);
      }
    }

    if (seenKeys.length > 0 && deactivateOrigins.length > 0) {
      await manager
        .createQueryBuilder()
        .update(Car)
        .set({ isActive: false })
        .where("origin IN (:...origins)", { origins: deactivateOrigins })
        .andWhere("CONCAT(origin, ':', source_id) NOT IN (:...seenKeys)", { seenKeys })
        .andWhere("is_active = :isActive", { isActive: true })
        .execute();
    }

    // Remove stale duplicate rows that are shown as "bought", when an active twin exists.
    // Fingerprint is per source + year + mileage + price.
    await manager.query(`
      DELETE c_inactive
      FROM cars c_inactive
      INNER JOIN cars c_active
        ON c_active.origin = c_inactive.origin
       AND c_active.year = c_inactive.year
       AND c_active.mileage_km = c_inactive.mileage_km
       AND c_active.price_won = c_inactive.price_won
       AND c_active.is_active = 1
      WHERE c_inactive.is_active = 0
        AND c_inactive.id <> c_active.id
        AND c_inactive.is_favorite = 0
    `);
  });
}

function buildMeta(cars: CarRow[]) {
  const years = cars.map((c) => c.year).filter(Boolean);
  const mileages = cars.map((c) => c.mileageKm);
  const prices = cars.map((c) => c.price);

  return {
    count: cars.length,
    minYear: years.length ? Math.min(...years) : 0,
    maxYear: years.length ? Math.max(...years) : 0,
    minMileage: mileages.length ? Math.min(...mileages) : 0,
    maxMileage: mileages.length ? Math.max(...mileages) : 0,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

export async function getCarsFromDb(): Promise<CarsApiResponse> {
  await initializeDatabase();
  const wonToEur = await getWonToEurRate();

  const carRepo = AppDataSource.getRepository(Car);
  const historyRepo = AppDataSource.getRepository(CarPriceHistory);

  const rows = await carRepo
    .createQueryBuilder("c")
    .select("c.id", "id")
    .addSelect("c.origin", "origin")
    .addSelect("c.source_id", "source_id")
    .addSelect("c.is_active", "is_active")
    .addSelect("c.is_new", "is_new")
    .addSelect("c.is_favorite", "is_favorite")
    .addSelect("c.year", "year")
    .addSelect("c.mileage_km", "mileage_km")
    .addSelect("c.price_won", "price_won")
    .addSelect("c.url", "url")
    .addSelect("c.inspection_url", "inspection_url")
    .addSelect("c.diagnosis_url", "diagnosis_url")
    .addSelect("c.accident_url", "accident_url")
    .addSelect("c.has_inspection", "has_inspection")
    .addSelect("c.inspection_condition", "inspection_condition")
    .addSelect("c.inspection_summary_json", "inspection_summary_json")
    .addSelect("c.main_photo", "main_photo")
    .addSelect("c.photos_json", "photos_json")
    .addSelect("c.badge", "badge")
    .addSelect("c.modified_date", "modified_date")
    .orderBy("c.price_won", "ASC")
    .addOrderBy("c.id", "ASC")
    .getRawMany<{
      id: number;
      origin: CarOrigin;
      source_id: string;
      is_active: number;
      is_new: number;
      is_favorite: number;
      year: number;
      mileage_km: number;
      price_won: string;
      url: string;
      inspection_url: string;
      diagnosis_url: string;
      accident_url: string;
      has_inspection: number;
      inspection_condition: "clean" | "repair" | "replace" | "replaceRepair" | "notFound" | null;
      inspection_summary_json: unknown;
      main_photo: string | null;
      photos_json: ParsedCarRecord["photos"] | string;
      badge: string;
      modified_date: string;
    }>();

  // Backfill inspection condition only for missing Encar rows.
  // If condition is already set in DB, no external requests are made.
  const missingEncarInspection = ENABLE_INSPECTION_BACKFILL_ON_READ
    ? rows.filter((row) => {
        const hasInspection = toBoolFlag(row.has_inspection);
        return row.origin === "encar" && hasInspection && row.inspection_condition == null;
      })
    : [];

  if (ENABLE_INSPECTION_BACKFILL_ON_READ && missingEncarInspection.length > 0) {
    const queue = [...missingEncarInspection];
    const workerCount = Math.min(3, queue.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          const candidates = getInspectionIdCandidatesFromRow(item);
          if (candidates.length === 0) continue;
          const [primaryVehicleId, ...fallbackIds] = candidates;
          try {
            await getInspectionSummaryWithCarCache(primaryVehicleId, fallbackIds, item.id);
          } catch {
            // Ignore one-off external/API failures and keep current DB value.
          }
        }
      }),
    );

    // Refresh condition for rows that were backfilled this request.
    for (const row of rows) {
      if (row.origin !== "encar" || row.inspection_condition != null) continue;
      const updated = await carRepo.findOne({
        where: { id: row.id },
        select: { inspectionCondition: true },
      });
      if (updated?.inspectionCondition != null) {
        row.inspection_condition = updated.inspectionCondition as CarRow["inspectionCondition"];
      }
    }
  }

  const carIds = rows.map((row) => row.id);
  const historyRows = carIds.length
    ? await historyRepo.find({
        where: { carId: In(carIds) },
        order: { carId: "ASC", recordedAt: "DESC" },
      })
    : [];

  const historyByCarId = new Map<number, PriceHistoryRow[]>();
  for (const history of historyRows) {
    const existing = historyByCarId.get(history.carId) ?? [];
    existing.push({
      priceWon: Number(history.priceWon),
      recordedAt: history.recordedAt.toISOString(),
    });
    historyByCarId.set(history.carId, existing);
  }

  const cars: CarRow[] = rows.map((row) => {
    const priceHistory = historyByCarId.get(row.id) ?? [];
    const previousPriceWon = priceHistory[1]?.priceWon ?? null;
    const currentPriceWon = Number(row.price_won);
    const priceDeltaWon =
      previousPriceWon == null ? 0 : currentPriceWon - previousPriceWon;
    const currentPriceEur = Math.round(currentPriceWon * wonToEur);
    const photos =
      typeof row.photos_json === "string"
        ? (JSON.parse(row.photos_json) as ParsedCarRecord["photos"])
        : (row.photos_json as ParsedCarRecord["photos"]);

    const inspectionCondition =
      row.inspection_condition ?? deriveInspectionCondition(row.inspection_summary_json);
    const hasInspection = toBoolFlag(row.has_inspection);

    return {
      id: row.id,
      origin: row.origin === "kbcha" ? "kbcha" : "encar",
      sourceId: row.source_id,
      isActive: toBoolFlag(row.is_active),
      isNew: toBoolFlag(row.is_new),
      isFavorite: toBoolFlag(row.is_favorite),
      year: row.year,
      mileageKm: row.mileage_km,
      price: currentPriceEur,
      priceWon: currentPriceWon,
      url: row.url,
      inspectionUrl: row.inspection_url,
      diagnosisUrl: row.diagnosis_url,
      accidentUrl: row.accident_url,
      hasInspection,
      inspectionCondition,
      mainPhoto: row.main_photo,
      photos,
      badge: row.badge,
      modifiedDate: row.modified_date,
      previousPriceWon,
      priceDeltaWon,
      priceTrend:
        priceDeltaWon > 0 ? "up" : priceDeltaWon < 0 ? "down" : "same",
      priceHistory,
    };
  });

  const maxUpdated = await carRepo
    .createQueryBuilder("c")
    .select("MAX(c.updated_at)", "updatedAt")
    .getRawOne<{ updatedAt: Date | null }>();

  return {
    cars,
    meta: buildMeta(cars),
    updatedAt: maxUpdated?.updatedAt
      ? new Date(maxUpdated.updatedAt).toISOString()
      : new Date(0).toISOString(),
  };
}

export async function setCarFavorite(carId: number, isFavorite: boolean) {
  await initializeDatabase();
  const carRepo = AppDataSource.getRepository(Car);
  const result = await carRepo.update({ id: carId }, { isFavorite });
  return result.affected === 1;
}

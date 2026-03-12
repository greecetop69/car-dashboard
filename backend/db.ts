import { AppDataSource } from "./db/data-source.js";
import { Car } from "./db/entities/Car.js";
import { CarPriceHistory } from "./db/entities/CarPriceHistory.js";
import {
    Notification,
    type NotificationType,
} from "./db/entities/Notification.js";
import type { CarOrigin, ParsedCarRecord } from "./carSources.js";
import { getWonToEurRate } from "./fx.js";
import {
    getInspectionSummaryWithCarCache,
    warmEncarInspectionCacheForCarIds,
} from "./inspectionService.js";
import {
    buildCarSoldNotification,
    buildNewCarNotification,
    buildPriceChangeNotification,
    buildPriceDropNotification,
    type PendingNotification,
} from "./notificationFactories.js";
import { sendTelegramNotifications } from "./telegram.js";
import { In, type EntityManager } from "typeorm";

const ENABLE_INSPECTION_BACKFILL_ON_READ = false;
const DEACTIVATION_GRACE_HOURS = 18;
const NOTIFICATION_RETENTION_DAYS = 3;

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
    inspectionCondition:
        | "clean"
        | "repair"
        | "replace"
        | "replaceRepair"
        | "notFound"
        | null;
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

export interface NotificationRow {
    id: number;
    type: NotificationType;
    carOrigin: CarOrigin | null;
    carSourceId: string | null;
    title: string;
    message: string;
    payload: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
}

export interface NotificationsApiResponse {
    items: NotificationRow[];
    unreadCount: number;
}

function toBoolFlag(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "bigint") return value === 1n;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return (
            normalized === "1" || normalized === "true" || normalized === "y"
        );
    }
    if (Buffer.isBuffer(value)) {
        const raw = value.toString("utf8").trim();
        return raw === "1";
    }
    return false;
}

function deriveInspectionCondition(
    rawSummary: unknown,
): CarRow["inspectionCondition"] {
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
    const hasReplace =
        Array.isArray(summary.replacedParts) &&
        summary.replacedParts.length > 0;
    const hasRepair = summary.simpleRepair === true;
    const rawAccidentCount =
        typeof summary.myAccidentCnt === "number"
            ? summary.myAccidentCnt
            : typeof summary.accidentCnt === "number"
              ? summary.accidentCnt
              : null;
    const hasAccidentCount =
        rawAccidentCount != null && Number.isFinite(rawAccidentCount);

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
    const fromPhoto =
        row.main_photo?.match(/\/(\d+)_\d+\.(?:jpg|jpeg|png)/i)?.[1] ?? null;
    const fromUrl = row.url?.match(/\/detail\/(\d+)/i)?.[1] ?? null;
    const fromSource = row.source_id ?? null;

    return [fromPhoto, fromUrl, fromSource]
        .map((value) => Number(value))
        .filter(
            (id, idx, arr) =>
                Number.isInteger(id) && id > 0 && arr.indexOf(id) === idx,
        );
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

function buildParsedCarKey(origin: CarOrigin, sourceId: string) {
    return `${origin}:${sourceId}`;
}

async function loadLatestHistoryPriceByCarId(
    manager: EntityManager,
    carIds: number[],
) {
    const uniqueCarIds = [
        ...new Set(carIds.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    const result = new Map<number, number>();
    if (uniqueCarIds.length === 0) return result;

    const placeholders = uniqueCarIds.map(() => "?").join(", ");
    const rows = await manager.query(
        `
      SELECT h.car_id AS carId, h.price_won AS priceWon
      FROM car_price_history h
      INNER JOIN (
        SELECT car_id, MAX(id) AS maxId
        FROM car_price_history
        WHERE car_id IN (${placeholders})
        GROUP BY car_id
      ) latest
        ON latest.maxId = h.id
    `,
        uniqueCarIds,
    );

    for (const row of rows as Array<{ carId: number; priceWon: string }>) {
        result.set(Number(row.carId), Number(row.priceWon));
    }
    return result;
}

function deliverTelegramAsync(items: PendingNotification[]) {
    if (items.length === 0) return;
    void sendTelegramNotifications(items).catch((error) => {
        console.error("[telegram] Failed to send notifications:", error);
    });
}

interface NotificationCarFallbackRow {
    origin: CarOrigin;
    sourceId: string;
    mainPhoto: string | null;
    url: string;
}

function buildNotificationCarPair(
    origin: CarOrigin | null,
    sourceId: string | null,
) {
    if (!origin || !sourceId) return null;
    return `${origin}:${sourceId}`;
}

async function loadNotificationCarFallbacks(
    pairs: string[],
): Promise<Map<string, { mainPhoto: string | null; url: string }>> {
    const uniquePairs = [...new Set(pairs)];
    const result = new Map<string, { mainPhoto: string | null; url: string }>();
    if (uniquePairs.length === 0) return result;

    const clauses = uniquePairs
        .map(() => "(origin = ? AND source_id = ?)")
        .join(" OR ");
    const params = uniquePairs.flatMap((pair) => {
        const [origin, sourceId] = pair.split(":");
        return [origin, sourceId];
    });

    const carRows = await AppDataSource.getRepository(Car).query(
        `SELECT origin, source_id AS sourceId, main_photo AS mainPhoto, url
     FROM cars
     WHERE ${clauses}`,
        params,
    );

    for (const car of carRows as NotificationCarFallbackRow[]) {
        result.set(`${car.origin}:${car.sourceId}`, {
            mainPhoto: car.mainPhoto,
            url: car.url,
        });
    }
    return result;
}

function enrichNotificationPayload(
    payloadJson: unknown,
    fallback?: { mainPhoto: string | null; url: string },
) {
    const payload =
        payloadJson && typeof payloadJson === "object"
            ? { ...(payloadJson as Record<string, unknown>) }
            : ({} as Record<string, unknown>);

    const hasMainPhoto =
        typeof payload.mainPhoto === "string" &&
        payload.mainPhoto.trim().length > 0;
    const hasUrl =
        typeof payload.url === "string" && payload.url.trim().length > 0;
    if (!hasMainPhoto && fallback?.mainPhoto)
        payload.mainPhoto = fallback.mainPhoto;
    if (!hasUrl && fallback?.url) payload.url = fallback.url;
    return Object.keys(payload).length > 0 ? payload : null;
}

export async function saveParsedCars(
    parsedCars: ParsedCarRecord[],
    options?: { deactivateOrigins?: CarOrigin[] },
) {
    await initializeDatabase();
    const syncSeenAt = new Date();
    const deactivateBefore = new Date(
        syncSeenAt.getTime() - DEACTIVATION_GRACE_HOURS * 60 * 60 * 1000,
    );
    const uniqueParsedCars = dedupeParsedCarsByOriginSource(parsedCars);
    const pendingNotificationsForDelivery: PendingNotification[] = [];
    const savedCarIdsForInspectionWarmup: number[] = [];
    const deactivateOrigins = options?.deactivateOrigins?.filter(
        (item, idx, arr) => arr.indexOf(item) === idx,
    ) ?? ["encar", "kbcha", "kcar"];

    await AppDataSource.transaction(async (manager) => {
        const carRepo = manager.getRepository(Car);
        const historyRepo = manager.getRepository(CarPriceHistory);
        const notificationRepo = manager.getRepository(Notification);
        const seenKeys = uniqueParsedCars.map((item) =>
            buildParsedCarKey(item.origin, item.sourceId),
        );
        const notificationsToInsert: PendingNotification[] = [];
        const existingCars = seenKeys.length
            ? await carRepo
                  .createQueryBuilder("c")
                  .where(
                      "CONCAT(c.origin, ':', c.source_id) IN (:...seenKeys)",
                      { seenKeys },
                  )
                  .getMany()
            : [];
        const existingCarsByKey = new Map(
            existingCars.map((item) => [
                buildParsedCarKey(item.origin, item.sourceId),
                item,
            ]),
        );
        const carsToSave: Car[] = [];

        for (const parsed of uniqueParsedCars) {
            const parsedKey = buildParsedCarKey(parsed.origin, parsed.sourceId);
            let car = existingCarsByKey.get(parsedKey) ?? null;
            const existed = Boolean(car);
            const previousPriceWon = car ? Number(car.priceWon) : null;

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
                        parsed.inspectionCondition !== undefined
                            ? parsed.inspectionCondition
                            : null,
                    mainPhoto: parsed.mainPhoto,
                    photosJson: parsed.photos,
                    badge: parsed.badge,
                    modifiedDate: parsed.modifiedDate,
                    isActive: true,
                    isNew: true,
                    isFavorite: false,
                    lastSeenAt: syncSeenAt,
                });

                notificationsToInsert.push(buildNewCarNotification(parsed));
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

                if (
                    existed &&
                    previousPriceWon != null &&
                    Number.isFinite(previousPriceWon) &&
                    parsed.priceWon < previousPriceWon
                ) {
                    notificationsToInsert.push(
                        buildPriceDropNotification(parsed, previousPriceWon),
                    );
                } else if (
                    existed &&
                    previousPriceWon != null &&
                    Number.isFinite(previousPriceWon) &&
                    parsed.priceWon > previousPriceWon
                ) {
                    notificationsToInsert.push(
                        buildPriceChangeNotification(parsed, previousPriceWon),
                    );
                }
            }
            carsToSave.push(car);
        }

        const savedCars = carsToSave.length
            ? await carRepo.save(carsToSave)
            : [];
        const parsedByKey = new Map(
            uniqueParsedCars.map((item) => [
                buildParsedCarKey(item.origin, item.sourceId),
                item,
            ]),
        );
        const savedCarIds = savedCars.map((item) => item.id);
        const lastHistoryPriceByCarId = await loadLatestHistoryPriceByCarId(
            manager,
            savedCarIds,
        );

        const historiesToInsert: CarPriceHistory[] = [];
        for (const car of savedCars) {
            savedCarIdsForInspectionWarmup.push(car.id);
            const parsed = parsedByKey.get(
                buildParsedCarKey(car.origin, car.sourceId),
            );
            if (!parsed) continue;

            const lastHistoryPriceWon = lastHistoryPriceByCarId.get(car.id);
            if (
                lastHistoryPriceWon == null ||
                lastHistoryPriceWon !== parsed.priceWon
            ) {
                historiesToInsert.push(
                    historyRepo.create({
                        carId: car.id,
                        priceWon: String(parsed.priceWon),
                    }),
                );
            }
        }

        if (historiesToInsert.length > 0) {
            await historyRepo.save(historiesToInsert);
        }

        if (seenKeys.length > 0 && deactivateOrigins.length > 0) {
            const toDeactivate = await carRepo
                .createQueryBuilder("c")
                .select([
                    "c.origin AS origin",
                    "c.source_id AS sourceId",
                    "c.price_won AS priceWon",
                    "c.url AS url",
                    "c.main_photo AS mainPhoto",
                ])
                .where("c.origin IN (:...origins)", {
                    origins: deactivateOrigins,
                })
                .andWhere(
                    "CONCAT(c.origin, ':', c.source_id) NOT IN (:...seenKeys)",
                    { seenKeys },
                )
                .andWhere("c.is_active = :isActive", { isActive: true })
                .andWhere(
                    "(c.last_seen_at IS NULL OR c.last_seen_at < :deactivateBefore)",
                    {
                        deactivateBefore,
                    },
                )
                .getRawMany<{
                    origin: CarOrigin;
                    sourceId: string;
                    priceWon: string;
                    url: string;
                    mainPhoto: string | null;
                }>();

            await manager
                .createQueryBuilder()
                .update(Car)
                .set({ isActive: false })
                .where("origin IN (:...origins)", {
                    origins: deactivateOrigins,
                })
                .andWhere(
                    "CONCAT(origin, ':', source_id) NOT IN (:...seenKeys)",
                    { seenKeys },
                )
                .andWhere("is_active = :isActive", { isActive: true })
                .andWhere(
                    "(last_seen_at IS NULL OR last_seen_at < :deactivateBefore)",
                    {
                        deactivateBefore,
                    },
                )
                .execute();

            for (const row of toDeactivate) {
                const priceWon = Number(row.priceWon);
                notificationsToInsert.push(
                    buildCarSoldNotification({
                        origin: row.origin,
                        sourceId: row.sourceId,
                        priceWon: Number.isFinite(priceWon) ? priceWon : null,
                        url: row.url,
                        mainPhoto: row.mainPhoto,
                    }),
                );
            }
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

        if (notificationsToInsert.length > 0) {
            await notificationRepo.save(
                notificationsToInsert.map((item) =>
                    notificationRepo.create({
                        type: item.type,
                        carOrigin: item.carOrigin,
                        carSourceId: item.carSourceId,
                        title: item.title,
                        message: item.message,
                        payloadJson: item.payloadJson,
                        isRead: false,
                        readAt: null,
                    }),
                ),
            );
            pendingNotificationsForDelivery.push(...notificationsToInsert);
        }
    });

    await warmEncarInspectionCacheForCarIds(savedCarIdsForInspectionWarmup);
    deliverTelegramAsync(pendingNotificationsForDelivery);
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
            inspection_condition:
                | "clean"
                | "repair"
                | "replace"
                | "replaceRepair"
                | "notFound"
                | null;
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
              return (
                  row.origin === "encar" &&
                  hasInspection &&
                  row.inspection_condition == null
              );
          })
        : [];

    if (
        ENABLE_INSPECTION_BACKFILL_ON_READ &&
        missingEncarInspection.length > 0
    ) {
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
                        await getInspectionSummaryWithCarCache(
                            primaryVehicleId,
                            fallbackIds,
                            item.id,
                        );
                    } catch {
                        // Ignore one-off external/API failures and keep current DB value.
                    }
                }
            }),
        );

        // Refresh condition for rows that were backfilled this request.
        for (const row of rows) {
            if (row.origin !== "encar" || row.inspection_condition != null)
                continue;
            const updated = await carRepo.findOne({
                where: { id: row.id },
                select: { inspectionCondition: true },
            });
            if (updated?.inspectionCondition != null) {
                row.inspection_condition =
                    updated.inspectionCondition as CarRow["inspectionCondition"];
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
            row.inspection_condition ??
            deriveInspectionCondition(row.inspection_summary_json);
        const hasInspection = toBoolFlag(row.has_inspection);

        return {
            id: row.id,
            origin:
                row.origin === "kbcha" || row.origin === "kcar"
                    ? row.origin
                    : "encar",
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
        .select("MAX(c.last_seen_at)", "updatedAt")
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
    if (isFavorite) {
        const result = await carRepo.update(
            { id: carId, isActive: true },
            { isFavorite: true },
        );
        if (result.affected === 1) return "ok" as const;

        const existing = await carRepo.findOne({
            where: { id: carId },
            select: { id: true, isActive: true },
        });
        if (!existing) return "notFound" as const;
        return "inactive" as const;
    }

    const result = await carRepo.update({ id: carId }, { isFavorite: false });
    return result.affected === 1 ? ("ok" as const) : ("notFound" as const);
}

export async function reactivateRecentlySeenInactiveCars(hours: number) {
    await initializeDatabase();
    const safeHours = Math.max(1, Math.floor(hours));
    const threshold = new Date(Date.now() - safeHours * 60 * 60 * 1000);
    // MySQL forbids UPDATE ... WHERE EXISTS(SELECT FROM same table).
    // Use UPDATE ... JOIN instead.
    const result = await AppDataSource.query(
        `
      UPDATE cars c_inactive
      INNER JOIN cars c_active
        ON c_active.origin = c_inactive.origin
       AND c_active.year = c_inactive.year
       AND c_active.mileage_km = c_inactive.mileage_km
       AND c_active.price_won = c_inactive.price_won
       AND c_active.is_active = 1
       AND c_active.id <> c_inactive.id
      SET c_inactive.is_active = 1,
          c_inactive.updated_at = CURRENT_TIMESTAMP
      WHERE c_inactive.is_active = 0
        AND c_inactive.last_seen_at IS NOT NULL
        AND c_inactive.last_seen_at >= ?
    `,
        [threshold],
    );

    return Number(result?.affectedRows ?? 0);
}

export async function deleteCarsAbovePrice(maxPriceWon: number) {
    await initializeDatabase();
    if (!Number.isFinite(maxPriceWon) || maxPriceWon <= 0) return 0;

    const result = await AppDataSource.createQueryBuilder()
        .delete()
        .from(Car)
        .where("price_won > :maxPriceWon", {
            maxPriceWon: Math.floor(maxPriceWon),
        })
        .andWhere("is_active = :isActive", { isActive: true })
        .execute();

    return result.affected ?? 0;
}

export async function reactivateFilteredOutKbchaCars(filter: {
    minYear?: number;
    maxYear?: number;
    maxMileageKm?: number;
    maxPriceWon?: number;
}) {
    await initializeDatabase();

    const minYear = Number.isFinite(filter.minYear)
        ? Number(filter.minYear)
        : null;
    const maxYear = Number.isFinite(filter.maxYear)
        ? Number(filter.maxYear)
        : null;
    const maxMileageKm = Number.isFinite(filter.maxMileageKm)
        ? Number(filter.maxMileageKm)
        : null;
    const maxPriceWon = Number.isFinite(filter.maxPriceWon)
        ? Number(filter.maxPriceWon)
        : null;

    if (
        minYear == null &&
        maxYear == null &&
        maxMileageKm == null &&
        maxPriceWon == null
    ) {
        return 0;
    }

    const whereOutside: string[] = [];
    const params: Record<string, number | string> = {
        origin: "kbcha",
        active: 0,
    };

    if (minYear != null) {
        whereOutside.push("year < :minYear");
        params.minYear = minYear;
    }
    if (maxYear != null) {
        whereOutside.push("year > :maxYear");
        params.maxYear = maxYear;
    }
    if (maxMileageKm != null) {
        whereOutside.push("mileage_km > :maxMileageKm");
        params.maxMileageKm = maxMileageKm;
    }
    if (maxPriceWon != null) {
        whereOutside.push("price_won > :maxPriceWon");
        params.maxPriceWon = maxPriceWon;
    }

    if (whereOutside.length === 0) return 0;

    const result = await AppDataSource.createQueryBuilder()
        .update(Car)
        .set({ isActive: true })
        .where("origin = :origin", params)
        .andWhere("is_active = :active", params)
        .andWhere(`(${whereOutside.join(" OR ")})`, params)
        .execute();

    return result.affected ?? 0;
}

export async function deactivateMissingPartialOriginCars(params: {
    origin: CarOrigin;
    seenSourceIds: string[];
    filter?: {
        minYear?: number;
        maxYear?: number;
        maxMileageKm?: number;
        maxPriceWon?: number;
    };
}) {
    await initializeDatabase();
    const { origin, filter } = params;
    const seenSourceIds = [...new Set(params.seenSourceIds.filter(Boolean))];
    if (seenSourceIds.length === 0) return 0;

    let affected = 0;
    const pendingNotificationsForDelivery: PendingNotification[] = [];
    await AppDataSource.transaction(async (manager) => {
        const notificationRepo = manager.getRepository(Notification);

        const qb = manager
            .createQueryBuilder()
            .from(Car, "c")
            .select([
                "c.origin AS origin",
                "c.source_id AS sourceId",
                "c.price_won AS priceWon",
                "c.url AS url",
                "c.main_photo AS mainPhoto",
            ])
            .where("c.origin = :origin", { origin })
            .andWhere("c.is_active = :isActive", { isActive: true })
            .andWhere("c.source_id NOT IN (:...seenSourceIds)", {
                seenSourceIds,
            });

        if (filter?.minYear != null)
            qb.andWhere("c.year >= :minYear", { minYear: filter.minYear });
        if (filter?.maxYear != null)
            qb.andWhere("c.year <= :maxYear", { maxYear: filter.maxYear });
        if (filter?.maxMileageKm != null) {
            qb.andWhere("c.mileage_km <= :maxMileageKm", {
                maxMileageKm: filter.maxMileageKm,
            });
        }
        if (filter?.maxPriceWon != null) {
            qb.andWhere("c.price_won <= :maxPriceWon", {
                maxPriceWon: filter.maxPriceWon,
            });
        }

        const toDeactivate = await qb.getRawMany<{
            origin: CarOrigin;
            sourceId: string;
            priceWon: string;
            url: string;
            mainPhoto: string | null;
        }>();

        const updateQb = manager
            .createQueryBuilder()
            .update(Car)
            .set({ isActive: false })
            .where("origin = :origin", { origin })
            .andWhere("is_active = :isActive", { isActive: true })
            .andWhere("source_id NOT IN (:...seenSourceIds)", {
                seenSourceIds,
            });

        if (filter?.minYear != null)
            updateQb.andWhere("year >= :minYear", { minYear: filter.minYear });
        if (filter?.maxYear != null)
            updateQb.andWhere("year <= :maxYear", { maxYear: filter.maxYear });
        if (filter?.maxMileageKm != null) {
            updateQb.andWhere("mileage_km <= :maxMileageKm", {
                maxMileageKm: filter.maxMileageKm,
            });
        }
        if (filter?.maxPriceWon != null) {
            updateQb.andWhere("price_won <= :maxPriceWon", {
                maxPriceWon: filter.maxPriceWon,
            });
        }

        const result = await updateQb.execute();
        affected = result.affected ?? 0;

        if (toDeactivate.length > 0) {
            const notifications = toDeactivate.map((row) =>
                buildCarSoldNotification({
                    origin: row.origin,
                    sourceId: row.sourceId,
                    priceWon: Number.isFinite(Number(row.priceWon))
                        ? Number(row.priceWon)
                        : null,
                    url: row.url,
                    mainPhoto: row.mainPhoto,
                }),
            );

            await notificationRepo.save(
                notifications.map((item) =>
                    notificationRepo.create({
                        ...item,
                        isRead: false,
                        readAt: null,
                    }),
                ),
            );
            pendingNotificationsForDelivery.push(...notifications);
        }
    });

    deliverTelegramAsync(pendingNotificationsForDelivery);

    return affected;
}

export async function getNotificationsFromDb(
    limit = 100,
): Promise<NotificationsApiResponse> {
    await initializeDatabase();
    const notificationRepo = AppDataSource.getRepository(Notification);
    const safeLimit = Math.max(1, Math.min(300, Number(limit) || 100));

    const rows = await notificationRepo.find({
        order: { createdAt: "DESC", id: "DESC" },
        take: safeLimit,
    });

    const unreadCount = await notificationRepo.count({
        where: { isRead: false },
    });

    const carPairs = rows
        .map((row) => buildNotificationCarPair(row.carOrigin, row.carSourceId))
        .filter((pair): pair is string => Boolean(pair));
    const carsByPair = await loadNotificationCarFallbacks(carPairs);

    return {
        items: rows.map((row) => {
            const key = buildNotificationCarPair(
                row.carOrigin,
                row.carSourceId,
            );
            const fallback = key ? carsByPair.get(key) : undefined;
            return {
                id: Number(row.id),
                type: row.type,
                carOrigin: row.carOrigin,
                carSourceId: row.carSourceId,
                title: row.title,
                message: row.message,
                payload: enrichNotificationPayload(row.payloadJson, fallback),
                isRead: toBoolFlag(row.isRead),
                createdAt: row.createdAt.toISOString(),
                readAt: row.readAt ? row.readAt.toISOString() : null,
            };
        }),
        unreadCount,
    };
}

export async function markNotificationsRead(ids: number[]): Promise<number> {
    await initializeDatabase();
    const notificationRepo = AppDataSource.getRepository(Notification);
    const uniqueIds = [
        ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (uniqueIds.length === 0) return 0;

    const result = await notificationRepo
        .createQueryBuilder()
        .update(Notification)
        .set({ isRead: true, readAt: new Date() })
        .where("id IN (:...ids)", { ids: uniqueIds })
        .andWhere("is_read = :isRead", { isRead: false })
        .execute();

    return result.affected ?? 0;
}

export async function pruneOldNotifications(
    days = NOTIFICATION_RETENTION_DAYS,
): Promise<number> {
    await initializeDatabase();
    const safeDays = Math.max(1, Math.floor(days));
    const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const result = await AppDataSource.createQueryBuilder()
        .delete()
        .from(Notification)
        .where("created_at < :threshold", { threshold })
        .execute();

    return result.affected ?? 0;
}

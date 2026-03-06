import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";
import { Notification } from "../db/entities/Notification.js";

interface HistoryRow {
  carId: number;
  origin: "encar" | "kbcha";
  sourceId: string;
  url: string;
  priceWon: number;
  recordedAt: Date;
}

function buildEventKey(row: HistoryRow, oldPriceWon: number, newPriceWon: number) {
  return `${row.origin}:${row.sourceId}:${oldPriceWon}->${newPriceWon}:${row.recordedAt.toISOString()}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return null;
}

async function run() {
  await AppDataSource.initialize();
  const notificationRepo = AppDataSource.getRepository(Notification);

  const existing = await notificationRepo.find({
    where: [{ type: "price_drop" }, { type: "price_change" }],
    select: {
      id: true,
      payloadJson: true,
    },
  });

  const existingKeys = new Set<string>();
  for (const row of existing) {
    const payload = toRecord(row.payloadJson);
    const eventKey = payload?.eventKey;
    if (typeof eventKey === "string" && eventKey.length > 0) {
      existingKeys.add(eventKey);
    }
  }

  const rawRows = await AppDataSource.query(
    `
      SELECT
        h.car_id AS carId,
        c.origin AS origin,
        c.source_id AS sourceId,
        c.url AS url,
        h.price_won AS priceWon,
        h.recorded_at AS recordedAt
      FROM car_price_history h
      INNER JOIN cars c ON c.id = h.car_id
      ORDER BY h.car_id ASC, h.recorded_at ASC, h.id ASC
    `,
  );

  const rows: HistoryRow[] = rawRows.map((row: Record<string, unknown>) => ({
    carId: Number(row.carId),
    origin: (row.origin === "kbcha" ? "kbcha" : "encar") as "encar" | "kbcha",
    sourceId: String(row.sourceId ?? ""),
    url: String(row.url ?? ""),
    priceWon: Number(row.priceWon ?? 0),
    recordedAt: new Date(String(row.recordedAt)),
  }));

  const toInsert: Notification[] = [];
  let prev: HistoryRow | null = null;
  for (const row of rows) {
    if (!prev || prev.carId !== row.carId) {
      prev = row;
      continue;
    }

    const oldPriceWon = prev.priceWon;
    const newPriceWon = row.priceWon;
    if (!Number.isFinite(oldPriceWon) || !Number.isFinite(newPriceWon) || oldPriceWon === newPriceWon) {
      prev = row;
      continue;
    }

    const deltaWon = newPriceWon - oldPriceWon;
    const eventKey = buildEventKey(row, oldPriceWon, newPriceWon);
    if (existingKeys.has(eventKey)) {
      prev = row;
      continue;
    }

    const isDrop = deltaWon < 0;
    const originLabel = row.origin === "kbcha" ? "KBCHA" : "ENCAR";
    const title = isDrop ? "Снижение цены" : "Изменение цены";
    const message = `${originLabel} #${row.sourceId}: ₩ ${oldPriceWon.toLocaleString("ru-RU")} → ₩ ${newPriceWon.toLocaleString("ru-RU")}`;

    toInsert.push(
      notificationRepo.create({
        type: isDrop ? "price_drop" : "price_change",
        carOrigin: row.origin,
        carSourceId: row.sourceId,
        title,
        message,
        payloadJson: {
          oldPriceWon,
          newPriceWon,
          deltaWon,
          historyRecordedAt: row.recordedAt.toISOString(),
          eventKey,
          url: row.url,
        },
        isRead: false,
        readAt: null,
      }),
    );
    existingKeys.add(eventKey);
    prev = row;
  }

  if (toInsert.length > 0) {
    await notificationRepo.save(toInsert);
  }

  console.log(`Backfilled price-change notifications: ${toInsert.length}`);
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

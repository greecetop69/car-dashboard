import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";

const sourceId = process.argv[2] ?? "27907443";

async function run() {
  await AppDataSource.initialize();
  const rows = await AppDataSource.query(
    `
      SELECT id, origin, source_id, is_active, updated_at, last_seen_at
      FROM cars
      WHERE source_id = ?
      ORDER BY updated_at DESC
    `,
    [sourceId],
  );
  const notifications = await AppDataSource.query(
    `
      SELECT id, type, car_origin, car_source_id, is_read, created_at
      FROM notifications
      WHERE car_source_id = ?
      ORDER BY created_at DESC
    `,
    [sourceId],
  );

  console.log(JSON.stringify({ sourceId, cars: rows, notifications }, null, 2));
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

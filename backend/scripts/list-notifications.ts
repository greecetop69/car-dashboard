import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";

async function run() {
  await AppDataSource.initialize();
  const rows = await AppDataSource.query(`
    SELECT
      id,
      type,
      car_origin AS carOrigin,
      car_source_id AS carSourceId,
      title,
      message,
      is_read AS isRead,
      created_at AS createdAt
    FROM notifications
    ORDER BY id ASC
  `);
  console.log(JSON.stringify(rows, null, 2));
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";

try {
  await AppDataSource.initialize();
  const migrations = await AppDataSource.runMigrations();
  console.log(`Migrations applied: ${migrations.length}`);
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

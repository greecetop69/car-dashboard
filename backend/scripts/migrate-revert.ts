import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";

try {
  await AppDataSource.initialize();
  const reverted = await AppDataSource.undoLastMigration();
  console.log("Last migration reverted", reverted ?? "");
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

import "dotenv/config";
import { reactivateFilteredOutKbchaCars } from "../db.js";
import { AppDataSource } from "../db/data-source.js";

async function run() {
  const restored = await reactivateFilteredOutKbchaCars({
    minYear: 2017,
    maxYear: 2020,
    maxMileageKm: 130000,
    maxPriceWon: 14000000,
  });
  console.log(`Restored KBCHA cars outside filter: ${restored}`);
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

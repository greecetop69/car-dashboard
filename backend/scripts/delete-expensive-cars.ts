import "dotenv/config";
import { deleteCarsAbovePrice } from "../db.js";
import { AppDataSource } from "../db/data-source.js";

const maxPriceWon = Number(process.argv[2] ?? 14500000);

async function run() {
  const deleted = await deleteCarsAbovePrice(maxPriceWon);
  console.log(`Deleted cars above ₩ ${maxPriceWon.toLocaleString("ru-RU")}: ${deleted}`);
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

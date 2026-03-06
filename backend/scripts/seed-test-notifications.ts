import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";
import { Notification } from "../db/entities/Notification.js";

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Notification);

  await repo.save([
    repo.create({
      type: "price_drop",
      carOrigin: "encar",
      carSourceId: "41525836",
      title: "Снижение цены",
      message: "ENCAR #41525836: ₩ 13 200 000 → ₩ 12 990 000",
      payloadJson: {
        oldPriceWon: 13_200_000,
        newPriceWon: 12_990_000,
        deltaWon: 210_000,
      },
      isRead: false,
      readAt: null,
    }),
    repo.create({
      type: "car_sold",
      carOrigin: "kbcha",
      carSourceId: "27884485",
      title: "Машина помечена как купленная",
      message: "KBCHA #27884485 помечена как купленная",
      payloadJson: {
        priceWon: 14_500_000,
      },
      isRead: false,
      readAt: null,
    }),
  ]);

  console.log("Seeded 2 test notifications");
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

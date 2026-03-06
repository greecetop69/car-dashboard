import "dotenv/config";
import { AppDataSource } from "../db/data-source.js";
import { Notification } from "../db/entities/Notification.js";

const keepIds = (process.argv[2] ?? "6,7")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Notification);

  if (keepIds.length === 0) {
    const result = await repo.delete({});
    console.log(`Deleted all notifications: ${result.affected ?? 0}`);
    return;
  }

  const result = await repo
    .createQueryBuilder()
    .delete()
    .where("id NOT IN (:...ids)", { ids: keepIds })
    .execute();

  console.log(`Deleted notifications: ${result.affected ?? 0}, kept ids: ${keepIds.join(", ")}`);
}

try {
  await run();
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

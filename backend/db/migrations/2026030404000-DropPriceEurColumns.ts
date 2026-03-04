import { MigrationInterface, QueryRunner } from "typeorm";

export class DropPriceEurColumns2026030404000 implements MigrationInterface {
  name = "DropPriceEurColumns2026030404000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const carHistoryHasPriceEur = await queryRunner.hasColumn("car_price_history", "price_eur");
    if (carHistoryHasPriceEur) {
      await queryRunner.dropColumn("car_price_history", "price_eur");
    }

    const carsHasPriceEur = await queryRunner.hasColumn("cars", "price_eur");
    if (carsHasPriceEur) {
      await queryRunner.dropColumn("cars", "price_eur");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const carsHasPriceEur = await queryRunner.hasColumn("cars", "price_eur");
    if (!carsHasPriceEur) {
      await queryRunner.query("ALTER TABLE `cars` ADD `price_eur` int NOT NULL DEFAULT 0");
    }

    const carHistoryHasPriceEur = await queryRunner.hasColumn("car_price_history", "price_eur");
    if (!carHistoryHasPriceEur) {
      await queryRunner.query("ALTER TABLE `car_price_history` ADD `price_eur` int NOT NULL DEFAULT 0");
    }
  }
}

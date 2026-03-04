import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class InitCarsAndPriceHistory2026030401000 implements MigrationInterface {
  name = "InitCarsAndPriceHistory2026030401000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "cars",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "source_id", type: "varchar", length: "32", isNullable: false },
          { name: "year", type: "int", isNullable: false },
          { name: "mileage_km", type: "int", isNullable: false },
          { name: "price_eur", type: "int", isNullable: false },
          { name: "price_won", type: "bigint", isNullable: false },
          { name: "url", type: "varchar", length: "255", isNullable: false },
          { name: "inspection_url", type: "varchar", length: "255", isNullable: false },
          { name: "diagnosis_url", type: "varchar", length: "255", isNullable: false },
          { name: "accident_url", type: "varchar", length: "255", isNullable: false },
          { name: "has_inspection", type: "boolean", isNullable: false },
          { name: "main_photo", type: "varchar", length: "255", isNullable: true },
          { name: "photos_json", type: "json", isNullable: false },
          { name: "badge", type: "varchar", length: "255", isNullable: false },
          { name: "modified_date", type: "varchar", length: "64", isNullable: false },
          {
            name: "updated_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [
          new TableIndex({
            name: "uq_cars_source_id",
            columnNames: ["source_id"],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "car_price_history",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "car_id", type: "int", isNullable: false },
          { name: "price_eur", type: "int", isNullable: false },
          { name: "price_won", type: "bigint", isNullable: false },
          {
            name: "recorded_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [
          new TableIndex({
            name: "idx_car_recorded",
            columnNames: ["car_id", "recorded_at"],
          }),
        ],
      }),
      true,
    );

    const historyTable = await queryRunner.getTable("car_price_history");
    const hasFk = historyTable?.foreignKeys.some((item) => item.name === "fk_price_history_car");
    if (!hasFk) {
      await queryRunner.createForeignKey(
        "car_price_history",
        new TableForeignKey({
          name: "fk_price_history_car",
          columnNames: ["car_id"],
          referencedTableName: "cars",
          referencedColumnNames: ["id"],
          onDelete: "CASCADE",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("car_price_history");
    const fk = table?.foreignKeys.find((item) => item.name === "fk_price_history_car");
    if (fk) {
      await queryRunner.dropForeignKey("car_price_history", fk);
    }

    await queryRunner.dropTable("car_price_history", true);
    await queryRunner.dropTable("cars", true);
  }
}

import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddCarOrigin2026030501000 implements MigrationInterface {
  name = "AddCarOrigin2026030501000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOrigin = await queryRunner.hasColumn("cars", "origin");
    if (!hasOrigin) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "origin",
          type: "varchar",
          length: "16",
          isNullable: false,
          default: "'encar'",
        }),
      );
    }

    await queryRunner.query("UPDATE cars SET origin = 'encar' WHERE origin IS NULL OR origin = ''");

    const table = await queryRunner.getTable("cars");
    const oldUnique = table?.indices.find((idx) => idx.name === "uq_cars_source_id");
    if (oldUnique) {
      await queryRunner.dropIndex("cars", oldUnique);
    }

    const refreshed = await queryRunner.getTable("cars");
    const hasComposite = refreshed?.indices.some((idx) => idx.name === "uq_cars_origin_source_id");
    if (!hasComposite) {
      await queryRunner.createIndex(
        "cars",
        new TableIndex({
          name: "uq_cars_origin_source_id",
          columnNames: ["origin", "source_id"],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cars");
    const composite = table?.indices.find((idx) => idx.name === "uq_cars_origin_source_id");
    if (composite) {
      await queryRunner.dropIndex("cars", composite);
    }

    const refreshed = await queryRunner.getTable("cars");
    const hasOld = refreshed?.indices.some((idx) => idx.name === "uq_cars_source_id");
    if (!hasOld) {
      await queryRunner.createIndex(
        "cars",
        new TableIndex({
          name: "uq_cars_source_id",
          columnNames: ["source_id"],
          isUnique: true,
        }),
      );
    }

    const hasOrigin = await queryRunner.hasColumn("cars", "origin");
    if (hasOrigin) {
      await queryRunner.dropColumn("cars", "origin");
    }
  }
}

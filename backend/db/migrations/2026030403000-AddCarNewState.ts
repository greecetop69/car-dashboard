import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCarNewState2026030403000 implements MigrationInterface {
  name = "AddCarNewState2026030403000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIsNew = await queryRunner.hasColumn("cars", "is_new");
    if (!hasIsNew) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "is_new",
          type: "boolean",
          isNullable: false,
          default: "false",
        }),
      );
    }

    const hasCreatedAt = await queryRunner.hasColumn("cars", "created_at");
    if (!hasCreatedAt) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "created_at",
          type: "datetime",
          isNullable: false,
          default: "CURRENT_TIMESTAMP",
        }),
      );
    }

    await queryRunner.query("UPDATE cars SET is_new = false WHERE is_new IS NULL");
    await queryRunner.query("UPDATE cars SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCreatedAt = await queryRunner.hasColumn("cars", "created_at");
    if (hasCreatedAt) {
      await queryRunner.dropColumn("cars", "created_at");
    }

    const hasIsNew = await queryRunner.hasColumn("cars", "is_new");
    if (hasIsNew) {
      await queryRunner.dropColumn("cars", "is_new");
    }
  }
}

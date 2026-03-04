import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCarActiveState2026030402000 implements MigrationInterface {
  name = "AddCarActiveState2026030402000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIsActive = await queryRunner.hasColumn("cars", "is_active");
    if (!hasIsActive) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "is_active",
          type: "boolean",
          isNullable: false,
          default: "true",
        }),
      );
    }

    const hasLastSeenAt = await queryRunner.hasColumn("cars", "last_seen_at");
    if (!hasLastSeenAt) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "last_seen_at",
          type: "datetime",
          isNullable: true,
        }),
      );
    }

    await queryRunner.query("UPDATE cars SET is_active = true WHERE is_active IS NULL");
    await queryRunner.query("UPDATE cars SET last_seen_at = COALESCE(last_seen_at, updated_at)");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLastSeenAt = await queryRunner.hasColumn("cars", "last_seen_at");
    if (hasLastSeenAt) {
      await queryRunner.dropColumn("cars", "last_seen_at");
    }

    const hasIsActive = await queryRunner.hasColumn("cars", "is_active");
    if (hasIsActive) {
      await queryRunner.dropColumn("cars", "is_active");
    }
  }
}

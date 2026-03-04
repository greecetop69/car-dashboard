import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddInspectionCacheColumns2026030406000 implements MigrationInterface {
  name = "AddInspectionCacheColumns2026030406000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSummary = await queryRunner.hasColumn("cars", "inspection_summary_json");
    if (!hasSummary) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "inspection_summary_json",
          type: "json",
          isNullable: true,
        }),
      );
    }

    const hasCacheKey = await queryRunner.hasColumn("cars", "inspection_cache_key");
    if (!hasCacheKey) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "inspection_cache_key",
          type: "varchar",
          length: "255",
          isNullable: true,
        }),
      );
    }

    const hasFetchedAt = await queryRunner.hasColumn("cars", "inspection_fetched_at");
    if (!hasFetchedAt) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "inspection_fetched_at",
          type: "datetime",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasFetchedAt = await queryRunner.hasColumn("cars", "inspection_fetched_at");
    if (hasFetchedAt) {
      await queryRunner.dropColumn("cars", "inspection_fetched_at");
    }

    const hasCacheKey = await queryRunner.hasColumn("cars", "inspection_cache_key");
    if (hasCacheKey) {
      await queryRunner.dropColumn("cars", "inspection_cache_key");
    }

    const hasSummary = await queryRunner.hasColumn("cars", "inspection_summary_json");
    if (hasSummary) {
      await queryRunner.dropColumn("cars", "inspection_summary_json");
    }
  }
}

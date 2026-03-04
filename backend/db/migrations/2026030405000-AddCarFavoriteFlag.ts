import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCarFavoriteFlag2026030405000 implements MigrationInterface {
  name = "AddCarFavoriteFlag2026030405000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIsFavorite = await queryRunner.hasColumn("cars", "is_favorite");
    if (!hasIsFavorite) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "is_favorite",
          type: "boolean",
          isNullable: false,
          default: "false",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasIsFavorite = await queryRunner.hasColumn("cars", "is_favorite");
    if (hasIsFavorite) {
      await queryRunner.dropColumn("cars", "is_favorite");
    }
  }
}

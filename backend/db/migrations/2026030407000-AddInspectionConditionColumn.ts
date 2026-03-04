import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddInspectionConditionColumn2026030407000 implements MigrationInterface {
  name = "AddInspectionConditionColumn2026030407000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCondition = await queryRunner.hasColumn("cars", "inspection_condition");
    if (!hasCondition) {
      await queryRunner.addColumn(
        "cars",
        new TableColumn({
          name: "inspection_condition",
          type: "varchar",
          length: "32",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCondition = await queryRunner.hasColumn("cars", "inspection_condition");
    if (hasCondition) {
      await queryRunner.dropColumn("cars", "inspection_condition");
    }
  }
}

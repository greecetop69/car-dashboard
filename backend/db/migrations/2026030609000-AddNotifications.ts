import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class AddNotifications2026030609000 implements MigrationInterface {
  name = "AddNotifications2026030609000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable("notifications");
    if (!exists) {
      await queryRunner.createTable(
        new Table({
          name: "notifications",
          columns: [
            {
              name: "id",
              type: "bigint",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
              isNullable: false,
            },
            {
              name: "type",
              type: "varchar",
              length: "32",
              isNullable: false,
            },
            {
              name: "car_origin",
              type: "varchar",
              length: "16",
              isNullable: true,
            },
            {
              name: "car_source_id",
              type: "varchar",
              length: "32",
              isNullable: true,
            },
            {
              name: "title",
              type: "varchar",
              length: "255",
              isNullable: false,
            },
            {
              name: "message",
              type: "varchar",
              length: "512",
              isNullable: false,
            },
            {
              name: "payload_json",
              type: "json",
              isNullable: true,
            },
            {
              name: "is_read",
              type: "tinyint",
              default: "0",
              isNullable: false,
            },
            {
              name: "read_at",
              type: "datetime",
              isNullable: true,
            },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              isNullable: false,
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              onUpdate: "CURRENT_TIMESTAMP",
              isNullable: false,
            },
          ],
        }),
      );
    }

    const table = await queryRunner.getTable("notifications");
    const hasReadIndex = table?.indices.some((idx) => idx.name === "idx_notifications_read");
    if (!hasReadIndex) {
      await queryRunner.createIndex(
        "notifications",
        new TableIndex({
          name: "idx_notifications_read",
          columnNames: ["is_read", "created_at"],
        }),
      );
    }

    const refreshed = await queryRunner.getTable("notifications");
    const hasSourceIndex = refreshed?.indices.some((idx) => idx.name === "idx_notifications_source");
    if (!hasSourceIndex) {
      await queryRunner.createIndex(
        "notifications",
        new TableIndex({
          name: "idx_notifications_source",
          columnNames: ["car_origin", "car_source_id"],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable("notifications");
    if (!exists) return;

    const table = await queryRunner.getTable("notifications");
    const readIndex = table?.indices.find((idx) => idx.name === "idx_notifications_read");
    if (readIndex) {
      await queryRunner.dropIndex("notifications", readIndex);
    }

    const refreshed = await queryRunner.getTable("notifications");
    const sourceIndex = refreshed?.indices.find((idx) => idx.name === "idx_notifications_source");
    if (sourceIndex) {
      await queryRunner.dropIndex("notifications", sourceIndex);
    }

    await queryRunner.dropTable("notifications");
  }
}

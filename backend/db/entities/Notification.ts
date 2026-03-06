import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NotificationType = "new_car" | "price_drop" | "price_change" | "car_sold";

@Entity({ name: "notifications" })
export class Notification {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "type", type: "varchar", length: 32 })
  type!: NotificationType;

  @Column({ name: "car_origin", type: "varchar", length: 16, nullable: true })
  carOrigin!: "encar" | "kbcha" | null;

  @Column({ name: "car_source_id", type: "varchar", length: 32, nullable: true })
  carSourceId!: string | null;

  @Column({ name: "title", type: "varchar", length: 255 })
  title!: string;

  @Column({ name: "message", type: "varchar", length: 512 })
  message!: string;

  @Column({ name: "payload_json", type: "json", nullable: true })
  payloadJson!: unknown | null;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ name: "read_at", type: "datetime", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}

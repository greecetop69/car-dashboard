import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { CarPriceHistory } from "./CarPriceHistory.js";

@Entity({ name: "cars" })
@Unique("uq_cars_source_id", ["sourceId"])
export class Car {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "source_id", type: "varchar", length: 32 })
  sourceId!: string;

  @Column({ name: "year", type: "int" })
  year!: number;

  @Column({ name: "mileage_km", type: "int" })
  mileageKm!: number;

  @Column({ name: "price_won", type: "bigint" })
  priceWon!: string;

  @Column({ name: "url", type: "varchar", length: 255 })
  url!: string;

  @Column({ name: "inspection_url", type: "varchar", length: 255 })
  inspectionUrl!: string;

  @Column({ name: "diagnosis_url", type: "varchar", length: 255 })
  diagnosisUrl!: string;

  @Column({ name: "accident_url", type: "varchar", length: 255 })
  accidentUrl!: string;

  @Column({ name: "has_inspection", type: "boolean" })
  hasInspection!: boolean;

  @Column({ name: "main_photo", type: "varchar", length: 255, nullable: true })
  mainPhoto!: string | null;

  @Column({ name: "photos_json", type: "json" })
  photosJson!: unknown;

  @Column({ name: "badge", type: "varchar", length: 255 })
  badge!: string;

  @Column({ name: "modified_date", type: "varchar", length: 64 })
  modifiedDate!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_seen_at", type: "datetime", nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: "is_new", type: "boolean", default: false })
  isNew!: boolean;

  @Column({ name: "is_favorite", type: "boolean", default: false })
  isFavorite!: boolean;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;

  @OneToMany(() => CarPriceHistory, (history) => history.car)
  priceHistory!: CarPriceHistory[];
}

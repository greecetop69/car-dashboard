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
@Unique("uq_cars_origin_source_id", ["origin", "sourceId"])
export class Car {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "source_id", type: "varchar", length: 32 })
  sourceId!: string;

  @Column({ name: "origin", type: "varchar", length: 16, default: "encar" })
  origin!: "encar" | "kbcha";

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

  @Column({ name: "inspection_summary_json", type: "json", nullable: true })
  inspectionSummaryJson!: unknown | null;

  @Column({ name: "inspection_cache_key", type: "varchar", length: 255, nullable: true })
  inspectionCacheKey!: string | null;

  @Column({ name: "inspection_fetched_at", type: "datetime", nullable: true })
  inspectionFetchedAt!: Date | null;

  @Column({ name: "inspection_condition", type: "varchar", length: 32, nullable: true })
  inspectionCondition!: string | null;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;

  @OneToMany(() => CarPriceHistory, (history) => history.car)
  priceHistory!: CarPriceHistory[];
}

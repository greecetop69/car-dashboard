import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import type { Relation } from "typeorm";

@Entity({ name: "car_price_history" })
@Index("idx_car_recorded", ["carId", "recordedAt"])
export class CarPriceHistory {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id!: string;

    @Column({ name: "car_id", type: "int" })
    carId!: number;

    @ManyToOne("Car", "priceHistory", { onDelete: "CASCADE" })
    @JoinColumn({ name: "car_id" })
    car!: Relation<unknown>;

    @Column({ name: "price_won", type: "bigint" })
    priceWon!: string;

    @CreateDateColumn({ name: "recorded_at", type: "datetime" })
    recordedAt!: Date;
}

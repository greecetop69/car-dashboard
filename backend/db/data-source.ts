import "reflect-metadata";
import { DataSource } from "typeorm";
import { Car } from "./entities/Car.js";
import { CarPriceHistory } from "./entities/CarPriceHistory.js";
import { InitCarsAndPriceHistory2026030401000 } from "./migrations/2026030401-InitCarsAndPriceHistory.js";
import { AddCarActiveState2026030402000 } from "./migrations/2026030402000-AddCarActiveState.js";
import { AddCarNewState2026030403000 } from "./migrations/2026030403000-AddCarNewState.js";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || "car_user",
  password: process.env.DB_PASSWORD || "car_password",
  database: process.env.DB_NAME || "car_dashboard",
  entities: [Car, CarPriceHistory],
  migrations: [
    InitCarsAndPriceHistory2026030401000,
    AddCarActiveState2026030402000,
    AddCarNewState2026030403000,
  ],
  synchronize: false,
  logging: false,
});

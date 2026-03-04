import "reflect-metadata";
import { DataSource } from "typeorm";
import { Car } from "./entities/Car.js";
import { CarPriceHistory } from "./entities/CarPriceHistory.js";
import { InitCarsAndPriceHistory2026030401000 } from "./migrations/2026030401-InitCarsAndPriceHistory.js";
import { AddCarActiveState2026030402000 } from "./migrations/2026030402000-AddCarActiveState.js";
import { AddCarNewState2026030403000 } from "./migrations/2026030403000-AddCarNewState.js";
import { DropPriceEurColumns2026030404000 } from "./migrations/2026030404000-DropPriceEurColumns.js";
import { AddCarFavoriteFlag2026030405000 } from "./migrations/2026030405000-AddCarFavoriteFlag.js";
import { AddInspectionCacheColumns2026030406000 } from "./migrations/2026030406000-AddInspectionCacheColumns.js";
import { AddInspectionConditionColumn2026030407000 } from "./migrations/2026030407000-AddInspectionConditionColumn.js";

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
    DropPriceEurColumns2026030404000,
    AddCarFavoriteFlag2026030405000,
    AddInspectionCacheColumns2026030406000,
    AddInspectionConditionColumn2026030407000,
  ],
  synchronize: false,
  logging: false,
});

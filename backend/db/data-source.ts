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
import { AddCarOrigin2026030501000 } from "./migrations/2026030501000-AddCarOrigin.js";

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

const connectionUrl = firstNonEmpty(
  process.env.DATABASE_URL,
  process.env.MYSQL_URL,
  process.env.MYSQL_PUBLIC_URL,
);

let host = firstNonEmpty(process.env.DB_HOST, process.env.MYSQLHOST) ?? "127.0.0.1";
let port = Number(firstNonEmpty(process.env.DB_PORT, process.env.MYSQLPORT) ?? 3306);
let username = firstNonEmpty(process.env.DB_USER, process.env.MYSQLUSER) ?? "car_user";
let password = firstNonEmpty(process.env.DB_PASSWORD, process.env.MYSQLPASSWORD) ?? "car_password";
let database = firstNonEmpty(process.env.DB_NAME, process.env.MYSQLDATABASE) ?? "car_dashboard";

if (connectionUrl) {
  try {
    const parsed = new URL(connectionUrl);
    host = parsed.hostname || host;
    port = parsed.port ? Number(parsed.port) : port;
    username = parsed.username ? decodeURIComponent(parsed.username) : username;
    password = parsed.password ? decodeURIComponent(parsed.password) : password;
    const parsedDbName = parsed.pathname.replace(/^\//, "").trim();
    if (parsedDbName) {
      database = parsedDbName;
    }
  } catch (error) {
    console.warn("Invalid database URL, fallback to DB_* variables", error);
  }
}

const sslEnabled = ["1", "true", "yes"].includes((process.env.DB_SSL ?? "").toLowerCase());
const sslRejectUnauthorized = ["1", "true", "yes"].includes(
  (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "").toLowerCase(),
);

export const AppDataSource = new DataSource({
  type: "mysql",
  host,
  port,
  username,
  password,
  database,
  ...(sslEnabled ? { ssl: { rejectUnauthorized: sslRejectUnauthorized } } : {}),
  entities: [Car, CarPriceHistory],
  migrations: [
    InitCarsAndPriceHistory2026030401000,
    AddCarActiveState2026030402000,
    AddCarNewState2026030403000,
    DropPriceEurColumns2026030404000,
    AddCarFavoriteFlag2026030405000,
    AddInspectionCacheColumns2026030406000,
    AddInspectionConditionColumn2026030407000,
    AddCarOrigin2026030501000,
  ],
  synchronize: false,
  logging: false,
});

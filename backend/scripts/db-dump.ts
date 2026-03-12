import "dotenv/config";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { escape, type RowDataPacket, type SqlValue } from "mysql2";
import mysql from "mysql2/promise";

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

type DbConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  sslEnabled: boolean;
};

type TableRow = RowDataPacket & {
  TABLE_NAME: string;
  TABLE_TYPE: "BASE TABLE" | "VIEW";
};

type CreateTableRow = RowDataPacket & {
  "Create Table": string;
};

type CreateViewRow = RowDataPacket & {
  "Create View": string;
};

type TriggerRow = RowDataPacket & {
  Trigger: string;
};

type CreateTriggerRow = RowDataPacket & {
  "SQL Original Statement": string;
};

type DumpDataRow = RowDataPacket & Record<string, SqlValue>;

function getDbConfig(): DbConfig {
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

  return {
    host,
    port,
    username,
    password,
    database,
    sslEnabled,
  };
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sqlIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function writeLine(stream: NodeJS.WritableStream, line = "") {
  stream.write(`${line}\n`);
}

function normalizeCreateStatement(statement: string, prefix: string) {
  return statement.replace(new RegExp(`^CREATE ${prefix}`, "i"), `CREATE ${prefix} IF NOT EXISTS`);
}

async function dumpWithMysqlClient(dbConfig: DbConfig, outputPath: string) {
  const args = [
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--user=${dbConfig.username}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--events",
    "--hex-blob",
    "--set-gtid-purged=OFF",
    dbConfig.database,
  ];

  if (dbConfig.sslEnabled) {
    args.splice(3, 0, "--ssl-mode=REQUIRED");
  }

  const output = createWriteStream(outputPath);

  await new Promise<void>((resolve, reject) => {
    const dump = spawn("mysqldump", args, {
      env: {
        ...process.env,
        MYSQL_PWD: dbConfig.password,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    dump.stdout.pipe(output);

    let stderr = "";
    dump.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    dump.on("error", (error) => {
      reject(error);
    });

    dump.on("close", (code) => {
      output.end();
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `mysqldump exited with code ${code}`));
    });
  });
}

async function dumpWithMysqlDriver(dbConfig: DbConfig, outputPath: string) {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.sslEnabled ? { rejectUnauthorized: false } : undefined,
  });

  const output = createWriteStream(outputPath);

  try {
    writeLine(output, "-- Dump generated via mysql2 fallback");
    writeLine(output, `-- Database: ${dbConfig.database}`);
    writeLine(output, `-- Created at: ${new Date().toISOString()}`);
    writeLine(output);
    writeLine(output, "SET FOREIGN_KEY_CHECKS=0;");
    writeLine(output, "SET UNIQUE_CHECKS=0;");
    writeLine(output, "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';");
    writeLine(output);

    const [tables] = await connection.query<TableRow[]>(
      `
        SELECT TABLE_NAME, TABLE_TYPE
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_TYPE, TABLE_NAME
      `,
      [dbConfig.database],
    );

    for (const table of tables.filter((entry) => entry.TABLE_TYPE === "BASE TABLE")) {
      const tableName = table.TABLE_NAME;
      const [createTableRows] = await connection.query<CreateTableRow[]>(
        `SHOW CREATE TABLE ${sqlIdentifier(tableName)}`,
      );
      const createTableSql = createTableRows[0]?.["Create Table"];
      if (!createTableSql) {
        throw new Error(`Could not read CREATE TABLE for ${tableName}`);
      }

      writeLine(output, `DROP TABLE IF EXISTS ${sqlIdentifier(tableName)};`);
      writeLine(output, `${createTableSql};`);
      writeLine(output);

      const [rows] = await connection.query<DumpDataRow[]>(
        `SELECT * FROM ${sqlIdentifier(tableName)}`,
      );

      if (rows.length === 0) {
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnList = columns.map(sqlIdentifier).join(", ");
      const batchSize = 250;

      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        const valuesSql = batch
          .map((row) => {
            const values = columns.map((column) => escape(row[column]));
            return `(${values.join(", ")})`;
          })
          .join(",\n");

        writeLine(
          output,
          `INSERT INTO ${sqlIdentifier(tableName)} (${columnList}) VALUES\n${valuesSql};`,
        );
      }

      writeLine(output);
    }

    for (const view of tables.filter((entry) => entry.TABLE_TYPE === "VIEW")) {
      const viewName = view.TABLE_NAME;
      const [createViewRows] = await connection.query<CreateViewRow[]>(
        `SHOW CREATE VIEW ${sqlIdentifier(viewName)}`,
      );
      const createViewSql = createViewRows[0]?.["Create View"];
      if (!createViewSql) {
        throw new Error(`Could not read CREATE VIEW for ${viewName}`);
      }

      writeLine(output, `DROP VIEW IF EXISTS ${sqlIdentifier(viewName)};`);
      writeLine(output, `${normalizeCreateStatement(createViewSql, "VIEW")};`);
      writeLine(output);
    }

    const [triggerRows] = await connection.query<TriggerRow[]>(
      `
        SELECT TRIGGER_NAME AS \`Trigger\`
        FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = ?
        ORDER BY TRIGGER_NAME
      `,
      [dbConfig.database],
    );

    for (const trigger of triggerRows) {
      const [createTriggerRows] = await connection.query<CreateTriggerRow[]>(
        `SHOW CREATE TRIGGER ${sqlIdentifier(trigger.Trigger)}`,
      );
      const triggerSql = createTriggerRows[0]?.["SQL Original Statement"];
      if (!triggerSql) {
        continue;
      }

      writeLine(output, `DROP TRIGGER IF EXISTS ${sqlIdentifier(trigger.Trigger)};`);
      writeLine(output, `CREATE TRIGGER ${triggerSql};`);
      writeLine(output);
    }

    writeLine(output, "SET UNIQUE_CHECKS=1;");
    writeLine(output, "SET FOREIGN_KEY_CHECKS=1;");
  } finally {
    output.end();
    await connection.end();
  }
}

async function main() {
  const dbConfig = getDbConfig();
  const customOutputPath = process.argv[2];
  const outputDir = path.resolve(process.cwd(), "..", "db-dumps");
  const outputPath = customOutputPath
    ? path.resolve(process.cwd(), customOutputPath)
    : path.join(outputDir, `${dbConfig.database}-${getTimestamp()}.sql`);

  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await dumpWithMysqlClient(dbConfig, outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isMissingMysqlDump = message.includes("ENOENT") || message.includes("not recognized");
    if (!isMissingMysqlDump) {
      throw error;
    }

    console.warn("mysqldump not found in PATH, using mysql2 fallback dump.");
    await dumpWithMysqlDriver(dbConfig, outputPath);
  }

  console.log(`Database dump created: ${outputPath}`);
}

await main();

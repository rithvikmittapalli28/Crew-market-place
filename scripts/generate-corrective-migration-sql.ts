import { execSync } from "child_process";
import { Client } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const BASE_URL = process.env.DATABASE_URL || "postgresql://crewn_user:crewn_password@localhost:5432/crewn_db?schema=public";
const testDbName = "crewn_diff_gen_" + Date.now();
const adminUrl = new URL(BASE_URL);
adminUrl.pathname = "/postgres";
const testDbUrl = new URL(BASE_URL);
testDbUrl.pathname = "/" + testDbName;

async function main() {
  console.log("Creating temporary database for migration diff generation...");
  let client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch {
    adminUrl.pathname = new URL(BASE_URL).pathname;
    client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
  }
  await client.query(`CREATE DATABASE "${testDbName}"`);
  await client.end();

  try {
    console.log("Applying migrations 1, 2, 3...");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: testDbUrl.toString() },
      stdio: "ignore",
    });

    console.log("Diffing deployed DB against prisma/schema.prisma to generate forward SQL...");
    const sql = execSync(
      "npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script",
      {
        env: { ...process.env, DATABASE_URL: testDbUrl.toString() },
        encoding: "utf8",
      }
    );

    const outPath = path.join(process.cwd(), "docs", "corrective-migration-preview.sql");
    fs.writeFileSync(outPath, sql, "utf8");
    console.log(`Saved corrective migration SQL (${sql.split("\n").length} lines) to ${outPath}`);
  } finally {
    console.log("Cleaning up temporary database...");
    const cleanup = new Client({ connectionString: adminUrl.toString() });
    await cleanup.connect();
    await cleanup.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDbName}' AND pid <> pg_backend_pid()`);
    await cleanup.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await cleanup.end();
  }
}

main().catch(console.error);

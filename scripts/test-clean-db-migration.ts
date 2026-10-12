import { Client } from "pg";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.DATABASE_URL || "postgresql://crewn_user:crewn_password@localhost:5432/crewn_db?schema=public";
const parsed = new URL(BASE_URL);

// Base connection pointing to default 'postgres' or existing DB to execute CREATE DATABASE
const adminUrl = new URL(BASE_URL);
adminUrl.pathname = "/postgres";

const testDbName = "crewn_disposable_migration_test_" + Date.now();
const testDbUrl = new URL(BASE_URL);
testDbUrl.pathname = `/${testDbName}`;

async function main() {
  console.log(`1. Connecting to PostgreSQL to create clean disposable database: ${testDbName}...`);
  let client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (err: any) {
    console.log(`Note: connection to /postgres failed (${err.message}), trying default pathname...`);
    adminUrl.pathname = parsed.pathname;
    client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
  }

  try {
    // Terminate any old connections if exists & create DB
    await client.query(`CREATE DATABASE "${testDbName}"`);
    console.log(`✅ Clean database "${testDbName}" successfully created.`);
  } finally {
    await client.end();
  }

  try {
    console.log(`\n2. Running 'prisma migrate deploy' against clean database...`);
    const envWithTestDb = {
      ...process.env,
      DATABASE_URL: testDbUrl.toString(),
    };

    const deployOutput = execSync(`npx prisma migrate deploy`, {
      env: envWithTestDb,
      encoding: "utf8",
    });
    console.log("Migration deploy output:\n", deployOutput);

    console.log(`\n3. Checking schema diff between disposable DB and prisma/schema.prisma...`);
    const diffOutput = execSync(
      `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`,
      {
        env: envWithTestDb,
        encoding: "utf8",
      }
    );
    console.log("Migration diff output:\n", diffOutput || "(No difference detected!)");

    const isDriftFree = !diffOutput || diffOutput.includes("No difference detected");
    if (!isDriftFree) {
      throw new Error(`Schema drift detected on clean database after migrations!\nDiff:\n${diffOutput}`);
    }
    console.log("✅ Zero schema drift confirmed: clean database exactly matches prisma/schema.prisma!");

    console.log(`\n4. Inspecting _prisma_migrations and schema elements in disposable DB...`);
    const testDbClient = new Client({ connectionString: testDbUrl.toString() });
    await testDbClient.connect();
    const res = await testDbClient.query(`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at ASC`);
    console.log("Applied migrations in clean database:", res.rows);
    if (res.rows.length !== 4) {
      throw new Error(`Expected exactly 4 applied migrations, found ${res.rows.length}`);
    }

    const tablesRes = await testDbClient.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC`);
    console.log(`Total public tables created in clean DB: ${tablesRes.rows.length} (excluding internal tables)`);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log("Key tables present:", {
      BankAccount: tableNames.includes("BankAccount"),
      ModerationReport: tableNames.includes("ModerationReport"),
      InvoiceSequence: tableNames.includes("InvoiceSequence"),
      Contract: tableNames.includes("Contract"),
      Invoice: tableNames.includes("Invoice"),
      PaymentTransaction: tableNames.includes("PaymentTransaction"),
      Dispute: tableNames.includes("Dispute"),
    });

    const enumsRes = await testDbClient.query(`SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname ASC`);
    console.log(`Total enums created: ${enumsRes.rows.length}`);
    console.log("ModerationStatus enum exists:", enumsRes.rows.some(r => r.typname === "ModerationStatus"));

    await testDbClient.end();

    console.log(`\n✅ ALL 4 MIGRATIONS APPLIED SUCCESSFULLY AND REPRODUCED 100% PARITY ON CLEAN DATABASE!`);
  } finally {
    console.log(`\n5. Cleaning up: Dropping disposable test database "${testDbName}"...`);
    const cleanupClient = new Client({ connectionString: adminUrl.toString() });
    await cleanupClient.connect();
    try {
      await cleanupClient.query(`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
        WHERE datname = '${testDbName}' AND pid <> pg_backend_pid();
      `);
      await cleanupClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
      console.log(`✅ Disposable database "${testDbName}" successfully dropped.`);
    } catch (e: any) {
      console.error("Cleanup error:", e.message);
    } finally {
      await cleanupClient.end();
    }
  }
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

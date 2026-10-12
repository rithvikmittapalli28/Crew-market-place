import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolConfig } from "pg";

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "DATABASE_URL environment variable is required. Explicit configuration must be provided via environment variables or .env file."
    );
  }
  return url;
}

export function getDatabasePoolConfig(): PoolConfig {
  const connectionString = getDatabaseUrl();
  const maxConnections = process.env.DATABASE_POOL_MAX || process.env.PGMAXCONNECTIONS;
  const max = maxConnections ? parseInt(maxConnections, 10) : (process.env.NODE_ENV === "production" ? 20 : 10);
  const idleTimeoutMillis = process.env.DATABASE_POOL_IDLE_TIMEOUT
    ? parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT, 10)
    : 30000;
  const connectionTimeoutMillis = process.env.DATABASE_POOL_CONNECTION_TIMEOUT
    ? parseInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT, 10)
    : 5000;

  let ssl: PoolConfig["ssl"] = undefined;
  if (process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "1") {
    ssl = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true };
  }

  return {
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ...(ssl !== undefined ? { ssl } : {}),
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const poolConfig = getDatabasePoolConfig();
  const pool = globalForPrisma.pool ?? new Pool(poolConfig);
  pool.on("error", (err) => {
    console.error("[Database Pool Error] Unexpected error on idle client:", err.message);
  });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://crewn_user:crewn_password@localhost:5432/crewn_db?schema=public",
  },
});

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Read directly (not via env()) so `prisma generate` works without a
  // database URL, e.g. during the Docker build.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

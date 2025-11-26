import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations-mysql",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to configure the database?",
  );
}

// Create MySQL connection pool
export const pool = mysql.createPool(process.env.DATABASE_URL);

// Create Drizzle instance
export const db = drizzle(pool, { schema, mode: 'default' });

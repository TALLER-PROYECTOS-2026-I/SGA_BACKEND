import "dotenv/config";
import { AppError } from "../error";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export function getDb() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
    return drizzle(pool);
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(
        error.name,
        "INTERNAL_SERVER_ERROR",
        "No se pudo conectar a la base de datos",
      );
    }
  }
  return null;
}

import "dotenv/config";
import { AppError } from "../error";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

const app = express();

// Cargar el documento Swagger
const swaggerDocument = YAML.load(
  path.join(process.cwd(), "docs", "swagger.yml"),
);

// Montar la ruta de la documentación
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ... resto de la configuración de tus endpoints ...

app.listen(3000, () => {
  console.log("Servidor corriendo en el puerto 3000");
  console.log(
    "Documentación Swagger disponible en http://localhost:3000/api-docs",
  );
});

export function getDb() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
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

    throw new AppError(
      "DatabaseError",
      "INTERNAL_SERVER_ERROR",
      "No se pudo conectar a la base de datos",
    );
  }
}

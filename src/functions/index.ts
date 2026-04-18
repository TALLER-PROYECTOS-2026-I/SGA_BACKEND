import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { bootstrapApp } from "../lib/bootstrap";
import { app } from "@azure/functions";
import { AppError } from "../error";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { STATUS_CODES } from "../status-codes";

function loadControllers(dir: string) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadControllers(fullPath);
    } else if (file.endsWith(".controller.js") || file.endsWith(".js")) {
      require(fullPath);
    }
  }
}
const controllersDir = __dirname;
loadControllers(controllersDir);
bootstrapApp(app);

// health api
app.http("health", {
  methods: ["GET"],
  handler: async () => {
    try {
      const db = getDb();
      const response = await db!.execute(sql`SELECT version()`);
      return {
        status: STATUS_CODES.OK,
        jsonBody: {
          message: `Api healthy`,
          response,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        return error.toHttpResponse();
      } else {
        return {
          status: STATUS_CODES.INTERNAL_SERVER_ERROR,
          jsonBody: {
            code: "INTERAL_SERVER_ERROR",
            message: "Un error desconocido ha ocurrido",
          },
        };
      }
    }
  },
});

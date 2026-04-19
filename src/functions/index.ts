import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { bootstrapApp } from "../lib/bootstrap";
import { app, HttpResponseInit } from "@azure/functions";
import { AppError } from "../error";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { STATUS_CODES } from "../status-codes";

import "./uploadSignedSyllabus.js";
import "./viewSignedSyllabus.js";
import "./viewLatestSignedSyllabus.js";

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

app.http("health", {
  methods: ["GET"],
  handler: async (): Promise<HttpResponseInit> => {
    try {
      const db = getDb();
      const response = await db.execute(sql`SELECT version()`);

      return {
        status: STATUS_CODES.OK,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Api healthy",
          response,
        }),
      };
    } catch (error) {
      if (error instanceof AppError) {
        return error.toHttpResponse();
      }

      return {
        status: STATUS_CODES.INTERNAL_SERVER_ERROR,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "INTERNAL_SERVER_ERROR",
          message: "Un error desconocido ha ocurrido",
        }),
      };
    }
  },
});
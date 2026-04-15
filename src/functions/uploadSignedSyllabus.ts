import { app } from "@azure/functions";
import * as fs from "fs";
import * as path from "path";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

// Constants
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "silabos_firmados");

// Ensure upload directory exists
const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

// Validation functions
const validateFile = (file: any) => {
  if (!file) {
    throw new Error("Debe seleccionar un archivo PDF");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF");
  }

  return file as File;
};

const validateSilaboId = (silaboIdRaw: any) => {
  const silaboId = Number(silaboIdRaw);
  if (!Number.isFinite(silaboId) || silaboId <= 0) {
    throw new Error("Debe seleccionar una asignatura válida");
  }
  return silaboId;
};

const validateCiclo = (cicloRaw: any) => {
  const ciclo = String(cicloRaw ?? "").trim();
  if (!ciclo) {
    throw new Error("Debe seleccionar un ciclo");
  }
  return ciclo;
};

// File handling
const generateSafeFileName = (
  originalName: string,
  silaboId: number,
): string => {
  const sanitizedName = originalName.replace(/\s+/g, "_");
  return `${silaboId}_${Date.now()}_${sanitizedName}`;
};

const saveFile = async (file: File, fileName: string): Promise<string> => {
  const filePath = path.join(UPLOAD_DIR, fileName);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

// Database operations
const getSyllabus = async (db: any, silaboId: number) => {
  const result = await db.execute(sql`
    SELECT id, curso_codigo, curso_nombre
    FROM silabo
    WHERE id = ${silaboId}
    LIMIT 1
  `);

  if (!result.rows?.[0]) {
    throw new Error("Sílabo no encontrado");
  }

  return result.rows[0];
};

const saveSignedSyllabus = async (
  db: any,
  silaboId: number,
  ciclo: string,
  originalName: string,
  filePath: string,
) => {
  await db.execute(sql`
    INSERT INTO silabo_archivo_firmado (
      silabo_id,
      ciclo,
      nombre_archivo,
      ruta_archivo
    )
    VALUES (
      ${silaboId},
      ${ciclo},
      ${originalName},
      ${filePath}
    )
  `);
};

// Main handler
app.http("director_upload_signed_syllabus", {
  methods: ["POST"],
  route: "director/syllabi/upload-signed",
  authLevel: "anonymous",
  handler: async (req) => {
    try {
      // Initialize
      ensureUploadDir();

      // Parse form data
      const formData = await req.formData();
      const file = formData.get("file");
      const silaboIdRaw = formData.get("silaboId");
      const cicloRaw = formData.get("ciclo");

      // Validate inputs
      const validatedFile = validateFile(file);
      const silaboId = validateSilaboId(silaboIdRaw);
      const ciclo = validateCiclo(cicloRaw);

      // Get database connection
      const db = getDb();

      // Verify syllabus exists
      await getSyllabus(db, silaboId);

      // Save file
      const safeFileName = generateSafeFileName(validatedFile.name, silaboId);
      const filePath = await saveFile(validatedFile, safeFileName);

      // Save to database
      await saveSignedSyllabus(
        db,
        silaboId,
        ciclo,
        validatedFile.name,
        filePath,
      );

      // Return success response
      return {
        status: 200,
        jsonBody: {
          message: "Archivo subido correctamente",
          fileName: validatedFile.name,
          filePath,
        },
      };
    } catch (error) {
      console.error("Error subiendo sílabo firmado:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Error al subir archivo";
      const statusCode =
        errorMessage.includes("seleccionar") ||
        errorMessage.includes("válida") ||
        errorMessage.includes("encontrado")
          ? 400
          : 500;

      return {
        status: statusCode,
        jsonBody: { message: errorMessage },
      };
    }
  },
});

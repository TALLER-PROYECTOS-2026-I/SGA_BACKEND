
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

import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const connectionString = process.env.AzureWebJobsStorage;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

if (!connectionString) {
  throw new Error("Falta configurar AzureWebJobsStorage");
}

if (!containerName) {
  throw new Error("Falta configurar AZURE_STORAGE_CONTAINER_NAME");
}

const blobServiceClient =
  BlobServiceClient.fromConnectionString(connectionString);

type UploadFile = File & {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type DbLike = ReturnType<typeof getDb>;

const jsonResponse = (
  status: number,
  payload: Record<string, unknown>,
): HttpResponseInit => ({
  status,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const validateFile = (fileRaw: unknown): UploadFile => {
  if (!fileRaw) {
    throw new Error("Debe seleccionar un archivo PDF");
  }

  if (!(fileRaw instanceof File)) {
    throw new Error("El archivo enviado no es válido");
  }

  const fileName = String(fileRaw.name ?? "").trim();
  if (!fileName) {
    throw new Error("Debe seleccionar un archivo PDF");
  }

  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".pdf")) {
    throw new Error("Solo se permiten archivos PDF");
  }

  if (fileRaw.type && fileRaw.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF");
  }

  return fileRaw as UploadFile;
};

const validateSilaboId = (silaboIdRaw: unknown): number => {
  const silaboId = Number(String(silaboIdRaw ?? "").trim());

  if (!Number.isFinite(silaboId) || silaboId <= 0) {
    throw new Error("Debe seleccionar una asignatura válida");
  }

  return silaboId;
};

const validateCiclo = (cicloRaw: unknown): string => {
  const ciclo = String(cicloRaw ?? "").trim();

  if (!ciclo) {
    throw new Error("Debe seleccionar un ciclo");
  }

  return ciclo;
};

const validatePdfSignature = (arrayBuffer: ArrayBuffer): void => {
  const bytes = new Uint8Array(arrayBuffer);
  const header = String.fromCharCode(...bytes.slice(0, 5));

  if (header !== "%PDF-") {
    throw new Error("El archivo no es un PDF válido");
  }
};

const getSyllabus = async (db: DbLike, silaboId: number) => {

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

  db: DbLike,
  silaboId: number,
  ciclo: string,
  blobName: string,
  url: string,
) => {
  console.log("Guardando en BD:", {
    silaboId,
    ciclo,
    blobName,
    url,
  });


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

      ${blobName},
      ${url}
    )
  `);

  console.log("Registro insertado correctamente en silabo_archivo_firmado");
};


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

  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const formData = await req.formData();

      const fileRaw = formData.get("file");
      const silaboIdRaw = formData.get("silaboId");
      const cicloRaw = formData.get("ciclo");

      const file = validateFile(fileRaw);
      const silaboId = validateSilaboId(silaboIdRaw);
      const ciclo = validateCiclo(cicloRaw);

      const arrayBuffer = await file.arrayBuffer();
      validatePdfSignature(arrayBuffer);

      console.log("Archivo recibido:", {
        name: file.name,
        type: file.type,
        size: file.size,
        silaboId,
        ciclo,
      });

      const db = getDb();
      await getSyllabus(db, silaboId);

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      await containerClient.createIfNotExists();

      const safeOriginalName = String(file.name).replace(/\s+/g, "_");
      const blobName = `silabo-${silaboId}-${Date.now()}-${safeOriginalName}`;

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const buffer = Buffer.from(arrayBuffer);

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: "application/pdf",
        },
      });

      const fileUrl = blockBlobClient.url;

      await saveSignedSyllabus(db, silaboId, ciclo, blobName, fileUrl);

      console.log("Respuesta final upload:", {
        fileName: file.name,
        blobName,
        fileUrl,
      });

      return jsonResponse(200, {
        message: "Archivo subido correctamente",
        fileName: file.name,
        blobName,
        url: fileUrl,
      });
    } catch (error) {
      console.error("Error subiendo sílabo firmado:", error);

      const message =
        error instanceof Error ? error.message : "Error al subir archivo";

      const knownErrors = new Set([
        "Debe seleccionar un archivo PDF",
        "El archivo enviado no es válido",
        "Solo se permiten archivos PDF",
        "Debe seleccionar una asignatura válida",
        "Debe seleccionar un ciclo",
        "Sílabo no encontrado",
        "El archivo no es un PDF válido",
      ]);

      return jsonResponse(knownErrors.has(message) ? 400 : 500, {
        message,
      });
    }
  },
});


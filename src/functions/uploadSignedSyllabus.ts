import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

// Azure config
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

// Validation functions
const validateFile = (file: any) => {
  if (!file) {
    throw new Error("Debe seleccionar un archivo PDF");
  }

  if (typeof file !== "object") {
    throw new Error("El archivo enviado no es válido");
  }

  const fileName = String(file.name ?? "").toLowerCase();

  if (!fileName) {
    throw new Error("Debe seleccionar un archivo PDF");
  }

  if (!fileName.endsWith(".pdf")) {
    throw new Error("Solo se permiten archivos PDF");
  }

  return file;
};

const validateSilaboId = (silaboIdRaw: any) => {
  const silaboId = Number(String(silaboIdRaw ?? "").trim());

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

// DB helpers
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
  url: string,
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
      ${url}
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
      const formData = await req.formData();

      const fileRaw = formData.get("file");
      const silaboIdRaw = formData.get("silaboId");
      const cicloRaw = formData.get("ciclo");

      const file = validateFile(fileRaw);
      const silaboId = validateSilaboId(silaboIdRaw);
      const ciclo = validateCiclo(cicloRaw);

      console.log("fileRaw:", fileRaw);
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

      const buffer = Buffer.from(await file.arrayBuffer());

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: "application/pdf",
        },
      });

      const fileUrl = blockBlobClient.url;

      await saveSignedSyllabus(db, silaboId, ciclo, file.name, fileUrl);

      return {
        status: 200,
        jsonBody: {
          message: "Archivo subido correctamente",
          fileName: file.name,
          url: fileUrl,
        },
      };
    } catch (error) {
      console.error("Error subiendo sílabo firmado:", error);

      const message =
        error instanceof Error ? error.message : "Error al subir archivo";

      return {
        status: 400,
        jsonBody: { message },
      };
    }
  },
});

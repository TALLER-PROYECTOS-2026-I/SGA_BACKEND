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

type DbLike = ReturnType<typeof getDb>;

type LatestSignedRow = {
  id: number;
  nombre_archivo: string;
};

const jsonResponse = (
  status: number,
  message: string,
): HttpResponseInit => ({
  status,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message }),
});

const streamToBuffer = async (
  stream: NodeJS.ReadableStream,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const validateSilaboId = (idRaw: unknown): number => {
  const id = Number(String(idRaw ?? "").trim());

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Id de sílabo inválido");
  }

  return id;
};

const getLatestSignedSyllabus = async (
  db: DbLike,
  silaboId: number,
): Promise<LatestSignedRow> => {
  const result = await db.execute(sql`
    SELECT id, nombre_archivo
    FROM silabo_archivo_firmado
    WHERE silabo_id = ${silaboId}
    ORDER BY id DESC
    LIMIT 1
  `);

  if (!result.rows?.[0]) {
    throw new Error("No existe PDF firmado para este sílabo");
  }

  return result.rows[0] as LatestSignedRow;
};

app.http("director_view_latest_signed_syllabus", {
  methods: ["GET"],
  route: "director/syllabi/{silaboId}/signed/latest",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const silaboId = validateSilaboId(req.params.silaboId);

      const db = getDb();
      const archivo = await getLatestSignedSyllabus(db, silaboId);

      const blobName = String(archivo.nombre_archivo ?? "").trim();

      if (!blobName) {
        return jsonResponse(
          404,
          "El archivo no tiene un nombre de blob válido",
        );
      }

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const exists = await blockBlobClient.exists();

      if (!exists) {
        return jsonResponse(404, "El archivo PDF no existe en Blob Storage");
      }

      const downloadResponse = await blockBlobClient.download();

      if (!downloadResponse.readableStreamBody) {
        return jsonResponse(500, "No se pudo leer el archivo PDF");
      }

      const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

      return {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${blobName}"`,
        },
        body: buffer,
      };
    } catch (error) {
      console.error("Error visualizando último sílabo firmado:", error);

      const message =
        error instanceof Error ? error.message : "Error al visualizar archivo";

      const knownErrors = new Set([
        "Id de sílabo inválido",
        "No existe PDF firmado para este sílabo",
      ]);

      return jsonResponse(knownErrors.has(message) ? 400 : 500, message);
    }
  },
});
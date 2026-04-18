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

type SignedSyllabusRow = {
  id: number;
  silabo_id: number;
  ciclo: string;
  nombre_archivo: string;
  ruta_archivo: string;
  fecha_subida: string | null;
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

const validateArchivoId = (idRaw: unknown): number => {
  const id = Number(String(idRaw ?? "").trim());

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Id de archivo inválido");
  }

  return id;
};

const getSignedSyllabusById = async (
  db: DbLike,
  archivoId: number,
): Promise<SignedSyllabusRow> => {
  const result = await db.execute(sql`
    SELECT
      id,
      silabo_id,
      ciclo,
      nombre_archivo,
      ruta_archivo,
      fecha_subida
    FROM silabo_archivo_firmado
    WHERE id = ${archivoId}
    LIMIT 1
  `);

  if (!result.rows?.[0]) {
    throw new Error("Archivo firmado no encontrado");
  }

  return result.rows[0] as SignedSyllabusRow;
};

app.http("director_view_signed_syllabus", {
  methods: ["GET"],
  route: "director/syllabi/signed/{id}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const archivoId = validateArchivoId(req.params.id);

      const db = getDb();
      const archivo = await getSignedSyllabusById(db, archivoId);

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
      console.error("Error visualizando sílabo firmado:", error);

      const message =
        error instanceof Error ? error.message : "Error al visualizar archivo";

      const knownErrors = new Set([
        "Id de archivo inválido",
        "Archivo firmado no encontrado",
      ]);

      return jsonResponse(knownErrors.has(message) ? 400 : 500, message);
    }
  },
});
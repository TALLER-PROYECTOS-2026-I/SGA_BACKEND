import { app } from "@azure/functions";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

app.http("syllabus_delete", {
  methods: ["DELETE"],
  route: "syllabus/{id}",
  authLevel: "anonymous",
  handler: async (req, ctx) => {
    try {
      const idParam = req.params.id;
      const syllabusId = Number(idParam);

      if (!Number.isFinite(syllabusId) || syllabusId <= 0) {
        return {
          status: 400,
          jsonBody: {
            message: "ID de sílabo inválido",
          },
        };
      }

      const db = getDb();

      const existing = await db.execute(sql`
        SELECT id
        FROM silabo
        WHERE id = ${syllabusId}
        LIMIT 1
      `);

      if (!existing.rows?.length) {
        return {
          status: 404,
          jsonBody: {
            message: "Sílabo no encontrado",
          },
        };
      }

      // Eliminar relaciones primero
      await db.execute(sql`
        DELETE FROM silabo_docente
        WHERE silabo_id = ${syllabusId}
      `);

      // Si existe historial o archivos importados, también los eliminamos
      await db.execute(sql`
        DELETE FROM silabo_archivo_firmado
        WHERE silabo_id = ${syllabusId}
      `);

      // Finalmente eliminar el sílabo
      await db.execute(sql`
        DELETE FROM silabo
        WHERE id = ${syllabusId}
      `);

      return {
        status: 200,
        jsonBody: {
          message: "Sílabo eliminado correctamente",
        },
      };
    } catch (error) {
      console.error("Error eliminando sílabo:", error);

      return {
        status: 500,
        jsonBody: {
          message: "Error al eliminar el sílabo",
        },
      };
    }
  },
});
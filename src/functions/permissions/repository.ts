import { getDb } from "../../db";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../drizzle/schema";
import { AppError } from "../../error";
import {
  silaboSeccionPermiso,
  docente,
} from "../../../drizzle/schema";

export class PermissionsRepository {
  private db: NodePgDatabase<typeof schema>;

  constructor() {
    const database = getDb();

    if (!database) {
      throw new AppError(
        "DbConnectionError",
        "INTERNAL_SERVER_ERROR",
        "DB no inicializada",
      );
    }

    this.db = database as unknown as NodePgDatabase<typeof schema>;
  }

  async findDocenteById(docenteId: number) {
    const result = await this.db
      .select()
      .from(docente)
      .where(eq(docente.id, docenteId));

    return result;
  }

  async findDocenteIdByCorreo(correo: string): Promise<number | null> {
    const email = String(correo ?? "")
      .trim()
      .toLowerCase();

    if (!email) return null;

    const result = await this.db
      .select({ id: docente.id })
      .from(docente)
      .where(eq(docente.correo, email))
      .limit(1);

    const id = Number(result[0]?.id);

    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async savePermissionsBySilaboIdAndDocenteId(
    silaboId: number,
    docenteId: number,
    permisos: Array<{ numeroSeccion: number }>,
  ) {
    await this.db
      .delete(silaboSeccionPermiso)
      .where(
        and(
          eq(silaboSeccionPermiso.silaboId, silaboId),
          eq(silaboSeccionPermiso.docenteId, docenteId),
        ),
      );

    // Si viene vacío, representa "Solo lectura".
    // No se inserta nada porque no hay secciones editables.
    if (!Array.isArray(permisos) || permisos.length === 0) {
      return [];
    }

    // Fecha actual + 20 días
    const fechaActual = new Date();
    const fechaLimite = new Date(fechaActual);

    fechaLimite.setDate(fechaActual.getDate() + 20);

    const permisosAInsertar = permisos.map((p) => ({
      silaboId: Number(silaboId),
      docenteId: Number(docenteId),
      numeroSeccion: Number(p.numeroSeccion),
      puedeEditar: true,
      puedeComentar: false,
      fechaLimite: fechaLimite.toISOString(),
      bloqueadoPorEstado: false,
    }));

    const insertados = await this.db
      .insert(silaboSeccionPermiso)
      .values(permisosAInsertar)
      .returning();

    return insertados;
  }

  async findPermissionsByDocenteId(docenteId: number) {
    const result = await this.db
      .select({
        numeroSeccion: silaboSeccionPermiso.numeroSeccion,
      })
      .from(silaboSeccionPermiso)
      .where(eq(silaboSeccionPermiso.docenteId, docenteId));

    return result;
  }

  async findEnabledSectionNumbers(
    docenteId: number,
    silaboId: number,
  ): Promise<number[]> {
    const now = new Date();

    const rows = await this.db
      .select({
        numeroSeccion: silaboSeccionPermiso.numeroSeccion,
        fechaLimite: silaboSeccionPermiso.fechaLimite,
        puedeEditar: silaboSeccionPermiso.puedeEditar,
        bloqueadoPorEstado: silaboSeccionPermiso.bloqueadoPorEstado,
      })
      .from(silaboSeccionPermiso)
      .where(
        and(
          eq(silaboSeccionPermiso.silaboId, Number(silaboId)),
          eq(silaboSeccionPermiso.docenteId, Number(docenteId)),
          eq(silaboSeccionPermiso.puedeEditar, true),
          eq(silaboSeccionPermiso.bloqueadoPorEstado, false),
        ),
      );

    return rows
      .filter((row) => {
        if (!row.fechaLimite) return true;

        const fechaLimite = new Date(row.fechaLimite);

        if (Number.isNaN(fechaLimite.getTime())) return true;

        return fechaLimite >= now;
      })
      .map((row) => Number(row.numeroSeccion))
      .filter((numeroSeccion) => Number.isFinite(numeroSeccion));
  }

  async findPermissionsByDocenteIdAndSilaboId(
    docenteId: number,
    silaboId: number,
  ) {
    const sections = await this.findEnabledSectionNumbers(docenteId, silaboId);

    return sections.map((numeroSeccion) => ({ numeroSeccion }));
  }
}

export const permissionsRepository = new PermissionsRepository();
import { and, asc, eq, ilike, isNull, SQL } from "drizzle-orm";
import { silabo, silaboDocente, docente } from "../../../drizzle/schema";
import { AppError } from "../../error";
import { BaseRepository } from "../../lib/repository";
import {
  SYLLABUS_ALREADY_ASSIGNED_MESSAGE,
  type CreateAssignmentPayload,
  type SilaboFilters,
  type SilaboListItem,
  type CourseSimple,
} from "./types";

const PENDING_ASSIGNMENT_ESTADO = "BORRADOR";

function pendingAssignmentConditions(): SQL[] {
  return [
    isNull(silaboDocente.docenteId),
    eq(silabo.estadoRevision, PENDING_ASSIGNMENT_ESTADO),
  ];
}

class AssignmentsRepository extends BaseRepository {
  async hasDocenteForSilabo(silaboId: number): Promise<boolean> {
    const rows = await this.db
      .select({ id: silaboDocente.id })
      .from(silaboDocente)
      .where(eq(silaboDocente.silaboId, silaboId))
      .limit(1);

    return rows.length > 0;
  }

  async getAll(filters?: SilaboFilters): Promise<SilaboListItem[]> {
    try {
      const conditions: any[] = [];

      if (filters?.codigo?.trim()) {
        conditions.push(
          ilike(silabo.cursoCodigo, `%${filters.codigo.trim()}%`),
        );
      }

      if (filters?.nombre?.trim()) {
        conditions.push(
          ilike(silabo.cursoNombre, `%${filters.nombre.trim()}%`),
        );
      }

      if (filters?.idSilabo !== undefined) {
        conditions.push(eq(silabo.id, Number(filters.idSilabo)));
      }

      if (filters?.sinAsignar) {
        conditions.push(...pendingAssignmentConditions());
      } else if (filters?.idDocente !== undefined) {
        conditions.push(eq(silaboDocente.docenteId, Number(filters.idDocente)));
      }

      if (filters?.areaCurricular !== undefined) {
        conditions.push(eq(silabo.areaCurricular, filters.areaCurricular));
      }

      const query = this.db
        .select({
          cursoCodigo: silabo.cursoCodigo,
          cursoNombre: silabo.cursoNombre,
          estadoRevision: silabo.estadoRevision,
          syllabusId: silabo.id,
          docenteId: silaboDocente.docenteId,
          nombreDocente: docente.nombreDocente,
          docenteEmail: docente.correo,
          areaCurricular: silabo.areaCurricular,
        })
        .from(silabo)
        .leftJoin(silaboDocente, eq(silabo.id, silaboDocente.silaboId))
        .leftJoin(docente, eq(silaboDocente.docenteId, docente.id))
        .where(and(...(conditions.length > 0 ? conditions : [])))
        .orderBy(asc(silabo.cursoCodigo));

      const result = await query;

      return result.map((r) => ({
        cursoCodigo: r.cursoCodigo ?? null,
        cursoNombre: r.cursoNombre ?? null,
        estadoRevision: r.estadoRevision ?? null,
        syllabusId: r.syllabusId,
        docenteId: r.docenteId ?? null,
        nombreDocente: r.nombreDocente ?? null,
        docenteEmail: r.docenteEmail ?? null,
        areaCurricular: r.areaCurricular ?? null,
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "DatabaseError",
        "INTERNAL_SERVER_ERROR",
        "Error al consultar sílabos en la base de datos",
        error,
      );
    }
  }

  async create(assigment: CreateAssignmentPayload) {
    return await this.db.transaction(async (transaction) => {
      const existing = await transaction
        .select({ id: silaboDocente.id })
        .from(silaboDocente)
        .where(eq(silaboDocente.silaboId, assigment.syllabus.id))
        .limit(1);

      if (existing.length > 0) {
        throw new AppError(
          "Conflicto de asignación",
          "CONFLICT",
          SYLLABUS_ALREADY_ASSIGNED_MESSAGE,
        );
      }

      const inserted = await transaction
        .insert(silaboDocente)
        .values({
          silaboId: assigment.syllabus.id,
          docenteId: assigment.teacher.id,
          rol: "asignado",
          observaciones: assigment.message,
        })
        .returning();

      await transaction
        .update(silabo)
        .set({
          asignadoADocenteId: assigment.teacher.id,
          actualizadoPorDocenteId: assigment.teacher.id,
          estadoRevision: "ASIGNADO",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(silabo.id, assigment.syllabus.id));

      return inserted;
    });
  }

  async getAllCourses(options?: { sinAsignar?: boolean }): Promise<CourseSimple[]> {
    try {
      const conditions: SQL[] = options?.sinAsignar
        ? pendingAssignmentConditions()
        : [];

      let query = this.db
        .select({
          id: silabo.id,
          code: silabo.cursoCodigo,
          name: silabo.cursoNombre,
          ciclo: silabo.ciclo,
          escuela: silabo.escuelaProfesional,
          estadoRevision: silabo.estadoRevision,
          docenteId: silaboDocente.docenteId,
          nombreDocente: docente.nombreDocente,
        })
        .from(silabo)
        .leftJoin(silaboDocente, eq(silabo.id, silaboDocente.silaboId))
        .leftJoin(docente, eq(silaboDocente.docenteId, docente.id))
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query.orderBy(asc(silabo.cursoCodigo));

      return result.map((r) => ({
        id: r.id,
        code: r.code ?? null,
        name: r.name ?? null,
        ciclo: r.ciclo ?? null,
        escuela: r.escuela ?? null,
        estadoRevision: r.estadoRevision ?? null,
        docenteId: r.docenteId ?? null,
        nombreDocente: r.nombreDocente ?? null,
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "DatabaseError",
        "INTERNAL_SERVER_ERROR",
        "Error al consultar cursos en la base de datos",
        error,
      );
    }
  }
}

export const assignmentsRepository = new AssignmentsRepository();

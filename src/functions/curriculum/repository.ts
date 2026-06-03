import { and, asc, eq, sql } from "drizzle-orm";
import { BaseRepository } from "../../lib/repository";
import { curriculumCourseCatalog } from "../../../drizzle/schema";
import type { CurriculumCourseCreate, CurriculumCourseUpdate } from "./types";

export class CurriculumRepository extends BaseRepository {
  async listPeriods(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ periodo: curriculumCourseCatalog.periodo })
      .from(curriculumCourseCatalog)
      .where(eq(curriculumCourseCatalog.activo, true))
      .orderBy(asc(curriculumCourseCatalog.periodo));

    return rows.map((row) => row.periodo).filter(Boolean);
  }

  async listCoursesByPeriod(periodo: string) {
    return this.db
      .select()
      .from(curriculumCourseCatalog)
      .where(
        and(
          eq(curriculumCourseCatalog.periodo, periodo),
          eq(curriculumCourseCatalog.activo, true),
        ),
      )
      .orderBy(
        asc(curriculumCourseCatalog.ciclo),
        asc(curriculumCourseCatalog.nombre),
      );
  }

  async countCoursesByPeriod(periodo: string): Promise<number> {
    const rows = await this.listCoursesByPeriod(periodo);
    return rows.length;
  }

  async seedCourses(
    periodo: string,
    courses: Array<{
      codigo: string;
      nombre: string;
      ciclo: number | null;
      creditos: number;
      horasTeoria: number;
      horasPractica: number;
      modalidad: string;
      tipoCurso?: string | null;
      areaCurricular?: string | null;
      prerrequisitos: string[];
    }>,
  ) {
    if (courses.length === 0) {
      return;
    }

    await this.db
      .insert(curriculumCourseCatalog)
      .values(
        courses.map((course) => ({
          periodo,
          codigo: course.codigo,
          nombre: course.nombre,
          ciclo: course.ciclo,
          creditos: course.creditos,
          horasTeoria: course.horasTeoria,
          horasPractica: course.horasPractica,
          modalidad: course.modalidad,
          tipoCurso: course.tipoCurso ?? null,
          areaCurricular: course.areaCurricular ?? null,
          prerrequisitos: course.prerrequisitos,
          activo: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      )
      .onConflictDoUpdate({
        target: [
          curriculumCourseCatalog.periodo,
          curriculumCourseCatalog.codigo,
        ],
        set: {
          nombre: sql`excluded.nombre`,
          ciclo: sql`excluded.ciclo`,
          creditos: sql`excluded.creditos`,
          horasTeoria: sql`excluded.horas_teoria`,
          horasPractica: sql`excluded.horas_practica`,
          modalidad: sql`excluded.modalidad`,
          tipoCurso: sql`excluded.tipo_curso`,
          areaCurricular: sql`excluded.area_curricular`,
          prerrequisitos: sql`excluded.prerrequisitos`,
          activo: true,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  async findCourseById(id: number) {
    const rows = await this.db
      .select()
      .from(curriculumCourseCatalog)
      .where(eq(curriculumCourseCatalog.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async createCourse(periodo: string, data: CurriculumCourseCreate) {
    const inserted = await this.db
      .insert(curriculumCourseCatalog)
      .values({
        periodo,
        codigo: data.codigo,
        nombre: data.nombre,
        ciclo: data.ciclo ?? null,
        creditos: data.creditos,
        horasTeoria: data.horasTeoria ?? 0,
        horasPractica: data.horasPractica ?? 0,
        modalidad: data.modalidad ?? "PRESENCIAL",
        tipoCurso: data.tipoCurso ?? null,
        areaCurricular: data.areaCurricular ?? null,
        prerrequisitos: data.prerrequisitos ?? [],
        activo: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return inserted[0] ?? null;
  }

  async updateCourse(id: number, data: CurriculumCourseUpdate) {
    const values: Partial<typeof curriculumCourseCatalog.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.codigo !== undefined) values.codigo = data.codigo;
    if (data.nombre !== undefined) values.nombre = data.nombre;
    if (data.ciclo !== undefined) values.ciclo = data.ciclo;
    if (data.creditos !== undefined) values.creditos = data.creditos;
    if (data.horasTeoria !== undefined) values.horasTeoria = data.horasTeoria;
    if (data.horasPractica !== undefined) {
      values.horasPractica = data.horasPractica;
    }
    if (data.modalidad !== undefined) values.modalidad = data.modalidad;
    if (data.tipoCurso !== undefined) values.tipoCurso = data.tipoCurso;
    if (data.areaCurricular !== undefined) {
      values.areaCurricular = data.areaCurricular;
    }
    if (data.prerrequisitos !== undefined) {
      values.prerrequisitos = data.prerrequisitos;
    }

    const updated = await this.db
      .update(curriculumCourseCatalog)
      .set(values)
      .where(eq(curriculumCourseCatalog.id, id))
      .returning();

    return updated[0] ?? null;
  }

  async deactivateCourse(id: number) {
    const updated = await this.db
      .update(curriculumCourseCatalog)
      .set({
        activo: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(curriculumCourseCatalog.id, id))
      .returning();

    return updated[0] ?? null;
  }
}

export const curriculumRepository = new CurriculumRepository();

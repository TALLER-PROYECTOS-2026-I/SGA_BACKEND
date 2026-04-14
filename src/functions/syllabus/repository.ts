import { getDb } from "../../db";
import { eq, and, sql, asc, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../drizzle/schema";
import {
  silaboCompetenciaCurso,
  silaboCompetenciaComponente,
  silabo,
  silaboDocente,
  docente,
  silaboSumilla,
  silaboRevisionSeccion,
  silaboRevisionComentario,
  silaboSeccionPermiso,
  silaboContenidoConceptual,
  silaboUnidadSemana,
  silaboUnidad,
} from "../../../drizzle/schema";
import { AppError } from "../../error";
import { z } from "zod";
import { SyllabusCreateSchema, DesaprobarSilabo } from "./types";
import { BaseRepository } from "../../lib/repository";

//1
type Upsertable = { id?: number | string; text: string; order?: number | null };
type CreateItem = { text: string; order?: number | null; code?: string | null };

const GROUP_COMP = "COMP";
const GROUP_ACT = "ACT";

export class SyllabusRepository extends BaseRepository {
  async findById(id: number) {
    const syllabus = await this.db
      .select()
      .from(silabo)
      .where(eq(silabo.id, id));
    return syllabus[0] || null;
  }

  async findGeneralDataById(id: number) {
    const silaboResult = await this.db
      .select({
        nombreAsignatura: silabo.cursoNombre,
        departamentoAcademico: silabo.departamentoAcademico,
        escuelaProfesional: silabo.escuelaProfesional,
        programaAcademico: silabo.programaAcademico,
        semestreAcademico: silabo.semestreAcademico,
        tipoAsignatura: silabo.tipoAsignatura,
        tipoEstudios: silabo.tipoDeEstudios,
        modalidad: silabo.modalidadDeAsignatura,
        codigoAsignatura: silabo.cursoCodigo,
        ciclo: silabo.ciclo,
        requisitos: silabo.requisitos,
        horasTeoria: silabo.horasTeoria,
        horasPractica: silabo.horasPractica,
        horasLaboratorio: silabo.horasLaboratorio,
        horasTeoriaLectivaPresencial: silabo.horasTeoriaLectivaPresencial,
        horasTeoriaLectivaDistancia: silabo.horasTeoriaLectivaDistancia,
        horasTeoriaNoLectivaPresencial: silabo.horasTeoriaNoLectivaPresencial,
        horasTeoriaNoLectivaDistancia: silabo.horasTeoriaNoLectivaDistancia,
        horasPracticaLectivaPresencial: silabo.horasPracticaLectivaPresencial,
        horasPracticaLectivaDistancia: silabo.horasPracticaLectivaDistancia,
        horasPracticaNoLectivaPresencial:
          silabo.horasPracticaNoLectivaPresencial,
        horasPracticaNoLectivaDistancia: silabo.horasPracticaNoLectivaDistancia,
        creditosTeoria: silabo.creditosTeoria,
        creditosPractica: silabo.creditosPractica,
      })
      .from(silabo)
      .where(eq(silabo.id, id));

    if (!silaboResult || silaboResult.length === 0) {
      return null;
    }

    const docentes = await this.db
      .select({ nombreDocente: docente.nombreDocente })
      .from(silaboDocente)
      .innerJoin(docente, eq(silaboDocente.docenteId, docente.id))
      .where(eq(silaboDocente.silaboId, id));

    const docentesNombres = docentes.map((d) => d.nombreDocente);
    const docentesString =
      docentesNombres.length === 1
        ? docentesNombres[0]
        : docentesNombres.join(", ");

    return {
      ...silaboResult[0],
      docentes: docentesString,
    };
  }

  async create(syllabusData: z.infer<typeof SyllabusCreateSchema>) {
    const result = await this.db
      .insert(silabo)
      .values({
        departamentoAcademico: syllabusData.departamentoAcademico,
        escuelaProfesional: syllabusData.escuelaProfesional,
        programaAcademico: syllabusData.programaAcademico,
        cursoCodigo: syllabusData.codigoAsignatura,
        cursoNombre: syllabusData.nombreAsignatura,
        semestreAcademico: syllabusData.semestreAcademico,
        tipoAsignatura: syllabusData.tipoAsignatura,
        tipoDeEstudios: syllabusData.tipoEstudios,
        modalidadDeAsignatura: syllabusData.modalidad,
        ciclo: syllabusData.ciclo,

        requisitos: syllabusData.requisitos || null,

        // 🕒 Horas
        horasTeoria: syllabusData.horasTeoria ?? null,
        horasPractica: syllabusData.horasPractica ?? null,
        horasLaboratorio: syllabusData.horasLaboratorio ?? null,

        horasTeoriaLectivaPresencial:
          syllabusData.horasTeoriaLectivaPresencial ?? null,
        horasTeoriaLectivaDistancia:
          syllabusData.horasTeoriaLectivaDistancia ?? null,
        horasTeoriaNoLectivaPresencial:
          syllabusData.horasTeoriaNoLectivaPresencial ?? null,
        horasTeoriaNoLectivaDistancia:
          syllabusData.horasTeoriaNoLectivaDistancia ?? null,

        horasPracticaLectivaPresencial:
          syllabusData.horasPracticaLectivaPresencial ?? null,
        horasPracticaLectivaDistancia:
          syllabusData.horasPracticaLectivaDistancia ?? null,
        horasPracticaNoLectivaPresencial:
          syllabusData.horasPracticaNoLectivaPresencial ?? null,
        horasPracticaNoLectivaDistancia:
          syllabusData.horasPracticaNoLectivaDistancia ?? null,

        // 🧮 Créditos
        creditosTeoria: syllabusData.creditosTeoria ?? null,
        creditosPractica: syllabusData.creditosPractica ?? null,

        // 👤 Relaciones (null por ahora, hasta integrar autenticación)
        creadoPorDocenteId: null,
        actualizadoPorDocenteId: null,
        asignadoADocenteId: null,

        // 🟢 Estado inicial por defecto
        estadoRevision: "",
      })
      .returning({ id: silabo.id });

    //const idSyllabus = [{ id: 1 }]; // simula el ID retornado

    return result[0].id;
  }

  async updateSumilla(silaboId: number, sumilla: string) {
    await this.db
      .update(silaboSumilla)
      .set({
        //sumilla,
        contenido: sumilla,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(silaboSumilla.silaboId, silaboId));
  }

  async saveSumilla(silaboId: number, sumilla: string) {
    await this.db.insert(silaboSumilla).values({
      silaboId: silaboId,
      contenido: sumilla,
      es_actual: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  async findSumillaBySilaboId(silaboId: number) {
    return await this.db
      .select({
        sumilla: silaboSumilla.contenido,
      })
      .from(silaboSumilla)
      .where(eq(silaboSumilla.silaboId, silaboId))
      .limit(1);
  }

  // ---------- COMPETENCIAS (silabo_competencia_curso) ----------
  listCompetencies(syllabusId: number | string) {
    return this.db
      .select({
        id: silaboCompetenciaCurso.id,
        silaboId: silaboCompetenciaCurso.silaboId,
        text: silaboCompetenciaCurso.descripcion,
        code: silaboCompetenciaCurso.codigo,
        order: silaboCompetenciaCurso.orden,
      })
      .from(silaboCompetenciaCurso)
      .where(eq(silaboCompetenciaCurso.silaboId, Number(syllabusId)));
  }

  async insertCompetencies(
    syllabusId: number | string,
    items: { text: string; code: string | null; order: number | null }[],
  ) {
    for (const it of items) {
      await this.db.insert(silaboCompetenciaCurso).values({
        silaboId: Number(syllabusId),
        descripcion: it.text,
        codigo: it.code ?? null,
        orden: it.order ?? null,
      });
    }
    return { inserted: items.length };
  }

  async updateCompetency(
    syllabusId: number | string,
    id: number | string,
    data: { text: string; code?: string | null; order?: number | null },
  ) {
    const res = await this.db
      .update(silaboCompetenciaCurso)
      .set({
        descripcion: data.text,
        codigo: data.code ?? null,
        orden: data.order ?? null,
      })
      .where(
        and(
          eq(silaboCompetenciaCurso.id, Number(id)),
          eq(silaboCompetenciaCurso.silaboId, Number(syllabusId)),
        ),
      );
    return { updated: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  async deleteCompetency(syllabusId: number | string, id: number | string) {
    const res = await this.db
      .delete(silaboCompetenciaCurso)
      .where(
        and(
          eq(silaboCompetenciaCurso.id, Number(id)),
          eq(silaboCompetenciaCurso.silaboId, Number(syllabusId)),
        ),
      );
    return { deleted: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  // Método para sincronizar competencias (upsert masivo)
  async syncCompetencies(
    syllabusId: number | string,
    items: Array<{
      id?: number;
      text: string;
      code?: string | null;
      order?: number | null;
    }>,
  ) {
    const sId = Number(syllabusId);

    // Obtener IDs actuales en la BD
    const existing = await this.listCompetencies(syllabusId);
    const existingIds = existing.map((e) => e.id);
    const incomingIds = items.filter((i) => i.id).map((i) => i.id!);

    // IDs a eliminar (están en BD pero no en la lista nueva)
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Eliminar items que ya no están
    for (const id of toDelete) {
      await this.deleteCompetency(sId, id);
      deleted++;
    }

    // Crear o actualizar items
    for (const item of items) {
      if (item.id) {
        // Actualizar existente
        await this.updateCompetency(sId, item.id, {
          text: item.text,
          code: item.code ?? null,
          order: item.order ?? null,
        });
        updated++;
      } else {
        // Crear nuevo
        await this.db.insert(silaboCompetenciaCurso).values({
          silaboId: sId,
          descripcion: item.text,
          codigo: item.code ?? null,
          orden: item.order ?? null,
        });
        created++;
      }
    }

    return { created, updated, deleted };
  }

  // ---------- COMPONENTES (silabo_competencia_componente) ----------
  // NOTA: No filtra por grupo por defecto, retorna TODOS los componentes del sílabo
  async listComponents(syllabusId: number) {
    const result = await this.db
      .select({
        id: silaboCompetenciaComponente.id,
        silaboId: silaboCompetenciaComponente.silaboId,
        grupo: silaboCompetenciaComponente.grupo,
        codigo: silaboCompetenciaComponente.codigo,
        descripcion: silaboCompetenciaComponente.descripcion,
        competenciaCodigoRelacionada:
          silaboCompetenciaComponente.competenciaCodigoRelacionada,
        orden: silaboCompetenciaComponente.orden,
      })
      .from(silaboCompetenciaComponente)
      .where(eq(silaboCompetenciaComponente.silaboId, syllabusId))
      .orderBy(silaboCompetenciaComponente.orden);

    return result;
  }

  // Método auxiliar para obtener TODOS los componentes sin filtrar por grupo (para debugging)
  async listAllComponentsByGrupo(syllabusId: number, grupo?: string) {
    const conditions = [eq(silaboCompetenciaComponente.silaboId, syllabusId)];

    if (grupo) {
      conditions.push(eq(silaboCompetenciaComponente.grupo, grupo));
    }

    const result = await this.db
      .select({
        id: silaboCompetenciaComponente.id,
        silaboId: silaboCompetenciaComponente.silaboId,
        grupo: silaboCompetenciaComponente.grupo,
        codigo: silaboCompetenciaComponente.codigo,
        descripcion: silaboCompetenciaComponente.descripcion,
        competenciaCodigoRelacionada:
          silaboCompetenciaComponente.competenciaCodigoRelacionada,
        orden: silaboCompetenciaComponente.orden,
      })
      .from(silaboCompetenciaComponente)
      .where(and(...conditions))
      .orderBy(silaboCompetenciaComponente.orden);

    return result;
  }

  async insertComponents(syllabusId: number, items: CreateItem[]) {
    for (const it of items) {
      await this.db.insert(silaboCompetenciaComponente).values({
        silaboId: syllabusId,
        grupo: GROUP_COMP,
        descripcion: it.text,
        codigo: it.code ?? null,
        orden: it.order ?? null,
      });
    }
    return { inserted: items.length };
  }

  async updateComponent(
    syllabusId: number,
    id: number,
    data: {
      text: string;
      code?: string | null;
      order?: number | null;
      grupo?: string;
    },
  ) {
    const updateData: any = {
      descripcion: data.text,
      codigo: data.code ?? null,
      orden: data.order ?? null,
    };

    if (data.grupo) {
      updateData.grupo = data.grupo;
    }

    const res = await this.db
      .update(silaboCompetenciaComponente)
      .set(updateData)
      .where(
        and(
          eq(silaboCompetenciaComponente.id, id),
          eq(silaboCompetenciaComponente.silaboId, syllabusId),
        ),
      );
    return { updated: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  async deleteComponent(syllabusId: number, id: number) {
    const res = await this.db
      .delete(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.id, id),
          eq(silaboCompetenciaComponente.silaboId, syllabusId),
        ),
      );
    return { deleted: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  // Método para sincronizar componentes (upsert masivo)
  async syncComponents(
    syllabusId: number,
    items: Array<{
      id?: number;
      text: string;
      code?: string | null;
      order?: number | null;
      grupo?: string;
    }>,
  ) {
    // Obtener IDs actuales en la BD (solo grupo COMP)
    const existing = await this.listComponents(syllabusId);
    const existingIds = existing.map((e) => e.id);
    const incomingIds = items.filter((i) => i.id).map((i) => i.id!);

    // IDs a eliminar (están en BD pero no en la lista nueva)
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Eliminar items que ya no están
    for (const id of toDelete) {
      await this.deleteComponent(syllabusId, id);
      deleted++;
    }

    // Crear o actualizar items
    for (const item of items) {
      if (item.id) {
        // Actualizar existente
        await this.updateComponent(syllabusId, item.id, {
          text: item.text,
          code: item.code ?? null,
          order: item.order ?? null,
          grupo: item.grupo ?? GROUP_COMP,
        });
        updated++;
      } else {
        // Crear nuevo
        await this.db.insert(silaboCompetenciaComponente).values({
          silaboId: syllabusId,
          grupo: item.grupo ?? GROUP_COMP,
          descripcion: item.text,
          codigo: item.code ?? null,
          orden: item.order ?? null,
        });
        created++;
      }
    }

    return { created, updated, deleted };
  }

  // ---------- ACTITUDES (silabo_competencia_componente.grupo='ACT') ----------
  async listAttitudes(syllabusId: number) {
    return this.db
      .select()
      .from(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.silaboId, syllabusId),
          eq(silaboCompetenciaComponente.grupo, GROUP_ACT),
        ),
      )
      .orderBy(silaboCompetenciaComponente.orden);
  }

  async insertAttitudes(syllabusId: number, items: CreateItem[]) {
    for (const it of items) {
      await this.db.insert(silaboCompetenciaComponente).values({
        silaboId: syllabusId,
        grupo: GROUP_ACT,
        descripcion: it.text,
        codigo: it.code ?? null,
        orden: it.order ?? null,
      });
    }
    return { inserted: items.length };
  }

  async updateAttitude(
    syllabusId: number,
    id: number,
    data: { text: string; code?: string | null; order?: number | null },
  ) {
    const res = await this.db
      .update(silaboCompetenciaComponente)
      .set({
        descripcion: data.text,
        codigo: data.code ?? null,
        orden: data.order ?? null,
      })
      .where(
        and(
          eq(silaboCompetenciaComponente.id, id),
          eq(silaboCompetenciaComponente.silaboId, syllabusId),
          eq(silaboCompetenciaComponente.grupo, GROUP_ACT),
        ),
      );
    return { updated: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  async deleteAttitude(syllabusId: number, id: number) {
    const res = await this.db
      .delete(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.id, id),
          eq(silaboCompetenciaComponente.silaboId, syllabusId),
          eq(silaboCompetenciaComponente.grupo, GROUP_ACT),
        ),
      );
    return { deleted: (res as unknown as { rowCount?: number }).rowCount ?? 0 };
  }

  // Método para sincronizar actitudes (upsert masivo)
  async syncAttitudes(
    syllabusId: number,
    items: Array<{
      id?: number;
      text: string;
      code?: string | null;
      order?: number | null;
    }>,
  ) {
    // Obtener IDs actuales en la BD (solo grupo ACT)
    const existing = await this.listAttitudes(syllabusId);
    const existingIds = existing.map((e: any) => e.id);
    const incomingIds = items.filter((i) => i.id).map((i) => i.id!);

    // IDs a eliminar (están en BD pero no en la lista nueva)
    const toDelete = existingIds.filter(
      (id: number) => !incomingIds.includes(id),
    );

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Eliminar items que ya no están
    for (const id of toDelete) {
      await this.deleteAttitude(syllabusId, id);
      deleted++;
    }

    // Crear o actualizar items
    for (const item of items) {
      if (item.id) {
        // Actualizar existente
        await this.updateAttitude(syllabusId, item.id, {
          text: item.text,
          code: item.code ?? null,
          order: item.order ?? null,
        });
        updated++;
      } else {
        // Crear nuevo
        await this.db.insert(silaboCompetenciaComponente).values({
          silaboId: syllabusId,
          grupo: GROUP_ACT,
          descripcion: item.text,
          codigo: item.code ?? null,
          orden: item.order ?? null,
        });
        created++;
      }
    }

    return { created, updated, deleted };
  }

  async getStateById(id: number) {
    const result = await this.db
      .select({
        estadoRevision: silabo.estadoRevision,
      })
      .from(silabo)
      .where(eq(silabo.id, id));

    return result[0] || null;
  }

  async updateReviewStatus(id: number, estadoRevision: string) {
    await this.db
      .update(silabo)
      .set({
        estadoRevision,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(silabo.id, id));
    return { ok: true };
  }

  async createContribution(data: {
    syllabusId: number;
    resultadoProgramaCodigo: string;
    resultadoProgramaDescripcion?: string;
    aporteValor: "" | "K" | "R";
  }) {
    const result = await this.db
      .insert(schema.silaboAporteResultadoPrograma)
      .values({
        silaboId: data.syllabusId,
        resultadoProgramaCodigo: data.resultadoProgramaCodigo,
        resultadoProgramaDescripcion: data.resultadoProgramaDescripcion,
        aporteValor: data.aporteValor,
      })
      .returning();

    return result[0];
  }

  // ---------- OBTENER SÍLABO COMPLETO ----------
  async getCompleteSyllabus(id: number) {
    // 1. Datos Generales - Verificar que el sílabo existe
    const datosGenerales = await this.findGeneralDataById(id);

    // Si no existe el sílabo, retornar null para que el service maneje el error
    if (!datosGenerales) {
      return null;
    }

    // 2. Sumilla
    const sumillaResult = await this.db
      .select({ contenido: silaboSumilla.contenido })
      .from(silaboSumilla)
      .where(
        and(eq(silaboSumilla.silaboId, id), eq(silaboSumilla.esActual, true)),
      )
      .limit(1);

    // 3. Competencias del Curso
    const competencias = await this.db
      .select({
        id: silaboCompetenciaCurso.id,
        codigo: silaboCompetenciaCurso.codigo,
        descripcion: silaboCompetenciaCurso.descripcion,
        orden: silaboCompetenciaCurso.orden,
      })
      .from(silaboCompetenciaCurso)
      .where(eq(silaboCompetenciaCurso.silaboId, id))
      .orderBy(silaboCompetenciaCurso.orden);

    // 4. Componentes de Competencias (Conceptuales, Procedimentales, Actitudinales)
    const componentesConceptuales = await this.db
      .select()
      .from(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.silaboId, id),
          eq(silaboCompetenciaComponente.grupo, "COMP"),
        ),
      )
      .orderBy(silaboCompetenciaComponente.orden);

    const componentesProcedimentales = await this.db
      .select()
      .from(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.silaboId, id),
          eq(silaboCompetenciaComponente.grupo, "PROC"),
        ),
      )
      .orderBy(silaboCompetenciaComponente.orden);

    const componentesActitudinales = await this.db
      .select()
      .from(silaboCompetenciaComponente)
      .where(
        and(
          eq(silaboCompetenciaComponente.silaboId, id),
          eq(silaboCompetenciaComponente.grupo, "ACT"),
        ),
      )
      .orderBy(silaboCompetenciaComponente.orden);

    // 5. Resultados de Aprendizaje
    const resultadosAprendizaje = await this.db
      .select()
      .from(schema.silaboResultadoAprendizaje)
      .where(eq(schema.silaboResultadoAprendizaje.silaboId, id))
      .orderBy(schema.silaboResultadoAprendizaje.orden);

    // 6. Unidades Didácticas CON SEMANAS
    const unidades = await this.db
      .select()
      .from(schema.silaboUnidad)
      .where(eq(schema.silaboUnidad.silaboId, id))
      .orderBy(schema.silaboUnidad.numero);

    // Para cada unidad, obtener sus semanas
    const unidadesConSemanas = await Promise.all(
      unidades.map(async (unidad) => {
        const semanas = await this.db
          .select()
          .from(schema.silaboUnidadSemana)
          .where(eq(schema.silaboUnidadSemana.silaboUnidadId, unidad.id))
          .orderBy(schema.silaboUnidadSemana.semana);

        return {
          ...unidad,
          semanas,
        };
      }),
    );

    // 7. Estrategias Metodológicas (del silabo principal)
    const estrategiasResult = await this.db
      .select({ estrategias: silabo.estrategiasMetodologicas })
      .from(silabo)
      .where(eq(silabo.id, id));

    // 8. Recursos Didácticos
    const recursosDidacticosNotasResult = await this.db
      .select({ notas: silabo.recursosDidacticosNotas })
      .from(silabo)
      .where(eq(silabo.id, id));

    const recursos = await this.db
      .select({
        id: schema.silaboRecursoDidactico.id,
        recursoId: schema.silaboRecursoDidactico.recursoId,
        recursoNombre: schema.recursoDidacticoCatalogo.nombre,
        destino: schema.silaboRecursoDidactico.destino,
        observaciones: schema.silaboRecursoDidactico.observaciones,
      })
      .from(schema.silaboRecursoDidactico)
      .innerJoin(
        schema.recursoDidacticoCatalogo,
        eq(
          schema.silaboRecursoDidactico.recursoId,
          schema.recursoDidacticoCatalogo.id,
        ),
      )
      .where(eq(schema.silaboRecursoDidactico.silaboId, id));

    // 9. Plan de Evaluación
    const planEvaluacion = await this.db
      .select()
      .from(schema.planEvaluacionOferta)
      .where(eq(schema.planEvaluacionOferta.silaboId, id))
      .orderBy(schema.planEvaluacionOferta.semana);

    // Formula de Evaluación COMPLETA (usando el método existente)
    const formulaEvaluacionResult = await this.db
      .select({ id: schema.formulaEvaluacionRegla.id })
      .from(schema.formulaEvaluacionRegla)
      .where(
        and(
          eq(schema.formulaEvaluacionRegla.silaboId, id),
          eq(schema.formulaEvaluacionRegla.activo, true),
        ),
      )
      .limit(1);

    let formulaEvaluacionCompleta = null;
    if (formulaEvaluacionResult.length > 0) {
      formulaEvaluacionCompleta = await this.getFormulaEvaluacion(
        formulaEvaluacionResult[0].id,
      );
    }

    // 10. Fuentes de Información
    const fuentes = await this.db
      .select({
        id: schema.silaboFuente.id,
        tipo: schema.silaboFuente.tipo,
        autores: schema.silaboFuente.autores,
        anio: schema.silaboFuente.anio,
        titulo: schema.silaboFuente.titulo,
        editorial: schema.silaboFuente.editorialRevista,
        ciudad: schema.silaboFuente.ciudad,
        isbn: schema.silaboFuente.isbnIssn,
        url: schema.silaboFuente.doiUrl,
        notas: schema.silaboFuente.notas,
      })
      .from(schema.silaboFuente)
      .where(eq(schema.silaboFuente.silaboId, id));

    // 11. Aportes a Resultados del Programa
    const aportes = await this.db
      .select({
        silaboId: schema.silaboAporteResultadoPrograma.silaboId,
        resultadoCodigo:
          schema.silaboAporteResultadoPrograma.resultadoProgramaCodigo,
        resultadoDescripcion:
          schema.silaboAporteResultadoPrograma.resultadoProgramaDescripcion,
        aporteValor: schema.silaboAporteResultadoPrograma.aporteValor,
      })
      .from(schema.silaboAporteResultadoPrograma)
      .where(eq(schema.silaboAporteResultadoPrograma.silaboId, id));

    // Parsear estrategias metodológicas
    const estrategiasTexto = estrategiasResult[0]?.estrategias || null;
    const estrategiasMetodologicas = estrategiasTexto
      ? this.parseEstrategiasMetodologicas(estrategiasTexto)
      : null;

    // Parsear recursos didácticos notas
    const recursosNotasTexto = recursosDidacticosNotasResult[0]?.notas || null;
    const recursosNotas = recursosNotasTexto
      ? this.parseRecursosDidacticosNotas(recursosNotasTexto)
      : null;

    return {
      datosGenerales,
      sumilla: sumillaResult[0]?.contenido || null,
      competenciasCurso: competencias,
      componentesConceptuales,
      componentesProcedimentales,
      componentesActitudinales,
      resultadosAprendizaje,
      unidadesDidacticas: unidadesConSemanas,
      estrategiasMetodologicas,
      recursosDidacticos: {
        notas: recursosNotas,
        recursos,
      },
      evaluacionAprendizaje: {
        planEvaluacion,
        formulaEvaluacion: formulaEvaluacionCompleta,
      },
      fuentes,
      aportesResultadosPrograma: aportes,
    };
  }

  /**
   * Parsea el texto de estrategias metodológicas a un array estructurado
   * Formato esperado: "Nombre método|Descripción\nOtro método|Otra descripción"
   */
  private parseEstrategiasMetodologicas(
    texto: string,
  ): Array<{ nombre: string; descripcion: string }> {
    if (!texto || texto.trim() === "") return [];

    // Dividir por saltos de línea
    const lineas = texto.split("\n").filter((linea) => linea.trim() !== "");

    return lineas.map((linea) => {
      // Buscar el separador |
      const separadorIndex = linea.indexOf("|");

      if (separadorIndex === -1) {
        // Si no hay separador, toda la línea es la descripción
        return {
          nombre: "",
          descripcion: linea.trim(),
        };
      }

      return {
        nombre: linea.substring(0, separadorIndex).trim(),
        descripcion: linea.substring(separadorIndex + 1).trim(),
      };
    });
  }

  /**
   * Parsea el texto de recursos didácticos notas a un array estructurado
   * Formato esperado: "Nombre recurso|Descripción\nOtro recurso|Otra descripción"
   */
  private parseRecursosDidacticosNotas(
    texto: string,
  ): Array<{ nombre: string; descripcion: string }> {
    if (!texto || texto.trim() === "") return [];

    // Dividir por saltos de línea
    const lineas = texto.split("\n").filter((linea) => linea.trim() !== "");

    return lineas.map((linea) => {
      // Buscar el separador |
      const separadorIndex = linea.indexOf("|");

      if (separadorIndex === -1) {
        // Si no hay separador, toda la línea es la descripción
        return {
          nombre: "",
          descripcion: linea.trim(),
        };
      }

      return {
        nombre: linea.substring(0, separadorIndex).trim(),
        descripcion: linea.substring(separadorIndex + 1).trim(),
      };
    });
  }

  // ---------- REVISIÓN ----------
  async findAllSyllabusInRevision(estado?: string, docenteId?: number) {
    let query = this.db
      .select({
        id: silabo.id,
        cursoNombre: silabo.cursoNombre,
        cursoCodigo: silabo.cursoCodigo,
        departamentoAcademico: silabo.departamentoAcademico,
        escuelaProfesional: silabo.escuelaProfesional,
        estadoRevision: silabo.estadoRevision,
        asignadoADocenteId: docente.id,
        nombreDocente: docente.nombreDocente,
        createdAt: silabo.createdAt,
        updatedAt: silabo.updatedAt,
      })
      .from(silabo)
      .innerJoin(silaboDocente, eq(silabo.id, silaboDocente.silaboId))
      .innerJoin(docente, eq(silaboDocente.docenteId, docente.id));

    // Aplicar filtros si existen
    const conditions = [];
    if (estado) {
      conditions.push(eq(silabo.estadoRevision, estado));
    }
    if (docenteId) {
      conditions.push(eq(silabo.asignadoADocenteId, docenteId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query.orderBy(silabo.updatedAt);
    return result.map((r) => ({
      id: r.id,
      cursoCodigo: r.cursoCodigo ?? null,
      cursoNombre: r.cursoNombre ?? null,
      estadoRevision: r.estadoRevision ?? null,
      silaboId: r.id,
      syllabusId: r.id,
      docenteId: r.asignadoADocenteId ?? null,
      nombreDocente: r.nombreDocente ?? null,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  }

  async findSyllabusRevisionById(id: number) {
    const result = await this.db
      .select({
        id: silabo.id,
        cursoNombre: silabo.cursoNombre,
        cursoCodigo: silabo.cursoCodigo,
        departamentoAcademico: silabo.departamentoAcademico,
        escuelaProfesional: silabo.escuelaProfesional,
        estadoRevision: silabo.estadoRevision,
        asignadoADocenteId: silabo.asignadoADocenteId,
        nombreDocente: docente.nombreDocente,
        createdAt: silabo.createdAt,
        updatedAt: silabo.updatedAt,
      })
      .from(silabo)
      .leftJoin(docente, eq(silabo.asignadoADocenteId, docente.id))
      .where(eq(silabo.id, id))
      .limit(1);

    return result[0] || null;
  }
  async findSectionPermissions(silaboId: number, docenteId?: number) {
    const conditions = [eq(silaboSeccionPermiso.silaboId, silaboId)];
    if (docenteId !== undefined) {
      conditions.push(eq(silaboSeccionPermiso.docenteId, docenteId));
    }
    const result = await this.db
      .select({
        seccion: silaboSeccionPermiso.numeroSeccion,
      })
      .from(silaboSeccionPermiso)
      .where(and(...conditions));
    return result;
  }

  async updateSyllabusStatus(
    id: number,
    data: {
      estadoRevision: string;
      observaciones?: string | null;
      actualizadoPorDocenteId?: number | null;
    },
  ) {
    const updateData: any = {
      estadoRevision: data.estadoRevision,
      updatedAt: new Date().toISOString(),
    };

    if (data.observaciones !== undefined) {
      updateData.observaciones = data.observaciones;
    }

    if (data.actualizadoPorDocenteId !== undefined) {
      updateData.actualizadoPorDocenteId = data.actualizadoPorDocenteId;
    }

    const result = await this.db
      .update(silabo)
      .set(updateData)
      .where(eq(silabo.id, id))
      .returning();

    return result[0];
  }
  async disapproveSyllabus(id: number, data: z.infer<typeof DesaprobarSilabo>) {
    // Primero, eliminar todas las secciones de revisión existentes para este sílabo
    await this.db
      .delete(silaboRevisionSeccion)
      .where(eq(silaboRevisionSeccion.silaboId, id));

    // Insertar secciones de revisión y sus comentarios asociados
    const obs = data.observaciones || [];

    for (const r of obs) {
      // Insertar la sección de revisión y obtener su id
      const insertedSection = await this.db
        .insert(silaboRevisionSeccion)
        .values({
          silaboId: id,
          numeroSeccion: r.numeroSeccion,
          nombreSeccion: r.nombreSeccion,
          estado: "RECHAZADO", // Estado de la sección específica (no del sílabo global)
          revisadoPor: null,
          revisadoEn: new Date().toISOString(),
          comentariosCount: 0,
        })
        .returning({ id: silaboRevisionSeccion.id });

      const revisionSeccionId = insertedSection[0]?.id;

      // Insertar el comentario asociado a la sección (usar el campo 'comentario' del schema)
      await this.db.insert(silaboRevisionComentario).values({
        silaboRevisionSeccionId: revisionSeccionId,
        autorId: null,
        mensaje: r.comentario,
        creadoEn: new Date().toISOString(),
      });
    }

    // Actualizar estado del sílabo a DESAPROBADO
    const updateData = {
      estadoRevision: "DESAPROBADO",
      updatedAt: new Date().toISOString(),
    };

    // Ejecutar la actualización en la tabla silabo y retornar el registro actualizado
    const updated = await this.db
      .update(silabo)
      .set(updateData)
      .where(eq(silabo.id, id))
      .returning();

    return updated[0] || null;
  }

  // ---------- REVISIÓN DE SECCIONES ----------
  async findRevisionSections(silaboId: number) {
    const result = await this.db
      .select({
        id: silaboRevisionSeccion.id,
        numeroSeccion: silaboRevisionSeccion.numeroSeccion,
        nombreSeccion: silaboRevisionSeccion.nombreSeccion,
        estado: silaboRevisionSeccion.estado,
        revisadoPor: silaboRevisionSeccion.revisadoPor,
        revisadoEn: silaboRevisionSeccion.revisadoEn,
        comentariosCount: silaboRevisionSeccion.comentariosCount,
        nombreDocente: docente.nombreDocente,
      })
      .from(silaboRevisionSeccion)
      .leftJoin(docente, eq(silaboRevisionSeccion.revisadoPor, docente.id))
      .where(eq(silaboRevisionSeccion.silaboId, silaboId))
      .orderBy(silaboRevisionSeccion.numeroSeccion);

    return result;
  }

  async upsertRevisionSections(
    silaboId: number,
    secciones: Array<{
      numeroSeccion: number;
      nombreSeccion: string;
      estado?: string;
    }>,
    docenteId?: number,
  ) {
    const results = [];

    for (const seccion of secciones) {
      // Verificar si ya existe
      const existing = await this.db
        .select()
        .from(silaboRevisionSeccion)
        .where(
          and(
            eq(silaboRevisionSeccion.silaboId, silaboId),
            eq(silaboRevisionSeccion.numeroSeccion, seccion.numeroSeccion),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Actualizar existente
        const updated = await this.db
          .update(silaboRevisionSeccion)
          .set({
            nombreSeccion: seccion.nombreSeccion,
            estado: seccion.estado || existing[0].estado,
            revisadoPor: docenteId || existing[0].revisadoPor,
            revisadoEn: new Date().toISOString(),
          })
          .where(eq(silaboRevisionSeccion.id, existing[0].id))
          .returning();

        results.push(updated[0]);
      } else {
        // Insertar nuevo
        const inserted = await this.db
          .insert(silaboRevisionSeccion)
          .values({
            silaboId,
            numeroSeccion: seccion.numeroSeccion,
            nombreSeccion: seccion.nombreSeccion,
            estado: seccion.estado || "PENDIENTE",
            revisadoPor: docenteId || null,
            revisadoEn: new Date().toISOString(),
            comentariosCount: 0,
          })
          .returning();

        results.push(inserted[0]);
      }
    }

    return results;
  }

  // Obtener estrategias metodológicas por ID
  async getEstrategiasMetodologicas(id: number) {
    const db = getDb();
    if (!db) return null;

    const result = await db
      .select({
        id: schema.silabo.id,
        estrategiasMetodologicas: schema.silabo.estrategiasMetodologicas,
      })
      .from(schema.silabo)
      .where(eq(schema.silabo.id, id));

    return result[0] ?? null;
  }

  // Obtener recursos didácticos por ID
  async getRecursosDidacticosNotas(id: number) {
    const db = getDb();
    if (!db) return null;

    const result = await db
      .select({
        id: schema.silabo.id,
        recursosDidacticosNotas: schema.silabo.recursosDidacticosNotas,
      })
      .from(schema.silabo)
      .where(eq(schema.silabo.id, id));

    return result[0] ?? null;
  }

  // Obtener evaluación por ID
  async getFormulaEvaluacion(id: number) {
    // Obtener la fórmula principal
    const [formula] = await this.db
      .select({
        id: schema.formulaEvaluacionRegla.id,
        silaboId: schema.formulaEvaluacionRegla.silaboId,
        nombreRegla: schema.formulaEvaluacionRegla.nombreRegla,
        variableFinalCodigo: schema.formulaEvaluacionRegla.variableFinalCodigo,
        expresionFinal: schema.formulaEvaluacionRegla.expresionFinal,
        activo: schema.formulaEvaluacionRegla.activo,
      })
      .from(schema.formulaEvaluacionRegla)
      .where(eq(schema.formulaEvaluacionRegla.id, id));

    if (!formula) return null;

    // Obtener las variables ordenadas
    const variables = await this.db
      .select({
        codigo: schema.formulaEvaluacionVariable.codigo,
        nombre: schema.formulaEvaluacionVariable.nombre,
        tipo: schema.formulaEvaluacionVariable.tipo,
        descripcion: schema.formulaEvaluacionVariable.descripcion,
        orden: schema.formulaEvaluacionVariable.orden,
      })
      .from(schema.formulaEvaluacionVariable)
      .where(eq(schema.formulaEvaluacionVariable.formulaEvaluacionReglaId, id))
      .orderBy(asc(schema.formulaEvaluacionVariable.orden));

    // Obtener las subformulas
    const subformulas = await this.db
      .select({
        variableCodigo: schema.formulaEvaluacionSubformula.variableCodigo,
        expresion: schema.formulaEvaluacionSubformula.expresion,
      })
      .from(schema.formulaEvaluacionSubformula)
      .where(
        eq(schema.formulaEvaluacionSubformula.formulaEvaluacionReglaId, id),
      );

    // Obtener los mapeos de variable a plan de evaluación
    const variablePlanMappings = await this.db
      .select({
        variableCodigo: schema.formulaEvaluacionVariablePlan.variableCodigo,
        planEvaluacionOfertaId:
          schema.formulaEvaluacionVariablePlan.planEvaluacionOfertaId,
      })
      .from(schema.formulaEvaluacionVariablePlan)
      .where(
        eq(schema.formulaEvaluacionVariablePlan.formulaEvaluacionReglaId, id),
      );

    // Obtener los planes de evaluación relacionados
    const planIds = variablePlanMappings.map((m) => m.planEvaluacionOfertaId);
    let planesEvaluacion: any[] = [];

    if (planIds.length > 0) {
      planesEvaluacion = await this.db
        .select({
          id: schema.planEvaluacionOferta.id,
          componenteNombre: schema.planEvaluacionOferta.componenteNombre,
          instrumentoNombre: schema.planEvaluacionOferta.instrumentoNombre,
          semana: schema.planEvaluacionOferta.semana,
          fecha: schema.planEvaluacionOferta.fecha,
          instrucciones: schema.planEvaluacionOferta.instrucciones,
          rubricaUrl: schema.planEvaluacionOferta.rubricaUrl,
        })
        .from(schema.planEvaluacionOferta)
        .where(inArray(schema.planEvaluacionOferta.id, planIds));
    }

    return {
      id: formula.id,
      silaboId: formula.silaboId,
      nombreRegla: formula.nombreRegla,
      variableFinalCodigo: formula.variableFinalCodigo,
      expresionFinal: formula.expresionFinal,
      activo: formula.activo,
      variables: variables.map((v) => ({
        codigo: v.codigo,
        nombre: v.nombre,
        tipo: v.tipo || undefined,
        descripcion: v.descripcion || undefined,
        orden: v.orden || undefined,
      })),
      subformulas: subformulas.map((s) => ({
        variableCodigo: s.variableCodigo,
        expresion: s.expresion,
      })),
      variablePlanMappings: variablePlanMappings.map((m) => ({
        variableCodigo: m.variableCodigo,
        planEvaluacionOfertaId: m.planEvaluacionOfertaId,
      })),
      planesEvaluacion,
    };
  }

  // Obtener fórmula de evaluación por ID de sílabo (la fórmula activa)
  async getFormulaEvaluacionBySilaboId(silaboId: number) {
    // Obtener la fórmula activa del sílabo
    const [formula] = await this.db
      .select({
        id: schema.formulaEvaluacionRegla.id,
        silaboId: schema.formulaEvaluacionRegla.silaboId,
        nombreRegla: schema.formulaEvaluacionRegla.nombreRegla,
        variableFinalCodigo: schema.formulaEvaluacionRegla.variableFinalCodigo,
        expresionFinal: schema.formulaEvaluacionRegla.expresionFinal,
        activo: schema.formulaEvaluacionRegla.activo,
      })
      .from(schema.formulaEvaluacionRegla)
      .where(
        and(
          eq(schema.formulaEvaluacionRegla.silaboId, silaboId),
          eq(schema.formulaEvaluacionRegla.activo, true),
        ),
      )
      .limit(1);

    if (!formula) return null;

    // Reutilizar la lógica del método anterior
    return this.getFormulaEvaluacion(formula.id);
  }

  // Crear nueva fórmula de evaluación
  async createFormulaEvaluacion(data: {
    silaboId: number;
    nombreRegla: string;
    variableFinalCodigo: string;
    expresionFinal: string;
    activo: boolean;
    variables: Array<{
      codigo: string;
      nombre: string;
      tipo?: string;
      descripcion?: string;
      orden?: number;
    }>;
    subformulas: Array<{
      variableCodigo: string;
      expresion: string;
    }>;
    variablePlanMappings: Array<{
      variableCodigo: string;
      planEvaluacionOfertaId: number;
    }>;
  }) {
    return await this.db.transaction(async (tx) => {
      // 1. Insertar la fórmula principal
      const [formula] = await tx
        .insert(schema.formulaEvaluacionRegla)
        .values({
          silaboId: data.silaboId,
          nombreRegla: data.nombreRegla,
          variableFinalCodigo: data.variableFinalCodigo,
          expresionFinal: data.expresionFinal,
          activo: data.activo,
        })
        .returning({
          id: schema.formulaEvaluacionRegla.id,
          silaboId: schema.formulaEvaluacionRegla.silaboId,
          nombreRegla: schema.formulaEvaluacionRegla.nombreRegla,
          variableFinalCodigo:
            schema.formulaEvaluacionRegla.variableFinalCodigo,
          expresionFinal: schema.formulaEvaluacionRegla.expresionFinal,
          activo: schema.formulaEvaluacionRegla.activo,
        });

      // 2. Insertar las variables
      if (data.variables.length > 0) {
        await tx.insert(schema.formulaEvaluacionVariable).values(
          data.variables.map((v, index) => ({
            formulaEvaluacionReglaId: formula.id,
            codigo: v.codigo,
            nombre: v.nombre,
            tipo: v.tipo || "",
            descripcion: v.descripcion || null,
            orden: v.orden !== undefined ? v.orden : index,
          })),
        );
      }

      // 3. Insertar las subfórmulas
      if (data.subformulas.length > 0) {
        await tx.insert(schema.formulaEvaluacionSubformula).values(
          data.subformulas.map((s) => ({
            formulaEvaluacionReglaId: formula.id,
            variableCodigo: s.variableCodigo,
            expresion: s.expresion,
          })),
        );
      }

      // 4. Insertar los mapeos de variable a plan
      if (data.variablePlanMappings.length > 0) {
        await tx.insert(schema.formulaEvaluacionVariablePlan).values(
          data.variablePlanMappings.map((m) => ({
            formulaEvaluacionReglaId: formula.id,
            variableCodigo: m.variableCodigo,
            planEvaluacionOfertaId: m.planEvaluacionOfertaId,
          })),
        );
      }

      // Retornar la estructura completa insertada
      return {
        id: formula.id,
        silaboId: formula.silaboId,
        nombreRegla: formula.nombreRegla,
        variableFinalCodigo: formula.variableFinalCodigo,
        expresionFinal: formula.expresionFinal,
        activo: formula.activo,
        variables: data.variables,
        subformulas: data.subformulas,
        variablePlanMappings: data.variablePlanMappings,
      };
    });
  }

  // Actualizar fórmula de evaluación existente
  async updateFormulaEvaluacion(
    id: number,
    data: {
      nombreRegla?: string;
      variableFinalCodigo?: string;
      expresionFinal?: string;
      activo?: boolean;
      variables?: Array<{
        codigo: string;
        nombre: string;
        tipo?: string;
        descripcion?: string;
        orden?: number;
      }>;
      subformulas?: Array<{
        variableCodigo: string;
        expresion: string;
      }>;
      variablePlanMappings?: Array<{
        variableCodigo: string;
        planEvaluacionOfertaId: number;
      }>;
    },
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Actualizar la fórmula principal si hay campos para actualizar
      const updateFields: any = {};
      if (data.nombreRegla !== undefined)
        updateFields.nombreRegla = data.nombreRegla;
      if (data.variableFinalCodigo !== undefined)
        updateFields.variableFinalCodigo = data.variableFinalCodigo;
      if (data.expresionFinal !== undefined)
        updateFields.expresionFinal = data.expresionFinal;
      if (data.activo !== undefined) updateFields.activo = data.activo;

      let updatedFormula;
      if (Object.keys(updateFields).length > 0) {
        [updatedFormula] = await tx
          .update(schema.formulaEvaluacionRegla)
          .set(updateFields)
          .where(eq(schema.formulaEvaluacionRegla.id, id))
          .returning({
            id: schema.formulaEvaluacionRegla.id,
            silaboId: schema.formulaEvaluacionRegla.silaboId,
            nombreRegla: schema.formulaEvaluacionRegla.nombreRegla,
            variableFinalCodigo:
              schema.formulaEvaluacionRegla.variableFinalCodigo,
            expresionFinal: schema.formulaEvaluacionRegla.expresionFinal,
            activo: schema.formulaEvaluacionRegla.activo,
          });
      } else {
        // Si no hay campos para actualizar, obtener la fórmula actual
        [updatedFormula] = await tx
          .select({
            id: schema.formulaEvaluacionRegla.id,
            silaboId: schema.formulaEvaluacionRegla.silaboId,
            nombreRegla: schema.formulaEvaluacionRegla.nombreRegla,
            variableFinalCodigo:
              schema.formulaEvaluacionRegla.variableFinalCodigo,
            expresionFinal: schema.formulaEvaluacionRegla.expresionFinal,
            activo: schema.formulaEvaluacionRegla.activo,
          })
          .from(schema.formulaEvaluacionRegla)
          .where(eq(schema.formulaEvaluacionRegla.id, id));
      }

      if (!updatedFormula) {
        throw new Error(`Fórmula con ID ${id} no encontrada`);
      }

      // 2. Si se proporcionan nuevas variables, reemplazarlas
      if (data.variables !== undefined) {
        // Eliminar variables existentes
        await tx
          .delete(schema.formulaEvaluacionVariable)
          .where(
            eq(schema.formulaEvaluacionVariable.formulaEvaluacionReglaId, id),
          );

        // Insertar nuevas variables
        if (data.variables.length > 0) {
          await tx.insert(schema.formulaEvaluacionVariable).values(
            data.variables.map((v, index) => ({
              formulaEvaluacionReglaId: id,
              codigo: v.codigo,
              nombre: v.nombre,
              tipo: v.tipo || "",
              descripcion: v.descripcion || null,
              orden: v.orden !== undefined ? v.orden : index,
            })),
          );
        }
      }

      // 3. Si se proporcionan nuevas subfórmulas, reemplazarlas
      if (data.subformulas !== undefined) {
        // Eliminar subfórmulas existentes
        await tx
          .delete(schema.formulaEvaluacionSubformula)
          .where(
            eq(schema.formulaEvaluacionSubformula.formulaEvaluacionReglaId, id),
          );

        // Insertar nuevas subfórmulas
        if (data.subformulas.length > 0) {
          await tx.insert(schema.formulaEvaluacionSubformula).values(
            data.subformulas.map((s) => ({
              formulaEvaluacionReglaId: id,
              variableCodigo: s.variableCodigo,
              expresion: s.expresion,
            })),
          );
        }
      }

      // 4. Si se proporcionan nuevos mapeos, reemplazarlos
      if (data.variablePlanMappings !== undefined) {
        // Eliminar mapeos existentes
        await tx
          .delete(schema.formulaEvaluacionVariablePlan)
          .where(
            eq(
              schema.formulaEvaluacionVariablePlan.formulaEvaluacionReglaId,
              id,
            ),
          );

        // Insertar nuevos mapeos
        if (data.variablePlanMappings.length > 0) {
          await tx.insert(schema.formulaEvaluacionVariablePlan).values(
            data.variablePlanMappings.map((m) => ({
              formulaEvaluacionReglaId: id,
              variableCodigo: m.variableCodigo,
              planEvaluacionOfertaId: m.planEvaluacionOfertaId,
            })),
          );
        }
      }

      // Obtener y retornar la estructura completa actualizada
      const finalVariables = await tx
        .select({
          codigo: schema.formulaEvaluacionVariable.codigo,
          nombre: schema.formulaEvaluacionVariable.nombre,
          tipo: schema.formulaEvaluacionVariable.tipo,
          descripcion: schema.formulaEvaluacionVariable.descripcion,
          orden: schema.formulaEvaluacionVariable.orden,
        })
        .from(schema.formulaEvaluacionVariable)
        .where(
          eq(schema.formulaEvaluacionVariable.formulaEvaluacionReglaId, id),
        )
        .orderBy(asc(schema.formulaEvaluacionVariable.orden));

      const finalSubformulas = await tx
        .select({
          variableCodigo: schema.formulaEvaluacionSubformula.variableCodigo,
          expresion: schema.formulaEvaluacionSubformula.expresion,
        })
        .from(schema.formulaEvaluacionSubformula)
        .where(
          eq(schema.formulaEvaluacionSubformula.formulaEvaluacionReglaId, id),
        );

      const finalMappings = await tx
        .select({
          variableCodigo: schema.formulaEvaluacionVariablePlan.variableCodigo,
          planEvaluacionOfertaId:
            schema.formulaEvaluacionVariablePlan.planEvaluacionOfertaId,
        })
        .from(schema.formulaEvaluacionVariablePlan)
        .where(
          eq(schema.formulaEvaluacionVariablePlan.formulaEvaluacionReglaId, id),
        );

      return {
        id: updatedFormula.id,
        silaboId: updatedFormula.silaboId,
        nombreRegla: updatedFormula.nombreRegla,
        variableFinalCodigo: updatedFormula.variableFinalCodigo,
        expresionFinal: updatedFormula.expresionFinal,
        activo: updatedFormula.activo,
        variables: finalVariables.map((v) => ({
          codigo: v.codigo,
          nombre: v.nombre,
          tipo: v.tipo || undefined,
          descripcion: v.descripcion || undefined,
          orden: v.orden || undefined,
        })),
        subformulas: finalSubformulas.map((s) => ({
          variableCodigo: s.variableCodigo,
          expresion: s.expresion,
        })),
        variablePlanMappings: finalMappings.map((m) => ({
          variableCodigo: m.variableCodigo,
          planEvaluacionOfertaId: m.planEvaluacionOfertaId,
        })),
      };
    });
  }

  // Actualizar estrategias metodológicas por ID
  async putEstrategiasMetodologicas(id: number, estrategias: string) {
    const result = await this.db
      .update(schema.silabo)
      .set({ estrategiasMetodologicas: estrategias })
      .where(eq(schema.silabo.id, id))
      .returning({ id: schema.silabo.id });

    return result[0] ?? null;
  }

  // Actualizar recursos didácticos por ID
  async putRecursosDidacticosNotas(id: number, recursos: string) {
    const result = await this.db
      .update(schema.silabo)
      .set({ recursosDidacticosNotas: recursos })
      .where(eq(schema.silabo.id, id))
      .returning({ id: schema.silabo.id });

    return result[0] ?? null;
  }

  // Crear estrategias metodológicas
  async postEstrategiasMetodologicas(estrategias: string) {
    const result = await this.db
      .insert(schema.silabo)
      .values({
        estrategiasMetodologicas: estrategias,
      })
      .returning({
        id: schema.silabo.id,
        estrategiasMetodologicas: schema.silabo.estrategiasMetodologicas,
      });

    return result[0] ?? null;
  }

  // Crear recursos didácticos
  async postRecursosDidacticosNotas(recursos: string) {
    const result = await this.db
      .insert(schema.silabo)
      .values({
        recursosDidacticosNotas: recursos,
      })
      .returning({
        id: schema.silabo.id,
        recursosDidacticosNotas: schema.silabo.recursosDidacticosNotas,
      });

    return result[0] ?? null;
  }

  async getAllCourses() {
    try {
      const result = await this.db
        .select({
          id: silabo.id,
          code: silabo.cursoCodigo,
          name: silabo.cursoNombre,
          ciclo: silabo.ciclo,
          escuela: silabo.escuelaProfesional,
          estadoRevision: silabo.estadoRevision,
        })
        .from(silabo)
        .orderBy(asc(silabo.cursoCodigo));

      return result.map((r) => ({
        id: r.id,
        code: r.code ?? null,
        name: r.name ?? null,
        ciclo: r.ciclo ?? null,
        escuela: r.escuela ?? null,
        estadoRevision: r.estadoRevision ?? null,
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

  // ========================================
  // SECCIÓN I: DATOS GENERALES
  // ========================================
  async updateDatosGenerales(id: number, data: any) {
    const result = await this.db
      .update(silabo)
      .set(data)
      .where(eq(silabo.id, id))
      .returning();

    return result[0] || null;
  }

  // ========================================
  // SECCIÓN IV: UNIDADES
  // ========================================
  async findUnidadesBySilaboId(silaboId: number) {
    return await this.db
      .select()
      .from(schema.silaboUnidad)
      .where(eq(schema.silaboUnidad.silaboId, silaboId))
      .orderBy(schema.silaboUnidad.numero);
  }

  async findUnidadById(silaboId: number, unidadId: number) {
    const [unidad] = await this.db
      .select()
      .from(schema.silaboUnidad)
      .where(
        and(
          eq(schema.silaboUnidad.id, unidadId),
          eq(schema.silaboUnidad.silaboId, silaboId),
        ),
      );

    return unidad || null;
  }

  async findSemanasByUnidadId(unidadId: number) {
    return await this.db
      .select()
      .from(schema.silaboUnidadSemana)
      .where(eq(schema.silaboUnidadSemana.silaboUnidadId, unidadId))
      .orderBy(schema.silaboUnidadSemana.semana);
  }

  async insertUnidad(silaboId: number, data: any) {
    const result = await this.db
      .insert(schema.silaboUnidad)
      .values({
        silaboId,
        ...data,
      })
      .returning();

    return result[0];
  }

  async insertUnidadSemana(unidadId: number, semanaData: any) {
    const result = await this.db
      .insert(schema.silaboUnidadSemana)
      .values({
        silaboUnidadId: unidadId,
        ...semanaData,
      })
      .returning();

    return result[0];
  }

  async updateUnidad(silaboId: number, unidadId: number, data: any) {
    const result = await this.db
      .update(schema.silaboUnidad)
      .set(data)
      .where(
        and(
          eq(schema.silaboUnidad.id, unidadId),
          eq(schema.silaboUnidad.silaboId, silaboId),
        ),
      )
      .returning();

    return result[0] || null;
  }

  // Permite encontrar una semana específica dentro de una unidad, dado el ID del sílabo, ID de la unidad y número de semana
  async findUnidadSemana(silaboId: number, unidadId: number, semana: number) {
    const [result] = await this.db
      .select({
        id: schema.silaboUnidadSemana.id,
        silaboUnidadId: schema.silaboUnidadSemana.silaboUnidadId,
        semana: schema.silaboUnidadSemana.semana,
      })
      .from(schema.silaboUnidadSemana)
      .innerJoin(
        schema.silaboUnidad,
        eq(schema.silaboUnidadSemana.silaboUnidadId, schema.silaboUnidad.id),
      )
      .where(
        and(
          eq(schema.silaboUnidad.id, unidadId),
          eq(schema.silaboUnidad.silaboId, silaboId),
          eq(schema.silaboUnidadSemana.semana, semana),
        ),
      )
      .limit(1);

    return result || null;
  }

  // listar los contenidos conceptuales asociados a una semana específica dentro de una unidad
  async findContenidosConceptualesBySemana(
    silaboId: number,
    unidadId: number,
    semana: number,
  ) {
    const semanaRow = await this.findUnidadSemana(silaboId, unidadId, semana);

    if (!semanaRow) {
      return null;
    }

    return await this.db
      .select()
      .from(schema.silaboContenidoConceptual)
      .where(
        eq(schema.silaboContenidoConceptual.silaboUnidadSemanaId, semanaRow.id),
      )
      .orderBy(
        asc(schema.silaboContenidoConceptual.orden),
        asc(schema.silaboContenidoConceptual.id),
      );
  }

  // crear contenido conceptual asociado a una semana específica dentro de una unidad
  async insertContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    data: { descripcion: string; orden?: number },
  ) {
    const semanaRow = await this.findUnidadSemana(silaboId, unidadId, semana);

    if (!semanaRow) {
      return null;
    }

    const [result] = await this.db
      .insert(schema.silaboContenidoConceptual)
      .values({
        silaboUnidadSemanaId: semanaRow.id,
        descripcion: data.descripcion,
        orden: data.orden ?? 1,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      })
      .returning();

    return result;
  }

  // buscar conenido por id
  async findContenidoConceptualById(
    silaboId: number,
    unidadId: number,
    semana: number,
    contenidoId: number,
  ) {
    const semanaRow = await this.findUnidadSemana(silaboId, unidadId, semana);

    if (!semanaRow) {
      return null;
    }

    const [result] = await this.db
      .select()
      .from(schema.silaboContenidoConceptual)
      .where(
        and(
          eq(schema.silaboContenidoConceptual.id, contenidoId),
          eq(
            schema.silaboContenidoConceptual.silaboUnidadSemanaId,
            semanaRow.id,
          ),
        ),
      )
      .limit(1);

    return result || null;
  }

  // actualizar contenido conecptula

  async updateContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    contenidoId: number,
    data: { descripcion: string; orden?: number },
  ) {
    const existing = await this.findContenidoConceptualById(
      silaboId,
      unidadId,
      semana,
      contenidoId,
    );

    if (!existing) {
      return null;
    }

    const [result] = await this.db
      .update(schema.silaboContenidoConceptual)
      .set({
        descripcion: data.descripcion,
        orden: data.orden ?? existing.orden,
        actualizadoEn: new Date().toISOString(),
      })
      .where(eq(schema.silaboContenidoConceptual.id, contenidoId))
      .returning();

    return result || null;
  }

  // eliminar contenido conecptual
  async deleteContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    contenidoId: number,
  ) {
    const existing = await this.findContenidoConceptualById(
      silaboId,
      unidadId,
      semana,
      contenidoId,
    );

    if (!existing) {
      return false;
    }

    const result = await this.db
      .delete(schema.silaboContenidoConceptual)
      .where(eq(schema.silaboContenidoConceptual.id, contenidoId))
      .returning();

    return result.length > 0;
  }

  async updateUnidadSemana(semanaId: number, semanaData: any) {
    const result = await this.db
      .update(schema.silaboUnidadSemana)
      .set(semanaData)
      .where(eq(schema.silaboUnidadSemana.id, semanaId))
      .returning();

    return result[0] || null;
  }

  async deleteUnidadSemanasByUnidadId(unidadId: number) {
    await this.db
      .delete(schema.silaboUnidadSemana)
      .where(eq(schema.silaboUnidadSemana.silaboUnidadId, unidadId));
  }

  async deleteUnidad(silaboId: number, unidadId: number) {
    const result = await this.db
      .delete(schema.silaboUnidad)
      .where(
        and(
          eq(schema.silaboUnidad.id, unidadId),
          eq(schema.silaboUnidad.silaboId, silaboId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  // ========================================
  // SECCIÓN VIII: FUENTES
  // ========================================
  async findFuentesBySilaboId(silaboId: number) {
    return await this.db
      .select()
      .from(schema.silaboFuente)
      .where(eq(schema.silaboFuente.silaboId, silaboId));
  }

  async insertFuente(silaboId: number, data: any) {
    const result = await this.db
      .insert(schema.silaboFuente)
      .values({
        silaboId,
        tipo: data.tipo,
        autores: data.autores || null,
        anio: data.anio || null,
        titulo: data.titulo,
        editorialRevista: data.editorialRevista || null,
        ciudad: data.ciudad || null,
        isbnIssn: data.isbnIssn || null,
        doiUrl: data.doiUrl || null,
        notas: data.notas || null,
      })
      .returning();

    return result[0];
  }

  async updateFuente(silaboId: number, fuenteId: number, data: any) {
    const result = await this.db
      .update(schema.silaboFuente)
      .set(data)
      .where(
        and(
          eq(schema.silaboFuente.id, fuenteId),
          eq(schema.silaboFuente.silaboId, silaboId),
        ),
      )
      .returning();

    return result[0] || null;
  }

  async deleteFuente(silaboId: number, fuenteId: number) {
    const result = await this.db
      .delete(schema.silaboFuente)
      .where(
        and(
          eq(schema.silaboFuente.id, fuenteId),
          eq(schema.silaboFuente.silaboId, silaboId),
        ),
      )
      .returning();

    return result.length > 0;
  }

  // ========================================
  // SECCIÓN IX: APORTES
  // ========================================
  async findContributionsBySilaboId(silaboId: number) {
    return await this.db
      .select()
      .from(schema.silaboAporteResultadoPrograma)
      .where(eq(schema.silaboAporteResultadoPrograma.silaboId, silaboId));
  }

  async updateContribution(
    silaboId: number,
    contributionId: number,
    data: any,
  ) {
    // Nota: silaboAporteResultadoPrograma usa composite primary key
    const result = await this.db
      .update(schema.silaboAporteResultadoPrograma)
      .set(data)
      .where(eq(schema.silaboAporteResultadoPrograma.silaboId, silaboId))
      .returning();

    return result[0] || null;
  }

  // ========================================
  // REVISIÓN
  // ========================================
  async findAllRevisions() {
    return await this.db
      .select()
      .from(schema.silaboRevisionHistorial)
      .orderBy(sql`${schema.silaboRevisionHistorial.creadoEn} DESC`);
  }

  async findRevisionBySilaboId(silaboId: number) {
    return await this.db
      .select()
      .from(schema.silaboRevisionHistorial)
      .where(eq(schema.silaboRevisionHistorial.silaboId, silaboId))
      .orderBy(sql`${schema.silaboRevisionHistorial.creadoEn} DESC`);
  }

  async insertRevision(silaboId: number, data: any) {
    const result = await this.db
      .insert(schema.silaboRevisionHistorial)
      .values({
        silaboId,
        ...data,
      })
      .returning();

    return result[0];
  }

  async aprobarSilabo(silaboId: number) {
    const result = await this.db
      .update(silabo)
      .set({
        estadoRevision: "APROBADO",
      })
      .where(eq(silabo.id, silaboId))
      .returning();

    return result[0] || null;
  }
}

export const syllabusRepository = new SyllabusRepository();

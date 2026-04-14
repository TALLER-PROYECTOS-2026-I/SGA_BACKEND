import { syllabusRepository } from "./repository";
import {
  UpsertCompetenciesSchema,
  CreateComponentsSchema, //
  CreateAttitudesSchema, //
  FuenteCreate,
  FuenteUpdate,
  UnidadCreate,
  UnidadUpdate,
  ContenidoConceptualCreateSchema,
  ContenidoConceptualUpdateSchema,
  ContenidoConceptualCreate,
  ContenidoConceptualUpdate,
  DatosGeneralesUpdate,
  DesaprobarSilabo,
  FormulaEvaluacionCompleteSchema,
  FormulaEvaluacionCreateSchema,
  FormulaEvaluacionUpdateSchema,
  FormulaEvaluacionCreate,
  FormulaEvaluacionUpdate,
} from "./types";
import { SyllabusCreateSchema } from "./types";
import { SumillaSchema } from "./types";
import { AppError } from "../../error";
import { z, ZodError } from "zod";
import { ContributionCreateType } from "./types";

export class SyllabusService {
  // ---------- COMPETENCIAS ----------
  async getCompetencies(syllabusId: string) {
    return syllabusRepository.listCompetencies(syllabusId);
  }

  async getSumillaBySilaboId(silaboId: number) {
    const result = await syllabusRepository.findSumillaBySilaboId(silaboId);

    return result;
  }

  async removeCompetency(syllabusId: string, id: string) {
    const { deleted } = await syllabusRepository.deleteCompetency(
      syllabusId,
      id,
    );
    if (!deleted)
      throw new AppError("NotFound", "NOT_FOUND", "Competency not found");
    return { ok: true, deleted, message: "🗑️ El item fue eliminado con éxito" };
  }

  async createCompetencies(syllabusId: string, body: unknown) {
    const parsed = UpsertCompetenciesSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    // OrderSchema en types.ts ya transforma a number | undefined
    const items = parsed.data.items.map(({ text, order, code }) => ({
      text,
      order: order ?? null, // si tu DB quiere null; si acepta undefined, puedes dejar `order`
      code: code ?? null,
    }));

    const res = await syllabusRepository.insertCompetencies(syllabusId, items);
    return {
      ok: true as const,
      inserted: res.inserted,
      message: "El item se creo con éxito!!",
    };
  }

  async updateCompetencies(syllabusId: string, body: unknown) {
    const parsed = UpsertCompetenciesSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const items = parsed.data.items.map(({ id, text, order, code }) => ({
      id,
      text,
      order: order ?? null,
      code: code ?? null,
    }));

    const res = await syllabusRepository.syncCompetencies(sId, items);
    return {
      ok: true as const,
      created: res.created,
      updated: res.updated,
      deleted: res.deleted,
      message: `✅ Sincronizado: ${res.created} creados, ${res.updated} actualizados, ${res.deleted} eliminados`,
    };
  }

  // ---------- COMPONENTES ----------
  /**
   * Determina si un código representa un contenido actitudinal
   * Regla: Si el código contiene solo letras (sin números ni puntos), es actitudinal
   * Ejemplos actitudinales: "a", "b", "A", "B"
   * Ejemplos competencias: "a.1", "a.2", "b.1", "1.b", "4.a", "6.a"
   */
  private isAttitudinalCode(code: string | null): boolean {
    if (!code) return false;
    const trimmed = code.trim();
    // Es actitudinal si solo contiene letras (sin números ni puntos)
    return /^[A-Za-z]+$/.test(trimmed) && trimmed.length <= 2;
  }

  async getComponents(syllabusId: string, grupo?: string) {
    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    // Si se especifica un grupo, usar el método con filtro, sino usar el método que lista todos
    const rows = grupo
      ? await syllabusRepository.listAllComponentsByGrupo(sId, grupo)
      : await syllabusRepository.listComponents(sId);

    // Mapear y clasificar los items
    const mappedItems = rows.map((r) => {
      const isAttitudinal = this.isAttitudinalCode(r.codigo);

      return {
        id: r.id,
        silaboId: r.silaboId,
        text: r.descripcion,
        code: r.codigo ?? null,
        order: r.orden ?? null,
        grupo: r.grupo,
        competenciaCodigoRelacionada: r.competenciaCodigoRelacionada ?? null,
        tipo: isAttitudinal ? "actitudinal" : "competencia",
        isAttitudinal,
      };
    });

    // Separar en dos grupos
    const competencias = mappedItems.filter((item) => !item.isAttitudinal);
    const actitudinales = mappedItems.filter((item) => item.isAttitudinal);

    return {
      items: mappedItems,
      competencias,
      actitudinales,
      total: mappedItems.length,
      totalCompetencias: competencias.length,
      totalActitudinales: actitudinales.length,
    };
  }

  async createComponents(syllabusId: string, body: unknown) {
    const parsed = CreateComponentsSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const items = parsed.data.items.map(({ text, order, code }) => ({
      text,
      order: order ?? null, // aprovechando la transform de OrderSchema
      code: code ?? null,
    }));

    const { inserted } = await syllabusRepository.insertComponents(sId, items);
    return {
      ok: true as const,
      inserted,
      message: "El item se creo con éxito!!",
    };
  }

  async updateComponents(syllabusId: string, body: unknown) {
    const parsed = CreateComponentsSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const items = parsed.data.items.map(
      ({ id, text, order, code, grupo }: any) => ({
        id,
        text,
        order: order ?? null,
        code: code ?? null,
        grupo: grupo ?? undefined,
      }),
    );

    const res = await syllabusRepository.syncComponents(sId, items);
    return {
      ok: true as const,
      created: res.created,
      updated: res.updated,
      deleted: res.deleted,
      message: `✅ Sincronizado: ${res.created} creados, ${res.updated} actualizados, ${res.deleted} eliminados`,
    };
  }

  async removeComponent(syllabusId: string, id: string) {
    const sId = Number(syllabusId);
    const cId = Number(id);
    if (Number.isNaN(sId) || Number.isNaN(cId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "Parámetros inválidos");
    }
    const { deleted } = await syllabusRepository.deleteComponent(sId, cId);
    if (!deleted) {
      throw new AppError("NotFound", "NOT_FOUND", "Component not found");
    }
    return { ok: true, deleted, message: "🗑️ El item fue eliminado con éxito" };
  }

  async findSyllabusAndUpdate(id: number) {
    console.log(id);
  }

  async getGeneralDataSyllabusById(id: number) {
    const data = await syllabusRepository.findGeneralDataById(id);
    if (!data) throw new AppError("Sílabo no encontrado", "NOT_FOUND");
    return data;
  }

  async createSyllabus(payload: unknown) {
    let data;
    try {
      // Validación con Zod
      data = SyllabusCreateSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "ValidationError",
          "BAD_REQUEST",
          "Datos inválidos: " +
            error.issues.map((e: any) => e.message).join(", "),
        );
      }
      throw error;
    }

    // (Opcional) reglas de negocio antes del insert
    // Ej: validar que el código no esté repetido
    // const existing = await this.repository.findByCodigo(data.codigoAsignatura);
    // if (existing) throw new Error("El sílabo ya existe para este código de asignatura.");

    const idNewSyllabus = await syllabusRepository.create(data);
    return idNewSyllabus;
  }

  // ---------- CONTENIDOS ACTITUDINALES ----------
  async getAttitudes(syllabusId: string) {
    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }
    const rows = await syllabusRepository.listAttitudes(sId);
    return rows.map((r: any) => ({
      id: r.id,
      silaboId: r.silaboId ?? r.silabo_id,
      text: r.descripcion ?? r.text,
      order: r.orden ?? r.order ?? null,
      code: r.code ?? r.codigo ?? null,
    }));
  }

  async createAttitudes(syllabusId: string, body: unknown) {
    const parsed = CreateAttitudesSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const items = parsed.data.items.map(({ text, order, code }) => ({
      text,
      order: order ?? null,
      code: code ?? null,
    }));

    const { inserted } = await syllabusRepository.insertAttitudes(sId, items);
    return {
      ok: true as const,
      inserted,
      message: "El item se creo con éxito!!",
    };
  }

  async updateAttitudes(syllabusId: string, body: unknown) {
    const parsed = CreateAttitudesSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const items = parsed.data.items.map(({ id, text, order, code }: any) => ({
      id,
      text,
      order: order ?? null,
      code: code ?? null,
    }));

    const res = await syllabusRepository.syncAttitudes(sId, items);
    return {
      ok: true as const,
      created: res.created,
      updated: res.updated,
      deleted: res.deleted,
      message: `✅ Sincronizado: ${res.created} creados, ${res.updated} actualizados, ${res.deleted} eliminados`,
    };
  }

  async removeAttitude(syllabusId: string, id: string) {
    const sId = Number(syllabusId);
    const aId = Number(id);
    if (Number.isNaN(sId) || Number.isNaN(aId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "Parámetros inválidos");
    }
    const { deleted } = await syllabusRepository.deleteAttitude(sId, aId);
    if (!deleted) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "No se encontró el elemento para eliminar",
      );
    }
    return {
      ok: true as const,
      deleted,
      message: "🗑️ El item se elimino con éxito",
    };
  }
  async updateSumilla(idSyllabus: number, payload: unknown) {
    let sumilla;
    // ✅ Validar con Zod
    const parsed = SumillaSchema.parse(payload);
    sumilla = parsed.sumilla;
    if (!sumilla) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "Datos inválidos: " + "Error en la sumilla",
      );
    }

    // ✅ Actualizar en la BD
    await syllabusRepository.updateSumilla(idSyllabus, sumilla);

    return { message: "Sumilla actualizada correctamente" };
  }
  async registerSumilla(idSyllabus: number, payload: unknown) {
    // ✅ Validar con Zod
    const parsed = SumillaSchema.parse(payload);
    const sumilla = parsed.sumilla;
    if (!sumilla) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "Datos inválidos: " + "Error en la sumilla",
      );
    }

    // ✅ Actualizar en la BD
    await syllabusRepository.saveSumilla(idSyllabus, sumilla);

    return { message: "Sumilla registrada correctamente" };
  }

  /**
   * Convierte un string con formato separado por líneas en array de objetos {titulo, descripcion}
   * Formato esperado: "Título 1|Descripción 1\nTítulo 2|Descripción 2"
   * O simplemente: "Descripción 1\nDescripción 2" (sin títulos)
   */
  private parseTextToItems(
    text: string | null,
  ): Array<{ titulo: string; descripcion: string }> {
    if (!text) return [];

    return text
      .split("\n")
      .filter((item) => item.trim().length > 0)
      .map((item) => {
        const parts = item.split("|");
        if (parts.length >= 2) {
          return {
            titulo: parts[0].trim(),
            descripcion: parts[1].trim(),
          };
        }
        return {
          titulo: "",
          descripcion: item.trim(),
        };
      });
  }

  /**
   * Convierte array de objetos {titulo, descripcion} a string con formato separado por líneas
   */
  private itemsToText(
    items: Array<{ titulo: string; descripcion: string }>,
  ): string {
    return items
      .map((item) =>
        item.titulo ? `${item.titulo}|${item.descripcion}` : item.descripcion,
      )
      .join("\n");
  }

  async getEstrategiasMetodologicas(id: number) {
    const result = await syllabusRepository.getEstrategiasMetodologicas(id);

    // Convertir el texto a array de objetos
    if (result && result.estrategiasMetodologicas) {
      return {
        items: this.parseTextToItems(result.estrategiasMetodologicas),
      };
    }

    return { items: [] };
  }

  async getRecursosDidacticosNotas(id: number) {
    const result = await syllabusRepository.getRecursosDidacticosNotas(id);

    // Convertir el texto a array de objetos
    if (result && result.recursosDidacticosNotas) {
      return {
        items: this.parseTextToItems(result.recursosDidacticosNotas),
      };
    }

    return { items: [] };
  }

  async getFormulaEvaluacion(id: number) {
    const formula = await syllabusRepository.getFormulaEvaluacion(id);

    if (!formula) {
      throw new AppError(
        "Fórmula no encontrada",
        "NOT_FOUND",
        "La fórmula de evaluación solicitada no existe",
      );
    }

    // Validar la estructura con Zod
    try {
      return FormulaEvaluacionCompleteSchema.parse(formula);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "Error de validación",
          "BAD_REQUEST",
          "Error en la estructura de fórmula de evaluación: " +
            error.issues.map((e) => e.message).join(", "),
        );
      }
      throw error;
    }
  }

  async getFormulaEvaluacionBySilaboId(silaboId: number) {
    const formula =
      await syllabusRepository.getFormulaEvaluacionBySilaboId(silaboId);

    if (!formula) {
      throw new AppError(
        "Fórmula no encontrada",
        "NOT_FOUND",
        "No se encontró una fórmula activa para este sílabo",
      );
    }

    // Validar la estructura con Zod
    try {
      return FormulaEvaluacionCompleteSchema.parse(formula);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "Error de validación",
          "BAD_REQUEST",
          "Error en la estructura de fórmula de evaluación: " +
            error.issues.map((e) => e.message).join(", "),
        );
      }
      throw error;
    }
  }

  async createFormulaEvaluacion(data: FormulaEvaluacionCreate) {
    // Validar datos con Zod
    try {
      const validatedData = FormulaEvaluacionCreateSchema.parse(data);

      // Crear la fórmula en el repositorio
      const formula =
        await syllabusRepository.createFormulaEvaluacion(validatedData);

      return formula;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "Error de validación",
          "BAD_REQUEST",
          "Error en los datos de fórmula: " +
            error.issues
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join(", "),
        );
      }
      throw error;
    }
  }

  async updateFormulaEvaluacion(id: number, data: FormulaEvaluacionUpdate) {
    // Validar datos con Zod
    try {
      const validatedData = FormulaEvaluacionUpdateSchema.parse(data);

      // Actualizar la fórmula en el repositorio
      const formula = await syllabusRepository.updateFormulaEvaluacion(
        id,
        validatedData,
      );

      return formula;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "Error de validación",
          "BAD_REQUEST",
          "Error en los datos de actualización: " +
            error.issues
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join(", "),
        );
      }
      throw error;
    }
  }

  async putEstrategiasMetodologicas(
    id: number,
    data: string | Array<{ titulo: string; descripcion: string }>,
  ) {
    // Si recibe un array, convertirlo a texto
    const estrategias =
      typeof data === "string" ? data : this.itemsToText(data);

    return await syllabusRepository.putEstrategiasMetodologicas(
      id,
      estrategias,
    );
  }

  async putRecursosDidacticosNotas(
    id: number,
    data: string | Array<{ titulo: string; descripcion: string }>,
  ) {
    // Si recibe un array, convertirlo a texto
    const recursos = typeof data === "string" ? data : this.itemsToText(data);

    return await syllabusRepository.putRecursosDidacticosNotas(id, recursos);
  }

  async postEstrategiasMetodologicas(body: {
    estrategias_metodologicas: string;
  }) {
    const { estrategias_metodologicas } = body;
    return syllabusRepository.postEstrategiasMetodologicas(
      estrategias_metodologicas,
    );
  }

  async postRecursosDidacticosNotas(body: {
    recursos_didacticos_notas: string;
  }) {
    const { recursos_didacticos_notas } = body;
    return syllabusRepository.postRecursosDidacticosNotas(
      recursos_didacticos_notas,
    );
  }
  async updateRevisionStatus(id: number, payload: unknown) {
    // Validar payload con Zod
    const schema = z.object({
      estadoRevision: z.enum(["PENDIENTE", "REVISION"]),
    });

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const { estadoRevision } = parsed.data;

    // 🔍 Verificar si ya tiene ese estado antes de actualizar
    const current = await syllabusRepository.getStateById(id);
    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    if (current.estadoRevision === estadoRevision) {
      return {
        ok: false,
        message: `El estado ya está asignado como ${estadoRevision}`,
      };
    }

    // 🔄 Actualizar el estado
    await syllabusRepository.updateReviewStatus(id, estadoRevision);

    return {
      ok: true,
      message: `Estado actualizado a ${estadoRevision} correctamente`,
    };
  }

  // Cambiar estado del sílabo a "ANALIZANDO"
  async setAnalizandoStatus(id: number) {
    // Verificar que el sílabo existe
    const current = await syllabusRepository.getStateById(id);
    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    // Actualizar el estado a "ANALIZANDO"
    await syllabusRepository.updateReviewStatus(id, "ANALIZANDO");

    return {
      ok: true,
      message: "Estado del sílabo cambiado a ANALIZANDO correctamente",
      estadoAnterior: current.estadoRevision,
      estadoNuevo: "ANALIZANDO",
    };
  }

  // ---------- APORTE ----------
  async createAporte(data: ContributionCreateType) {
    const result = await syllabusRepository.createContribution(data);
    return result;
  }

  // ---------- SÍLABO COMPLETO ----------
  async getCompleteSyllabus(id: number) {
    const result = await syllabusRepository.getCompleteSyllabus(id);

    // Verificar que el sílabo exista
    if (!result) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        `Sílabo con ID ${id} no encontrado`,
      );
    }

    return result;
  }

  // ---------- REVISIÓN ----------
  async getAllCoursesInRevision(estado?: string, docenteId?: number) {
    const result = await syllabusRepository.findAllSyllabusInRevision(
      estado,
      docenteId,
    );
    return result;
  }

  async getSyllabusRevisionById(silaboId: number, docenteId?: number) {
    const permissions = await syllabusRepository.findSectionPermissions(
      silaboId,
      docenteId,
    );
    if (!permissions) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    return {
      permissions: permissions,
    };
  }

  async approveSyllabus(id: number, data: any) {
    // Verificar que el sílabo existe
    const syllabus = await syllabusRepository.findById(id);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    // Actualizar estado a APROBADO
    const result = await syllabusRepository.updateSyllabusStatus(id, {
      estadoRevision: "APROBADO",
      observaciones: data.observaciones || null,
      actualizadoPorDocenteId: data.docenteId || null,
    });

    return result;
  }

  async disapproveSyllabus(id: number, data: any) {
    // Verificar que el sílabo existe
    const syllabus = await syllabusRepository.findById(id);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    // Validar con el esquema DesaprobarSilabo
    const parsed = DesaprobarSilabo.safeParse(data);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }
    await syllabusRepository.disapproveSyllabus(id, parsed.data);
  }

  // ---------- DATOS DE REVISIÓN ----------
  async getRevisionData(id: number) {
    // Verificar que el sílabo existe
    const syllabus = await syllabusRepository.findById(id);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    // Obtener datos de revisión por secciones
    const revisionData = await syllabusRepository.findRevisionSections(id);

    return {
      silaboId: id,
      secciones: revisionData,
      totalSecciones: revisionData.length,
      seccionesRevisadas: revisionData.filter((s) => s.estado === "REVISADO")
        .length,
      seccionesPendientes: revisionData.filter((s) => s.estado === "PENDIENTE")
        .length,
    };
  }

  async saveRevisionData(id: number, data: any) {
    // Verificar que el sílabo existe
    const syllabus = await syllabusRepository.findById(id);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    // Validar que se proporcionen secciones
    if (!data.secciones || !Array.isArray(data.secciones)) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Se requiere un array de secciones",
      );
    }

    // Guardar o actualizar cada sección
    const results = await syllabusRepository.upsertRevisionSections(
      id,
      data.secciones,
      data.docenteId,
    );

    return {
      silaboId: id,
      seccionesGuardadas: results.length,
      secciones: results,
    };
  }

  async getAllCourses() {
    return await syllabusRepository.getAllCourses();
  }

  // ---------- SECCIÓN I: DATOS GENERALES ----------
  async updateDatosGenerales(id: number, data: DatosGeneralesUpdate) {
    const syllabus = await syllabusRepository.findById(id);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }
    return syllabusRepository.updateDatosGenerales(id, data);
  }

  // ---------- SECCIÓN IV: UNIDADES ----------
  async getUnidades(silaboId: number) {
    const unidades = await syllabusRepository.findUnidadesBySilaboId(silaboId);

    // Para cada unidad, obtener sus semanas
    const unidadesConSemanas = await Promise.all(
      unidades.map(async (unidad) => {
        const semanas = await syllabusRepository.findSemanasByUnidadId(
          unidad.id,
        );
        return {
          ...unidad,
          semanas,
        };
      }),
    );

    return unidadesConSemanas;
  }

  async getUnidadById(silaboId: number, unidadId: number) {
    const unidad = await syllabusRepository.findUnidadById(silaboId, unidadId);
    if (!unidad) {
      throw new AppError("NotFound", "NOT_FOUND", "Unidad no encontrada");
    }

    const semanas = await syllabusRepository.findSemanasByUnidadId(unidad.id);

    return {
      ...unidad,
      semanas,
    };
  }

  async createUnidad(silaboId: number, data: UnidadCreate) {
    const syllabus = await syllabusRepository.findById(silaboId);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const { semanas, ...unidadData } = data;
    const unidad = await syllabusRepository.insertUnidad(silaboId, unidadData);

    // Si hay semanas, crearlas
    if (semanas && semanas.length > 0) {
      await Promise.all(
        semanas.map((semana) =>
          syllabusRepository.insertUnidadSemana(unidad.id, semana),
        ),
      );
    }

    // Retornar unidad con sus semanas
    const semanasCreadas = await syllabusRepository.findSemanasByUnidadId(
      unidad.id,
    );
    return {
      ...unidad,
      semanas: semanasCreadas,
    };
  }

  async updateUnidad(silaboId: number, unidadId: number, data: UnidadUpdate) {
    const { semanas, ...unidadData } = data;

    // Actualizar datos de la unidad
    const unidad = await syllabusRepository.updateUnidad(
      silaboId,
      unidadId,
      unidadData,
    );

    if (!unidad) {
      throw new AppError("NotFound", "NOT_FOUND", "Unidad no encontrada");
    }

    // Si se proporcionan semanas, actualizar/crear/eliminar según corresponda
    if (semanas !== undefined) {
      // Eliminar todas las semanas existentes y crear las nuevas
      await syllabusRepository.deleteUnidadSemanasByUnidadId(unidadId);

      if (semanas.length > 0) {
        await Promise.all(
          semanas.map((semana) =>
            syllabusRepository.insertUnidadSemana(unidadId, semana),
          ),
        );
      }
    }

    // Retornar unidad actualizada con sus semanas
    const semanasActualizadas =
      await syllabusRepository.findSemanasByUnidadId(unidadId);
    return {
      ...unidad,
      semanas: semanasActualizadas,
    };
  }

  async deleteUnidad(silaboId: number, unidadId: number) {
    // Las semanas se eliminan automáticamente por CASCADE en la BD
    const deleted = await syllabusRepository.deleteUnidad(silaboId, unidadId);
    if (!deleted) {
      throw new AppError("NotFound", "NOT_FOUND", "Unidad no encontrada");
    }
    return { ok: true, message: "Unidad eliminada correctamente" };
  }

  // ---------- SECCIÓN VIII: FUENTES ----------
  async getFuentes(silaboId: number) {
    return syllabusRepository.findFuentesBySilaboId(silaboId);
  }

  async createFuente(silaboId: number, data: FuenteCreate) {
    const syllabus = await syllabusRepository.findById(silaboId);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }
    return syllabusRepository.insertFuente(silaboId, data);
  }

  async updateFuente(silaboId: number, fuenteId: number, data: FuenteUpdate) {
    const result = await syllabusRepository.updateFuente(
      silaboId,
      fuenteId,
      data,
    );
    if (!result) {
      throw new AppError("NotFound", "NOT_FOUND", "Fuente no encontrada");
    }
    return result;
  }

  async deleteFuente(silaboId: number, fuenteId: number) {
    const deleted = await syllabusRepository.deleteFuente(silaboId, fuenteId);
    if (!deleted) {
      throw new AppError("NotFound", "NOT_FOUND", "Fuente no encontrada");
    }
    return { ok: true, message: "Fuente eliminada correctamente" };
  }

  // ---------- SECCIÓN IX: APORTES (GET y PUT) ----------
  async getContributions(silaboId: number) {
    return syllabusRepository.findContributionsBySilaboId(silaboId);
  }

  async updateContribution(
    silaboId: number,
    contributionId: number,
    data: any,
  ) {
    const result = await syllabusRepository.updateContribution(
      silaboId,
      contributionId,
      data,
    );
    if (!result) {
      throw new AppError("NotFound", "NOT_FOUND", "Aporte no encontrado");
    }
    return result;
  }

  // ---------- REVISIÓN ----------
  async listRevisions() {
    return syllabusRepository.findAllRevisions();
  }

  async getRevision(silaboId: number) {
    return syllabusRepository.findRevisionBySilaboId(silaboId);
  }

  async createRevision(silaboId: number, data: any) {
    const syllabus = await syllabusRepository.findById(silaboId);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }
    return syllabusRepository.insertRevision(silaboId, data);
  }

  async aprobar(silaboId: number) {
    return syllabusRepository.aprobarSilabo(silaboId);
  }

  // listar contenidos
  async getContenidosConceptualesBySemana(
    silaboId: number,
    unidadId: number,
    semana: number,
  ) {
    const syllabus = await syllabusRepository.findById(silaboId);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const result = await syllabusRepository.findContenidosConceptualesBySemana(
      silaboId,
      unidadId,
      semana,
    );

    if (result === null) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "No se encontró la semana de la unidad",
      );
    }

    return result;
  }

  // crear contenido
  async createContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    body: unknown,
  ) {
    const parsed = ContenidoConceptualCreateSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const result = await syllabusRepository.insertContenidoConceptual(
      silaboId,
      unidadId,
      semana,
      parsed.data,
    );

    if (!result) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "No se encontró la semana de la unidad",
      );
    }

    return result;
  }

  // actualizar contenido
  async updateContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    contenidoId: number,
    body: unknown,
  ) {
    const parsed = ContenidoConceptualUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const result = await syllabusRepository.updateContenidoConceptual(
      silaboId,
      unidadId,
      semana,
      contenidoId,
      parsed.data,
    );

    if (!result) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Contenido conceptual no encontrado",
      );
    }

    return result;
  }

  // eliminar contenido
  async deleteContenidoConceptual(
    silaboId: number,
    unidadId: number,
    semana: number,
    contenidoId: number,
  ) {
    const deleted = await syllabusRepository.deleteContenidoConceptual(
      silaboId,
      unidadId,
      semana,
      contenidoId,
    );

    if (!deleted) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Contenido conceptual no encontrado",
      );
    }

    return {
      ok: true,
      message: "Contenido conceptual eliminado correctamente",
    };
  }
}

export const syllabusService = new SyllabusService();

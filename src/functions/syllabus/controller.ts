import {
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";
import { Updatable } from "../../types";
import { controller, route } from "../../lib/decorators";
import { syllabusService } from "./service";
import { response } from "../../utils/response";
import { AppError } from "../../error";
import {
  ContributionCreateSchema,
  FuenteCreateSchema,
  FuenteUpdateSchema,
  UnidadCreateSchema,
  UnidadUpdateSchema,
  DatosGeneralesUpdateSchema,
} from "./types";
import { STATUS_CODES } from "../../status-codes";
import type { UserSession } from "../auth/types";
import {
  getAuthUser,
  resolveAuthUserId,
  resolveAuthUserRole,
} from "../../lib/auth-context";
import {
  SYLLABUS_SECTION,
  type SyllabusSectionNumber,
} from "./section-permissions";

/**
 * SYLLABUS CONTROLLER - REORGANIZADO POR SECCIONES
 *
 * Estructura del Sílabo:
 * I.   Datos Generales
 * II.  Sumilla
 * III. Competencias y Componentes
 * IV.  Programación de Contenidos (Unidades)
 * V.   Estrategias Metodológicas
 * VI.  Recursos Didácticos
 * VII. Evaluación del Aprendizaje
 * VIII. Fuentes de Consulta
 * IX.  Aporte al Logro de Resultados
 */

@controller("syllabus")
export class SyllabusController implements Updatable {
  private getUser(req: HttpRequest): UserSession {
    const authUser = getAuthUser(req);

    if (!authUser) {
      throw new AppError(
        "Unauthorized",
        "UNAUTHORIZED",
        "Usuario autenticado requerido",
      );
    }

    const id = resolveAuthUserId(authUser);
    const role = resolveAuthUserRole(authUser);

    if (!id || !role) {
      throw new AppError(
        "Unauthorized",
        "UNAUTHORIZED",
        "Usuario autenticado requerido",
      );
    }

    return {
      ...authUser,
      id,
      role,
      email: authUser.email ?? (authUser as any).correo ?? "",
      name: authUser.name ?? null,
    } as UserSession;
  }

  private async assertRead(req: HttpRequest, silaboId: number) {
    await syllabusService.assertCanReadSyllabus(this.getUser(req), silaboId);
  }

  private async assertEdit(
    req: HttpRequest,
    silaboId: number,
    sectionNumber: SyllabusSectionNumber,
  ) {
    await syllabusService.assertCanEditSyllabus(
      this.getUser(req),
      silaboId,
      sectionNumber,
    );
  }

  private async assertReview(req: HttpRequest, silaboId: number) {
    await syllabusService.assertCanReviewSyllabus(this.getUser(req), silaboId);
  }

  // ========================================
  // SECCIÓN 0: OPERACIONES GENERALES
  // ========================================

  /**
   * POST /api/syllabus/
   * Crear un nuevo sílabo completo
   */
  @route("/", "POST")
  async create(
    req: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    const service = syllabusService;
    const authUser = getAuthUser(req);
    const user = this.getUser(req);
    const body = (await req.json()) as Record<string, unknown>;

    await service.assertCanCreateSyllabus(user, body);
    const idNewSyllabus = await service.createSyllabus(body, authUser ?? user);

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: "Sílabo creado correctamente",
        id: idNewSyllabus,
        syllabusId: idNewSyllabus,
      },
    };
  }

  /**
   * PUT /api/syllabus/
   * Actualización genérica (implementación pendiente)
   */
  @route("/", "PUT")
  async update(
    _req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    return {
      status: 501,
      jsonBody: { ok: false, message: "Generic update() not implemented" },
    };
  }

  /**
   * GET /api/syllabus/{id}/complete
   * Obtener sílabo completo con todas las secciones
   */
  @route("/{id}/complete", "GET")
  async getCompleteSyllabus(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (typeof id !== "number" || Number.isNaN(id) || !Number.isFinite(id)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const result = await syllabusService.getCompleteSyllabus(id);

    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        success: true,
        message: "Sílabo completo obtenido correctamente",
        data: result,
      },
    };
  }

  /**
   * GET /api/syllabus/catalog
   * Obtener catálogo de todos los sílabos con su sumilla si existe
   */
  @route("/catalog", "GET")
  async getSyllabusCatalog(
    _req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const result = await syllabusService.getSyllabusCatalog();

    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        success: true,
        message: "Catálogo de sumillas obtenido correctamente",
        data: result,
      },
    };
  }



  /**
   * PUT /api/syllabus/{syllabusId}/state
   * Actualizar estado de revisión del sílabo
   */
  @route("/{syllabusId}/state", "PUT")
  async updateState(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.syllabusId);
    if (isNaN(id)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID inválido");
    }

    const body = await req.json();
    await syllabusService.assertCanChangeSyllabusState(
      this.getUser(req),
      id,
      "state",
    );
    const result = await syllabusService.updateRevisionStatus(id, body);

    return { status: 200, jsonBody: result };
  }

  /**
   * PUT /api/syllabus/{id}/analizando
   * Cambiar estado del sílabo a "ANALIZANDO"
   */
  @route("/{id}/analizando", "PUT")
  async setAnalizando(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await syllabusService.assertCanChangeSyllabusState(
      this.getUser(req),
      id,
      "submit",
    );
    const result = await syllabusService.setAnalizandoStatus(id);
    return response.ok(result.message, result);
  }

  // ========================================
  // SECCIÓN I: DATOS GENERALES
  // ========================================

  /**
   * GET /api/syllabus/curriculum-context/preview?nombre=
   * Vista previa del contexto curricular por nombre (modo creación).
   */
  @route("/curriculum-context/preview", "GET")
  async getCurriculumContextPreview(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const nombre = String(req.query.get("nombre") ?? "").trim();

    if (!nombre) {
      return response.badRequest("El parámetro nombre es obligatorio");
    }

    const data = await syllabusService.getCurriculumContextPreview(
      nombre,
      this.getUser(req),
    );

    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        success: true,
        data,
      },
    };
  }

  /**
   * GET /api/syllabus/{syllabusId}/curriculum-context
   * Contexto curricular (malla estática + disponibilidad de sílabos en BD).
   */
  @route("/{syllabusId}/curriculum-context", "GET")
  async getCurriculumContext(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const id = Number(syllabusId);

    if (Number.isNaN(id) || id <= 0) {
      return response.badRequest("syllabusId inválido");
    }

    await this.assertRead(req, id);
    const data = await syllabusService.getCurriculumContext(
      id,
      this.getUser(req),
    );

    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        success: true,
        data,
      },
    };
  }

  /**
   * GET /api/syllabus/{syllabusId}/datos-generales
   * Obtener datos generales del sílabo
   */
  @route("/{syllabusId}/datos-generales", "GET")
  async getGeneralData(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const id = Number(syllabusId);
    if (Number.isNaN(id)) {
      return {
        status: STATUS_CODES.BAD_REQUEST,
        jsonBody: { name: "BadRequest", message: "syllabusId inválido" },
      };
    }
    await this.assertRead(req, id);
    const data = await syllabusService.getGeneralDataSyllabusById(id);
    return { status: STATUS_CODES.OK, jsonBody: data };
  }

  /**
   * PUT /api/syllabus/{id}/datos-generales
   * Actualizar datos generales del sílabo
   */
  @route("/{id}/datos-generales", "PUT")
  async updateGeneralData(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = await req.json();
    const parsed = DatosGeneralesUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.DATOS_GENERALES);
    const result = await syllabusService.updateDatosGenerales(id, parsed.data);

    return response.ok("Datos generales actualizados correctamente", result);
  }

  // ========================================
  // SECCIÓN II: SUMILLA
  // ========================================

  /**
   * GET /api/syllabus/{silaboId}/sumilla
   * Obtener sumilla del sílabo
   */
  @route("/{silaboId}/sumilla", "GET")
  async getSumillaBySilaboId(
    req: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.silaboId);
    await this.assertRead(req, id);
    const result = await syllabusService.getSumillaBySilaboId(id);
    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        success: true,
        content: result,
      },
    };
  }

  /**
   * POST /api/syllabus/{id}/sumilla
   * Crear sumilla del sílabo
   */
  @route("/{id}/sumilla", "POST")
  async registerSumilla(
    req: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    const service = syllabusService;
    const id = Number(req.params.id);
    const body = await req.json();
    await this.assertEdit(req, id, SYLLABUS_SECTION.SUMILLA);
    const result = await service.registerSumilla(id, body);
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: result.message,
      },
    };
  }

  /**
   * PUT /api/syllabus/{id}/sumilla
   * Actualizar sumilla del sílabo
   */
  @route("/{id}/sumilla", "PUT")
  async updateSumilla(
    req: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    const service = syllabusService;
    const id = Number(req.params.id);
    const body = await req.json();
    await this.assertEdit(req, id, SYLLABUS_SECTION.SUMILLA);
    const result = await service.updateSumilla(id, body);
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: result.message,
      },
    };
  }

  // ========================================
  // SECCIÓN III: COMPETENCIAS Y COMPONENTES
  // ========================================

  /**
   * GET /api/syllabus/{syllabusId}/competencies
   * Listar competencias del curso
   */
  @route("/{syllabusId}/competencies", "GET")
  async listCompetencies(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    await this.assertRead(req, Number(syllabusId));
    const items = await syllabusService.getCompetencies(syllabusId);
    return { status: 200, jsonBody: { items } };
  }

  /**
   * POST /api/syllabus/{syllabusId}/competencies
   * Crear competencias del curso
   */
  @route("/{syllabusId}/competencies", "POST")
  async createCompetencies(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.createCompetencies(syllabusId, body);
    return { status: 201, jsonBody: res };
  }

  /**
   * PUT /api/syllabus/{syllabusId}/competencies
   * Actualizar/sincronizar competencias del curso
   * Body: { items: [{ id?: number, text: string, code?: string, order?: number }] }
   * - Si el item tiene id: se actualiza
   * - Si el item NO tiene id: se crea
   * - Los items que no están en la lista: se eliminan
   */
  @route("/{syllabusId}/competencies", "PUT")
  async updateCompetencies(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.updateCompetencies(syllabusId, body);
    return { status: 200, jsonBody: res };
  }

  /**
   * DELETE /api/syllabus/{syllabusId}/competencies/{id}
   * Eliminar una competencia
   */
  @route("/{syllabusId}/competencies/{id}", "DELETE")
  async deleteCompetency(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId, id } = req.params as { syllabusId: string; id: string };
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.removeCompetency(syllabusId, id);
    return { status: 200, jsonBody: res };
  }

  /**
   * GET /api/syllabus/{syllabusId}/components
   * Listar componentes/capacidades
   * Query params: ?grupo=COMP (opcional, para filtrar por grupo específico)
   *
   * Retorna:
   * - items: todos los items (competencias + actitudinales)
   * - competencias: solo items con código de más de 1 letra
   * - actitudinales: solo items con código de 1 letra
   */
  @route("/{syllabusId}/components", "GET")
  async listComponents(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    await this.assertRead(req, Number(syllabusId));
    const grupo = req.query.get("grupo") || undefined;
    const result = await syllabusService.getComponents(syllabusId, grupo);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: grupo
          ? `Componentes con grupo='${grupo}' obtenidos correctamente`
          : "Componentes y contenidos actitudinales obtenidos correctamente",
        data: {
          items: result.items,
          competencias: result.competencias,
          actitudinales: result.actitudinales,
        },
        total: result.total,
        totalCompetencias: result.totalCompetencias,
        totalActitudinales: result.totalActitudinales,
      },
    };
  }

  /**
   * POST /api/syllabus/{syllabusId}/components
   * Crear componentes/capacidades
   */
  @route("/{syllabusId}/components", "POST")
  async createComponents(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.createComponents(syllabusId, body);
    return { status: 201, jsonBody: res };
  }

  /**
   * PUT /api/syllabus/{syllabusId}/components
   * Actualizar/sincronizar componentes/capacidades
   * Body: { items: [{ id?: number, text: string, code?: string, order?: number, grupo?: string }] }
   * - Si el item tiene id: se actualiza
   * - Si el item NO tiene id: se crea
   * - Los items que no están en la lista: se eliminan
   */
  @route("/{syllabusId}/components", "PUT")
  async updateComponents(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.updateComponents(syllabusId, body);
    return { status: 200, jsonBody: res };
  }

  /**
   * DELETE /api/syllabus/{syllabusId}/components/{id}
   * Eliminar un componente
   */
  @route("/{syllabusId}/components/{id}", "DELETE")
  async deleteComponent(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId, id } = req.params as { syllabusId: string; id: string };
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.removeComponent(syllabusId, id);
    return { status: 200, jsonBody: res };
  }

  /**
   * GET /api/syllabus/{syllabusId}/attitudes
   * Listar actitudes
   */
  @route("/{syllabusId}/attitudes", "GET")
  async listAttitudes(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    await this.assertRead(req, Number(syllabusId));
    const items = await syllabusService.getAttitudes(syllabusId);
    return { status: 200, jsonBody: { items } };
  }

  /**
   * POST /api/syllabus/{syllabusId}/attitudes
   * Crear actitudes
   */
  @route("/{syllabusId}/attitudes", "POST")
  async createAttitudes(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.createAttitudes(syllabusId, body);
    return { status: 201, jsonBody: res };
  }

  /**
   * PUT /api/syllabus/{syllabusId}/attitudes
   * Actualizar/sincronizar actitudes
   * Body: { items: [{ id?: number, text: string, code?: string, order?: number }] }
   * - Si el item tiene id: se actualiza
   * - Si el item NO tiene id: se crea
   * - Los items que no están en la lista: se eliminan
   */
  @route("/{syllabusId}/attitudes", "PUT")
  async updateAttitudes(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId } = req.params as { syllabusId: string };
    const body = await req.json();
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.updateAttitudes(syllabusId, body);
    return { status: 200, jsonBody: res };
  }

  /**
   * DELETE /api/syllabus/{syllabusId}/attitudes/{id}
   * Eliminar una actitud
   */
  @route("/{syllabusId}/attitudes/{id}", "DELETE")
  async deleteAttitude(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const { syllabusId, id } = req.params as { syllabusId: string; id: string };
    await this.assertEdit(
      req,
      Number(syllabusId),
      SYLLABUS_SECTION.COMPETENCIAS,
    );
    const res = await syllabusService.removeAttitude(syllabusId, id);
    return { status: 200, jsonBody: res };
  }

  // ========================================
  // SECCIÓN IV: PROGRAMACIÓN DE CONTENIDOS (UNIDADES)
  // ========================================

  /**
   * GET /api/syllabus/{id}/unidades
   * Listar todas las unidades del sílabo con sus semanas
   */
  @route("/{id}/unidades", "GET")
  async getUnidades(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const unidades = await syllabusService.getUnidades(id);

    return response.ok("Unidades obtenidas correctamente", unidades);
  }

  /**
   * GET /api/syllabus/{id}/unidades/{unidadId}
   * Obtener una unidad específica con todas sus semanas
   */
  @route("/{id}/unidades/{unidadId}", "GET")
  async getUnidadById(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const unidadId = Number(req.params.unidadId);

    if (Number.isNaN(id) || Number.isNaN(unidadId)) {
      return response.badRequest("IDs inválidos");
    }

    await this.assertRead(req, id);
    const unidad = await syllabusService.getUnidadById(id, unidadId);

    return response.ok("Unidad obtenida correctamente", unidad);
  }

  /**
   * POST /api/syllabus/{id}/unidades
   * Crear una nueva unidad con sus semanas
   */
  @route("/{id}/unidades", "POST")
  async createUnidad(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = await req.json();
    const parsed = UnidadCreateSchema.safeParse(body);

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.PROGRAMACION);
    const result = await syllabusService.createUnidad(id, parsed.data);

    return response.created("Unidad creada correctamente", result);
  }

  /**
   * PUT /api/syllabus/{id}/unidades/{unidadId}
   * Actualizar una unidad existente con sus semanas
   */
  @route("/{id}/unidades/{unidadId}", "PUT")
  async updateUnidad(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const unidadId = Number(req.params.unidadId);

    if (Number.isNaN(id) || Number.isNaN(unidadId)) {
      return response.badRequest("IDs inválidos");
    }

    const body = await req.json();
    const parsed = UnidadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.PROGRAMACION);
    const result = await syllabusService.updateUnidad(
      id,
      unidadId,
      parsed.data,
    );

    return response.ok("Unidad actualizada correctamente", result);
  }

  /**
   * DELETE /api/syllabus/{id}/unidades/{unidadId}
   * Eliminar una unidad y todas sus semanas (CASCADE)
   */
  @route("/{id}/unidades/{unidadId}", "DELETE")
  async deleteUnidad(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const unidadId = Number(req.params.unidadId);

    if (Number.isNaN(id) || Number.isNaN(unidadId)) {
      return response.badRequest("IDs inválidos");
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.PROGRAMACION);
    await syllabusService.deleteUnidad(id, unidadId);

    return response.ok("Unidad eliminada correctamente", null);
  }

  // ========================================
  // SECCIÓN V: ESTRATEGIAS METODOLÓGICAS
  // ========================================

  /**
   * GET /api/syllabus/{id}/estrategias_metodologicas
   * Obtener estrategias metodológicas
   */
  @route("/{id}/estrategias_metodologicas", "GET")
  async getEstrategiasMetodologicas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const result = await syllabusService.getEstrategiasMetodologicas(id);

    return response.ok(
      "Estrategias metodológicas obtenidas correctamente",
      result,
    );
  }

  /**
   * PUT /api/syllabus/{id}/estrategias_metodologicas
   * Actualizar estrategias metodológicas
   */
  @route("/{id}/estrategias_metodologicas", "PUT")
  async putEstrategiasMetodologicas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = (await req.json()) as { estrategias_metodologicas: string };
    const { estrategias_metodologicas } = body;
    await this.assertEdit(req, id, SYLLABUS_SECTION.ESTRATEGIAS);
    const result = await syllabusService.putEstrategiasMetodologicas(
      id,
      estrategias_metodologicas,
    );

    return response.ok(
      "Estrategias metodológicas actualizadas correctamente",
      result,
    );
  }

  /**
   * POST /api/syllabus/estrategias_metodologicas
   * Crear estrategias metodológicas (endpoint legacy)
   */
  @route("/estrategias_metodologicas", "POST")
  async postEstrategiasMetodologicas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const body = (await req.json()) as { estrategias_metodologicas: string };
    syllabusService.assertCanAccessReviewModule(this.getUser(req));
    const result = await syllabusService.postEstrategiasMetodologicas(body);
    return response.created("Sílabo creado correctamente", result);
  }

  // ========================================
  // SECCIÓN VI: RECURSOS DIDÁCTICOS
  // ========================================

  /**
   * GET /api/syllabus/{id}/recursos_didacticos_notas
   * Obtener recursos didácticos (notas)
   */
  @route("/{id}/recursos_didacticos_notas", "GET")
  async getRecursosDidacticosNotas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const result = await syllabusService.getRecursosDidacticosNotas(id);

    return response.ok("Recursos didácticos obtenidos correctamente", result);
  }

  /**
   * PUT /api/syllabus/{id}/recursos_didacticos_notas
   * Actualizar recursos didácticos (notas)
   */
  @route("/{id}/recursos_didacticos_notas", "PUT")
  async putRecursosDidacticosNotas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = (await req.json()) as { recursos_didacticos_notas: string };
    const { recursos_didacticos_notas } = body;
    await this.assertEdit(req, id, SYLLABUS_SECTION.RECURSOS);
    const result = await syllabusService.putRecursosDidacticosNotas(
      id,
      recursos_didacticos_notas,
    );

    return response.ok(
      "Recursos didácticos actualizados correctamente",
      result,
    );
  }

  /**
   * POST /api/syllabus/recursos_didacticos_notas
   * Crear recursos didácticos (endpoint legacy)
   */
  @route("/recursos_didacticos_notas", "POST")
  async postRecursosDidacticosNotas(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const body = (await req.json()) as { recursos_didacticos_notas: string };
    syllabusService.assertCanAccessReviewModule(this.getUser(req));
    const result = await syllabusService.postRecursosDidacticosNotas(body);
    return response.created("Sílabo creado correctamente", result);
  }

  // ========================================
  // SECCIÓN VII: EVALUACIÓN DEL APRENDIZAJE
  // ========================================

  /**
   * GET /api/syllabus/{id}/formula_evaluacion
   * Obtener fórmula de evaluación activa del sílabo
   */
  @route("/{id}/formula_evaluacion", "GET")
  async getFormulaEvaluacion(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const silaboId = Number(req.params.id);
    if (Number.isNaN(silaboId)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, silaboId);
    const result =
      await syllabusService.getFormulaEvaluacionBySilaboId(silaboId);

    return response.ok("Fórmula de evaluación obtenida correctamente", result);
  }

  /**
   * POST /api/syllabus/formula_evaluacion
   * Crear nueva fórmula de evaluación
   */
  @route("/formula_evaluacion", "POST")
  async createFormulaEvaluacion(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const body = (await req.json()) as any;

    try {
      await this.assertEdit(
        req,
        Number(body?.silaboId),
        SYLLABUS_SECTION.EVALUACION,
      );
      const result = await syllabusService.createFormulaEvaluacion(body);
      return response.created(
        "Fórmula de evaluación creada correctamente",
        result,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return error.toHttpResponse();
      }
      return response.serverError("Error al crear fórmula de evaluación");
    }
  }

  /**
   * PUT /api/syllabus/{id}/formula_evaluacion
   * Actualizar fórmula de evaluación existente
   */
  @route("/{id}/formula_evaluacion", "PUT")
  async updateFormulaEvaluacion(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de fórmula inválido");
    }

    const body = (await req.json()) as any;

    try {
      const silaboId = await syllabusService.getFormulaSyllabusId(id);
      await this.assertEdit(req, silaboId, SYLLABUS_SECTION.EVALUACION);
      const result = await syllabusService.updateFormulaEvaluacion(id, body);
      return response.ok(
        "Fórmula de evaluación actualizada correctamente",
        result,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return error.toHttpResponse();
      }
      return response.serverError("Error al actualizar fórmula de evaluación");
    }
  }

  // ========================================
  // SECCIÓN VIII: FUENTES DE CONSULTA
  // ========================================

  /**
   * GET /api/syllabus/{id}/fuentes
   * Listar fuentes bibliográficas
   */
  @route("/{id}/fuentes", "GET")
  async getFuentes(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const fuentes = await syllabusService.getFuentes(id);

    return response.ok("Fuentes obtenidas correctamente", fuentes);
  }

  /**
   * POST /api/syllabus/{id}/fuentes
   * Crear una nueva fuente bibliográfica
   */
  @route("/{id}/fuentes", "POST")
  async createFuente(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = await req.json();
    const parsed = FuenteCreateSchema.safeParse(body);

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.FUENTES);
    const result = await syllabusService.createFuente(id, parsed.data);

    return response.created("Fuente creada correctamente", result);
  }

  /**
   * PUT /api/syllabus/{id}/fuentes/{fuenteId}
   * Actualizar una fuente bibliográfica
   */
  @route("/{id}/fuentes/{fuenteId}", "PUT")
  async updateFuente(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const fuenteId = Number(req.params.fuenteId);

    if (Number.isNaN(id) || Number.isNaN(fuenteId)) {
      return response.badRequest("IDs inválidos");
    }

    const body = await req.json();
    const parsed = FuenteUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.FUENTES);
    const result = await syllabusService.updateFuente(
      id,
      fuenteId,
      parsed.data,
    );

    return response.ok("Fuente actualizada correctamente", result);
  }

  /**
   * DELETE /api/syllabus/{id}/fuentes/{fuenteId}
   * Eliminar una fuente bibliográfica
   */
  @route("/{id}/fuentes/{fuenteId}", "DELETE")
  async deleteFuente(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const fuenteId = Number(req.params.fuenteId);

    if (Number.isNaN(id) || Number.isNaN(fuenteId)) {
      return response.badRequest("IDs inválidos");
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.FUENTES);
    await syllabusService.deleteFuente(id, fuenteId);

    return response.ok("Fuente eliminada correctamente", null);
  }

  // ========================================
  // SECCIÓN IX: APORTE AL LOGRO DE RESULTADOS
  // ========================================

  /**
   * GET /api/syllabus/{id}/contribution
   * Obtener aportes a resultados del programa
   */
  @route("/{id}/contribution", "GET")
  async getContributions(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);
    const contributions = await syllabusService.getContributions(id);

    return response.ok("Aportes obtenidos correctamente", contributions);
  }

  /**
   * POST /api/syllabus/{syllabusId}/contribution
   * Crear aporte a resultados del programa
   */
  @route("/{syllabusId}/contribution", "POST")
  async createContribution(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const syllabusId = Number(req.params.syllabusId);
    if (Number.isNaN(syllabusId)) {
      return response.badRequest("ID de sílabo inválido");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = ContributionCreateSchema.safeParse({
      ...body,
      syllabusId,
    });

    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          message: "Datos inválidos",
          errors: parsed.error.issues,
        },
      };
    }

    await this.assertEdit(req, syllabusId, SYLLABUS_SECTION.APORTES);
    const result = await syllabusService.createAporte({
      ...parsed.data,
      syllabusId,
    });

    return response.created("Aporte creado correctamente", result);
  }

  /**
   * PUT /api/syllabus/{id}/contribution/{contributionId}
   * Actualizar aporte a resultados del programa
   */
  @route("/{id}/contribution/{contributionId}", "PUT")
  async updateContribution(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const contributionId = Number(req.params.contributionId);

    if (Number.isNaN(id) || Number.isNaN(contributionId)) {
      return response.badRequest("IDs inválidos");
    }

    const body = (await req.json()) as Record<string, unknown>;
    await this.assertEdit(req, id, SYLLABUS_SECTION.APORTES);
    const result = await syllabusService.updateContribution(
      id,
      contributionId,
      body,
    );

    return response.ok("Aporte actualizado correctamente", result);
  }

  /**
   * DELETE /api/syllabus/{id}/contribution/{codigo}
   * Eliminar aporte por código de resultado (RP1, RP2, ...)
   */
  @route("/{id}/contribution/{codigo}", "DELETE")
  async deleteContribution(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const codigo = decodeURIComponent(String(req.params.codigo ?? "")).trim();

    if (Number.isNaN(id) || !codigo) {
      return response.badRequest("IDs inválidos");
    }

    await this.assertEdit(req, id, SYLLABUS_SECTION.APORTES);
    const result = await syllabusService.deleteContribution(id, codigo);

    return response.ok("Aporte eliminado correctamente", result);
  }

  // ========================================
  // REVISIÓN Y APROBACIÓN
  // ========================================

  /**
   * GET /api/syllabus/revision
   * Listar sílabos en revisión
   */
  @route("/revision", "GET")
  async getSyllabusInRevision(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const estado = req.query.get("estado") || undefined;
    const docenteIdParam = req.query.get("docenteId");
    const docenteId = docenteIdParam ? Number(docenteIdParam) : undefined;

    syllabusService.assertCanAccessReviewModule(this.getUser(req));
    const result = await syllabusService.getAllCoursesInRevision(
      estado,
      docenteId,
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Sílabos en revisión obtenidos correctamente",
        data: result,
      },
    };
  }

  /**
   * GET /api/syllabus/revision/{silaboId}
   * Obtener detalles de revisión de un sílabo
   */
  @route("/revision/{silaboId}", "GET")
  async getSyllabusRevisionById(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const silaboId = Number(req.params.silaboId);
    await this.assertReview(req, silaboId);
    const result = await syllabusService.getSyllabusRevisionById(silaboId);
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: result,
      },
    };
  }

  /**
   * GET /api/syllabus/{id}/revision
   * Obtener datos de revisión por secciones
   */
  @route("/{id}/revision", "GET")
  async getRevisionData(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);

    if (Number.isNaN(id) || id <= 0) {
      return response.badRequest("ID de sílabo inválido");
    }

    await this.assertRead(req, id);

    const result = await syllabusService.getRevisionData(id);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: result,
      },
    };
  }

  /**
   * POST /api/syllabus/{id}/revision
   * Guardar datos de revisión
   */
  @route("/{id}/revision", "POST")
  async saveRevisionData(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const body = (await req.json()) as Record<string, unknown>;
    await this.assertReview(req, id);
    const result = await syllabusService.saveRevisionData(id, {
      ...body,
      docenteId: Number(this.getUser(req).id),
    });
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: result,
      },
    };
  }

  /**
   * POST /api/syllabus/{id}/aprobar
   * Aprobar sílabo
   */
  @route("/{id}/aprobar", "POST")
  async approveSyllabus(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const body = (await req.json()) as Record<string, unknown>;
    await syllabusService.assertCanChangeSyllabusState(
      this.getUser(req),
      id,
      "approve",
    );
    const result = await syllabusService.approveSyllabus(id, {
      ...body,
      docenteId: Number(this.getUser(req).id),
    });
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Sílabo aprobado correctamente",
        data: result,
      },
    };
  }

  /**
   * POST /api/syllabus/{id}/desaprobar
   * Desaprobar sílabo
   */
  @route("/{id}/desaprobar", "POST")
  async disapproveSyllabus(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);
    const body = (await req.json()) as Record<string, unknown>;
    await syllabusService.assertCanChangeSyllabusState(
      this.getUser(req),
      id,
      "disapprove",
    );
    const result = await syllabusService.disapproveSyllabus(id, {
      ...body,
      docenteId: Number(this.getUser(req).id),
    });
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Sílabo desaprobado correctamente",
        data: result,
      },
    };
  }
}

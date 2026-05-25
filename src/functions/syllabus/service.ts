import { syllabusRepository } from "./repository";
import { permissionsRepository } from "../permissions/repository";
import { getSectionLabel, SYLLABUS_SECTION } from "./section-permissions";
import {
  UpsertCompetenciesSchema,
  CreateComponentsSchema, //
  CreateAttitudesSchema, //
  FuenteCreate,
  FuenteUpdate,
  UnidadCreate,
  UnidadUpdate,
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
import type { UserSession } from "../auth/types";
import {
  canAuthUserCreateSyllabus,
  resolveAuthUserId,
  resolveAuthUserRole,
  type AuthUser,
} from "../../lib/auth-context";
import {
  CurriculumCourse,
  findCurriculumCourseByName,
  getCourseComparableNames,
  getCurriculumAnteriores,
  getCurriculumPosteriores,
  normalizeCourseName,
} from "./curriculum-courses";

const DOCENTE_ROLE_ID = 1;
const PRIVILEGED_ROLE_IDS = new Set([2, 3, 4]);
const BLOCKED_EDIT_STATES = new Set([
  "ANALIZANDO",
  "EN_REVISION",
  "REVISION",
  "APROBADO",
  "BLOQUEADO",
]);
const REQUIRED_REVISION_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const REVISION_SECTION_NAMES: Record<number, string> = {
  1: "Datos generales",
  2: "Sumilla",
  3: "Competencias y componentes",
  4: "Programación del contenido",
  5: "Estrategias metodológicas",
  6: "Recursos didácticos",
  7: "Evaluación del aprendizaje",
  8: "Fuentes de consulta",
  9: "Aporte de la asignatura",
};

export class SyllabusService {
  private normalizeEstadoRevision(value: string): string {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, "_");
  }

  private async assertSyllabusCanBeEdited(silaboId: number) {
    const current = await syllabusRepository.getStateById(silaboId);

    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const estadoRaw = String(current.estadoRevision ?? "").trim();
    const estadoKey = this.normalizeEstadoRevision(estadoRaw);

    const blockedKeys = new Set([
      "ANALIZANDO",
      "EN_REVISION",
      "REVISION",
      "APROBADO",
      "BLOQUEADO",
    ]);

    if (blockedKeys.has(estadoKey)) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `El sílabo no puede editarse porque está en estado ${estadoRaw}`,
      );
    }

    return current;
  }

  private isPrivilegedReviewer(user: UserSession | AuthUser) {
    const roleId = resolveAuthUserRole(user);
    if (roleId && PRIVILEGED_ROLE_IDS.has(roleId)) return true;
    return canAuthUserCreateSyllabus(user);
  }

  private async canPrivilegedEditUnassignedBorrador(
    user: UserSession,
    silaboId: number,
    estadoKey: string,
  ): Promise<boolean> {
    if (estadoKey !== "BORRADOR") return false;
    if (!this.isPrivilegedReviewer(user)) return false;
    return !(await syllabusRepository.hasDocenteAssigned(silaboId));
  }

  private isDocente(user: UserSession) {
    return Number(user.role) === DOCENTE_ROLE_ID;
  }

  private async resolveDocenteIdForUser(
    user: UserSession,
    silaboId?: number,
  ): Promise<number | null> {
    const candidates = new Set<number>();

    const directId = Number((user as any).docenteId);
    const userId = Number(user.id);

    if (Number.isFinite(directId) && directId > 0) {
      candidates.add(directId);
    }

    if (Number.isFinite(userId) && userId > 0) {
      candidates.add(userId);
    }

    if (silaboId) {
      for (const candidate of candidates) {
        const isAssigned = await syllabusRepository.isDocenteAssignedToSyllabus(
          candidate,
          silaboId,
        );

        if (isAssigned) {
          return candidate;
        }
      }
    }

    const email = String((user as any).email ?? "").trim();

    if (email) {
      const docenteIdByEmail =
        await permissionsRepository.findDocenteIdByCorreo(email);

      if (docenteIdByEmail) {
        if (!silaboId) return docenteIdByEmail;

        const isAssigned = await syllabusRepository.isDocenteAssignedToSyllabus(
          docenteIdByEmail,
          silaboId,
        );

        if (isAssigned) {
          return docenteIdByEmail;
        }
      }
    }

    return null;
  }

  private toUserSession(user?: UserSession | AuthUser): UserSession {
    const id = resolveAuthUserId(user ?? {});
    const role = resolveAuthUserRole(user ?? {});

    if (!id || !role) {
      throw new AppError(
        "Unauthorized",
        "UNAUTHORIZED",
        "Usuario autenticado requerido",
      );
    }

    return {
      ...(user as any),
      id,
      role,
      email: (user as any)?.email ?? (user as any)?.correo ?? "",
      name: (user as any)?.name ?? null,
    } as UserSession;
  }

  private assertAuthenticatedUser(user?: UserSession | AuthUser): UserSession {
    return this.toUserSession(user);
  }

  private extractDocenteIdFromPayload(payload: unknown): number | undefined {
    const record = payload as Record<string, unknown>;
    const docenteId = Number(
      record.asignadoADocenteId ??
        record.asignado_a_docente_id ??
        record.docenteId ??
        record.creadoPorDocenteId ??
        record.creado_por_docente_id,
    );

    if (!Number.isFinite(docenteId) || docenteId <= 0) {
      return undefined;
    }

    return docenteId;
  }

  private isDuplicateSyllabusError(error: unknown): boolean {
    const visited = new Set<unknown>();
    const queue: unknown[] = [error];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      const record = current as {
        message?: string;
        code?: string;
        cause?: unknown;
      };
      const message = String(record.message ?? "");
      const code = String(record.code ?? "");

      if (
        code === "23505" ||
        message.includes("uq_silabo_curso_sem_prog") ||
        message.includes("duplicate key") ||
        message.includes("llave duplicada")
      ) {
        return true;
      }

      if (record.cause) queue.push(record.cause);
    }

    return false;
  }

  private async isAssignedDocente(user: UserSession, silaboId: number) {
    const docenteId = await this.resolveDocenteIdForUser(user, silaboId);

    if (!docenteId) return false;

    return syllabusRepository.isDocenteAssignedToSyllabus(docenteId, silaboId);
  }

  async canReadSyllabus(user: UserSession, silaboId: number) {
    const current = await syllabusRepository.findById(silaboId);

    if (!current) return false;
    if (this.isPrivilegedReviewer(user)) return true;
    if (this.isDocente(user)) return this.isAssignedDocente(user, silaboId);
    return false;
  }

  async assertCanReadSyllabus(user: UserSession | undefined, silaboId: number) {
    const currentUser = this.assertAuthenticatedUser(user);

    if (!(await this.canReadSyllabus(currentUser, silaboId))) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos para acceder a este sílabo",
      );
    }
  }

  async assertCanEditSyllabus(
    user: UserSession | undefined,
    silaboId: number,
    sectionNumber: number,
  ) {
    const currentUser = this.assertAuthenticatedUser(user);
    const current = await this.assertSyllabusCanBeEdited(silaboId);
    const estadoKey = this.normalizeEstadoRevision(
      current.estadoRevision ?? "",
    );

    if (
      await this.canPrivilegedEditUnassignedBorrador(
        currentUser,
        silaboId,
        estadoKey,
      )
    ) {
      return;
    }

    if (!this.isDocente(currentUser)) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "Solo el docente asignado puede editar contenido del sílabo",
      );
    }

    if (!(await this.isAssignedDocente(currentUser, silaboId))) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos de edición sobre este sílabo",
      );
    }

    if (estadoKey === "DESAPROBADO") {
      const docenteId = await this.resolveDocenteIdForUser(
        currentUser,
        silaboId,
      );

      if (!docenteId) {
        throw new AppError(
          "Forbidden",
          "FORBIDDEN",
          "No tienes permisos de edición sobre este sílabo",
        );
      }

      await this.ensureDisapprovedSectionPermissions(silaboId, docenteId);

      const enabledSections =
        await permissionsRepository.findEnabledSectionNumbers(
          docenteId,
          silaboId,
        );

      if (!enabledSections.includes(sectionNumber)) {
        throw new AppError(
          "Forbidden",
          "FORBIDDEN",
          `No tienes permiso para editar la sección ${getSectionLabel(sectionNumber)}.`,
        );
      }

      return;
    }
  }

  private normalizeSectionNumbers(sectionNumbers: number[]): number[] {
    return Array.from(
      new Set(
        sectionNumbers.filter(
          (numeroSeccion) =>
            Number.isFinite(numeroSeccion) &&
            numeroSeccion >= SYLLABUS_SECTION.DATOS_GENERALES &&
            numeroSeccion <= SYLLABUS_SECTION.APORTES,
        ),
      ),
    ).sort((a, b) => a - b);
  }

  private async grantDisapprovedSectionPermissions(
    silaboId: number,
    sectionNumbers: number[],
    docenteId: number,
  ) {
    const permisos = this.normalizeSectionNumbers(sectionNumbers).map(
      (numeroSeccion) => ({
        numeroSeccion,
      }),
    );

    if (permisos.length === 0) {
      return;
    }

    await permissionsRepository.savePermissionsBySilaboIdAndDocenteId(
      silaboId,
      docenteId,
      permisos,
    );
  }

  async ensureDisapprovedSectionPermissions(
    silaboId: number,
    docenteId: number,
  ) {
    const current = await syllabusRepository.getStateById(silaboId);

    if (!current) {
      return;
    }

    const estadoKey = this.normalizeEstadoRevision(
      current.estadoRevision ?? "",
    );

    if (estadoKey !== "DESAPROBADO") {
      return;
    }

    const isAssigned = await syllabusRepository.isDocenteAssignedToSyllabus(
      docenteId,
      silaboId,
    );

    if (!isAssigned) {
      return;
    }

    const rejectedSections =
      await syllabusRepository.findRejectedRevisionSectionNumbers(silaboId);

    if (rejectedSections.length === 0) {
      return;
    }

    const enabledSections =
      await permissionsRepository.findEnabledSectionNumbers(
        docenteId,
        silaboId,
      );

    const rejectedSet = new Set(rejectedSections);
    const enabledSet = new Set(enabledSections);

    const needsSync =
      rejectedSections.length !== enabledSections.length ||
      rejectedSections.some((section) => !enabledSet.has(section)) ||
      enabledSections.some((section) => !rejectedSet.has(section));

    if (!needsSync) {
      return;
    }

    await this.grantDisapprovedSectionPermissions(
      silaboId,
      rejectedSections,
      docenteId,
    );
  }

  async assertCanCreateSyllabus(
    user: UserSession | AuthUser | undefined,
    payload: unknown,
  ) {
    const currentUser = this.assertAuthenticatedUser(user);

    if (
      this.isPrivilegedReviewer(currentUser) ||
      canAuthUserCreateSyllabus(user ?? currentUser)
    ) {
      return;
    }

    if (!this.isDocente(currentUser)) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos para crear sílabos",
      );
    }

    const docenteId = this.extractDocenteIdFromPayload(payload);
    const resolvedDocenteId = await this.resolveDocenteIdForUser(currentUser);

    if (!docenteId || !resolvedDocenteId || docenteId !== resolvedDocenteId) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "El docente solo puede crear sílabos asignados a su usuario",
      );
    }
  }

  async assertCanReviewSyllabus(
    user: UserSession | undefined,
    silaboId: number,
  ) {
    const currentUser = this.assertAuthenticatedUser(user);
    const current = await syllabusRepository.findById(silaboId);

    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    if (!this.isPrivilegedReviewer(currentUser)) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos para revisar este sílabo",
      );
    }
  }

  assertCanAccessReviewModule(user: UserSession | undefined) {
    const currentUser = this.assertAuthenticatedUser(user);

    if (!this.isPrivilegedReviewer(currentUser)) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos para revisar sílabos",
      );
    }
  }

  async getFormulaSyllabusId(formulaId: number) {
    const silaboId = await syllabusRepository.getFormulaSyllabusId(formulaId);

    if (!silaboId) {
      throw new AppError("NotFound", "NOT_FOUND", "Fórmula no encontrada");
    }

    return silaboId;
  }

  async assertCanChangeSyllabusState(
    user: UserSession | undefined,
    silaboId: number,
    action: "submit" | "approve" | "disapprove" | "state",
  ) {
    const currentUser = this.assertAuthenticatedUser(user);
    const current = await syllabusRepository.findById(silaboId);

    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const estadoKey = this.normalizeEstadoRevision(
      current.estadoRevision ?? "",
    );

    if (action === "submit") {
      if (!this.isDocente(currentUser)) {
        throw new AppError(
          "Forbidden",
          "FORBIDDEN",
          "Solo el docente asignado puede enviar el sílabo a revisión",
        );
      }

      if (!(await this.isAssignedDocente(currentUser, silaboId))) {
        throw new AppError(
          "Forbidden",
          "FORBIDDEN",
          "No tienes permisos sobre este sílabo",
        );
      }

      if (BLOCKED_EDIT_STATES.has(estadoKey)) {
        throw new AppError(
          "BadRequest",
          "BAD_REQUEST",
          `El sílabo no puede enviarse porque está en estado ${current.estadoRevision}`,
        );
      }

      return;
    }

    if (!this.isPrivilegedReviewer(currentUser)) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "No tienes permisos para cambiar el estado de este sílabo",
      );
    }

    if (action === "approve" || action === "disapprove") {
      if (estadoKey === "BLOQUEADO") {
        throw new AppError(
          "BadRequest",
          "BAD_REQUEST",
          `No se puede ${action === "approve" ? "aprobar" : "desaprobar"} un sílabo en estado BLOQUEADO.`,
        );
      }

      return;
    }
  }

  private getRevisionSectionStateKey(section: { estado?: string | null }) {
    return this.normalizeEstadoRevision(String(section.estado ?? ""));
  }

  private formatRevisionSectionNames(sectionNumbers: number[]) {
    return sectionNumbers
      .map(
        (sectionNumber) =>
          REVISION_SECTION_NAMES[sectionNumber] ?? `Sección ${sectionNumber}`,
      )
      .join(", ");
  }

  private validateAllRevisionSectionsMarked(
    revisionData: Array<{
      numeroSeccion: number | string;
      estado?: string | null;
    }>,
  ) {
    if (!revisionData.length) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "No se encontraron secciones revisadas para este sílabo.",
      );
    }

    const sectionsByNumber = new Map(
      revisionData.map((section) => [Number(section.numeroSeccion), section]),
    );

    const incompleteSections: number[] = [];

    for (const sectionNumber of REQUIRED_REVISION_SECTIONS) {
      const section = sectionsByNumber.get(sectionNumber);

      if (!section) {
        incompleteSections.push(sectionNumber);
        continue;
      }

      const estadoKey = this.getRevisionSectionStateKey(section);

      if (
        estadoKey === "PENDIENTE" ||
        !["REVISADO", "APROBADO", "RECHAZADO"].includes(estadoKey)
      ) {
        incompleteSections.push(sectionNumber);
      }
    }

    if (incompleteSections.length > 0) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `Faltan secciones por revisar: ${this.formatRevisionSectionNames(incompleteSections)}.`,
      );
    }
  }

  private validateRevisionSectionsForApproval(
    revisionData: Array<{
      numeroSeccion: number | string;
      estado?: string | null;
      comentario?: string;
    }>,
  ) {
    this.validateAllRevisionSectionsMarked(revisionData);

    const hasRejected = revisionData.some(
      (section) => this.getRevisionSectionStateKey(section) === "RECHAZADO",
    );

    if (hasRejected) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Para aprobar, todas las secciones deben estar aprobadas.",
      );
    }

    const allApproved = REQUIRED_REVISION_SECTIONS.every((sectionNumber) => {
      const section = revisionData.find(
        (item) => Number(item.numeroSeccion) === sectionNumber,
      );

      if (!section) return false;

      const estadoKey = this.getRevisionSectionStateKey(section);
      return estadoKey === "REVISADO" || estadoKey === "APROBADO";
    });

    if (!allApproved) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Para aprobar, todas las secciones deben estar aprobadas.",
      );
    }
  }

  private validateRevisionSectionsForDisapproval(
    revisionData: Array<{
      numeroSeccion: number | string;
      estado?: string | null;
      comentario?: string;
    }>,
  ) {
    this.validateAllRevisionSectionsMarked(revisionData);

    const rejectedSections = revisionData.filter(
      (section) => this.getRevisionSectionStateKey(section) === "RECHAZADO",
    );

    if (rejectedSections.length === 0) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Para desaprobar, debe existir al menos una sección rechazada con comentario.",
      );
    }

    const rejectedWithoutComment = rejectedSections.filter(
      (section) => !String(section.comentario ?? "").trim(),
    );

    if (rejectedWithoutComment.length > 0) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Para desaprobar, debe existir al menos una sección rechazada con comentario.",
      );
    }
  }

  private normalizeText(value: unknown): string {
    return String(value ?? "").trim();
  }

  private hasText(value: unknown): boolean {
    return this.normalizeText(value).length > 0;
  }

  private hasItems(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  private isEmptyObject(value: unknown): boolean {
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length === 0
    );
  }

  private hasObjectData(value: unknown): boolean {
    return !!value && typeof value === "object" && !this.isEmptyObject(value);
  }

  private async validateSyllabusBeforeSubmit(silaboId: number) {
    const missingSections: string[] = [];

    const syllabus = await syllabusRepository.findById(silaboId);

    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const datosGenerales =
      await syllabusRepository.findGeneralDataById(silaboId);

    if (!this.hasObjectData(datosGenerales)) {
      missingSections.push("Datos generales");
    }

    const sumilla = await syllabusRepository.findSumillaBySilaboId(silaboId);

    const sumillaText =
      (sumilla as any)?.sumilla ??
      (sumilla as any)?.contenido ??
      (sumilla as any)?.descripcion ??
      sumilla;

    if (!this.hasText(sumillaText)) {
      missingSections.push("Sumilla");
    }

    const competencias = await syllabusRepository.listCompetencies(
      String(silaboId),
    );

    if (!this.hasItems(competencias)) {
      missingSections.push("Competencias");
    }

    const componentes = await syllabusRepository.listComponents(silaboId);

    if (!this.hasItems(componentes)) {
      missingSections.push("Componentes");
    }

    const unidades = await syllabusRepository.findUnidadesBySilaboId(silaboId);

    if (!this.hasItems(unidades)) {
      missingSections.push("Programación del contenido");
    }

    const estrategias =
      await syllabusRepository.getEstrategiasMetodologicas(silaboId);

    const estrategiasText =
      (estrategias as any)?.estrategiasMetodologicas ??
      (estrategias as any)?.estrategias_metodologicas ??
      estrategias;

    if (!this.hasText(estrategiasText)) {
      missingSections.push("Estrategias metodológicas");
    }

    const recursos =
      await syllabusRepository.getRecursosDidacticosNotas(silaboId);

    const recursosText =
      (recursos as any)?.recursosDidacticosNotas ??
      (recursos as any)?.recursos_didacticos_notas ??
      recursos;

    if (!this.hasText(recursosText)) {
      missingSections.push("Recursos didácticos");
    }

    const fuentes = await syllabusRepository.findFuentesBySilaboId(silaboId);

    if (!this.hasItems(fuentes)) {
      missingSections.push("Fuentes de consulta");
    }

    const formulaEvaluacion =
      await syllabusRepository.getFormulaEvaluacionBySilaboId(silaboId);

    if (!formulaEvaluacion) {
      missingSections.push("Evaluación del aprendizaje");
    }

    const aportes =
      await syllabusRepository.findContributionsBySilaboId(silaboId);

    if (!this.hasItems(aportes)) {
      missingSections.push("Aporte al logro de resultados");
    }

    if (missingSections.length > 0) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `No se puede enviar el sílabo a revisión. Faltan completar: ${missingSections.join(", ")}`,
      );
    }
  }

  // ---------- COMPETENCIAS ----------
  async getCompetencies(syllabusId: string) {
    return syllabusRepository.listCompetencies(syllabusId);
  }

  async getSumillaBySilaboId(silaboId: number) {
    const result = await syllabusRepository.findSumillaBySilaboId(silaboId);

    return result;
  }

  async removeCompetency(syllabusId: string, id: string) {
    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }
    await this.assertSyllabusCanBeEdited(sId);

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

    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }
    await this.assertSyllabusCanBeEdited(sId);

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

    await this.assertSyllabusCanBeEdited(sId);

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
  private mapComponentRow(r: {
    id: number;
    silaboId: number;
    grupo: string | null;
    codigo: string | null;
    descripcion: string | null;
    competenciaCodigoRelacionada: string | null;
    orden: number | null;
  }) {
    const isAttitudinal = r.grupo === "ACT";

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
  }

  async getComponents(syllabusId: string, grupo?: string) {
    const sId = Number(syllabusId);
    if (Number.isNaN(sId)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "syllabusId inválido");
    }

    const mapRows = (
      rows: Awaited<
        ReturnType<typeof syllabusRepository.listAllComponentsByGrupo>
      >,
    ) => rows.map((r) => this.mapComponentRow(r));

    if (grupo === "ACT") {
      const actRows = await syllabusRepository.listAttitudes(sId);
      const actitudinales = mapRows(actRows);

      return {
        items: actitudinales,
        competencias: [],
        actitudinales,
        total: actitudinales.length,
        totalCompetencias: 0,
        totalActitudinales: actitudinales.length,
      };
    }

    if (grupo === "COMP") {
      const compRows = await syllabusRepository.listComponents(sId);
      const competencias = mapRows(compRows);

      return {
        items: competencias,
        competencias,
        actitudinales: [],
        total: competencias.length,
        totalCompetencias: competencias.length,
        totalActitudinales: 0,
      };
    }

    const compRows = await syllabusRepository.listComponents(sId);
    const actRows = await syllabusRepository.listAttitudes(sId);
    const competencias = mapRows(compRows);
    const actitudinales = mapRows(actRows);
    const items = [...competencias, ...actitudinales];

    return {
      items,
      competencias,
      actitudinales,
      total: items.length,
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

    await this.assertSyllabusCanBeEdited(sId);

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

    await this.assertSyllabusCanBeEdited(sId);

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
    await this.assertSyllabusCanBeEdited(sId);

    const { deleted } = await syllabusRepository.deleteComponent(sId, cId);
    if (!deleted) {
      throw new AppError("NotFound", "NOT_FOUND", "Component not found");
    }
    return { ok: true, deleted, message: "🗑️ El item fue eliminado con éxito" };
  }

  async findSyllabusAndUpdate(id: number) {
    void id;
  }

  async getGeneralDataSyllabusById(id: number) {
    const data = await syllabusRepository.findGeneralDataById(id);
    if (!data) throw new AppError("Sílabo no encontrado", "NOT_FOUND");
    return data;
  }

  async createSyllabus(payload: unknown, _authUser?: UserSession | AuthUser) {
    let data;
    try {
      data = SyllabusCreateSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          "ValidationError",
          "BAD_REQUEST",
          "Datos inválidos: " +
            error.issues.map((issue) => issue.message).join(", "),
        );
      }
      throw error;
    }

    try {
      return await syllabusRepository.create(data);
    } catch (error) {
      if (this.isDuplicateSyllabusError(error)) {
        throw new AppError(
          "Conflict",
          "CONFLICT",
          "Ya existe un sílabo para este código de asignatura, semestre académico y programa académico.",
        );
      }

      throw error;
    }
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

    await this.assertSyllabusCanBeEdited(sId);

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

    await this.assertSyllabusCanBeEdited(sId);

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
    await this.assertSyllabusCanBeEdited(sId);

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
    await this.assertSyllabusCanBeEdited(idSyllabus);

    const parsed = SumillaSchema.parse(payload);
    const sumilla = parsed.sumilla;

    if (!sumilla) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "Datos inválidos: Error en la sumilla",
      );
    }

    await syllabusRepository.updateSumilla(idSyllabus, sumilla);

    return { message: "Sumilla actualizada correctamente" };
  }
  async registerSumilla(idSyllabus: number, payload: unknown) {
    await this.assertSyllabusCanBeEdited(idSyllabus);

    const parsed = SumillaSchema.parse(payload);
    const sumilla = parsed.sumilla;

    if (!sumilla) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "Datos inválidos: Error en la sumilla",
      );
    }

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

  private assertLongTextLimit(value: string, label: string) {
    if (value.length > 6000) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `${label} no debe superar 6000 caracteres`,
      );
    }
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
      return null;
    }

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
      await this.assertSyllabusCanBeEdited(validatedData.silaboId);

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
    const silaboId = await this.getFormulaSyllabusId(id);
    await this.assertSyllabusCanBeEdited(silaboId);

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
    await this.assertSyllabusCanBeEdited(id);

    const estrategias =
      typeof data === "string" ? data : this.itemsToText(data);
    this.assertLongTextLimit(estrategias, "Estrategias metodológicas");

    return await syllabusRepository.putEstrategiasMetodologicas(
      id,
      estrategias,
    );
  }

  async putRecursosDidacticosNotas(
    id: number,
    data: string | Array<{ titulo: string; descripcion: string }>,
  ) {
    await this.assertSyllabusCanBeEdited(id);

    const recursos = typeof data === "string" ? data : this.itemsToText(data);
    this.assertLongTextLimit(recursos, "Recursos didácticos");

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
      estadoRevision: z.enum(["REVISION"]),
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

    const currentState = this.normalizeEstadoRevision(current.estadoRevision);
    const allowedFrom = new Set(["ASIGNADO", "PENDIENTE", "DESAPROBADO"]);

    if (current.estadoRevision === estadoRevision) {
      return {
        ok: false,
        message: `El estado ya está asignado como ${estadoRevision}`,
      };
    }

    if (!allowedFrom.has(currentState)) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `Transición de estado no permitida desde ${current.estadoRevision}`,
      );
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
    if (!id || Number.isNaN(id) || !Number.isFinite(id)) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de sílabo inválido");
    }

    const current = await syllabusRepository.getStateById(id);

    if (!current) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    const estadoRaw = String(current.estadoRevision ?? "").trim();
    const estadoKey = this.normalizeEstadoRevision(estadoRaw);

    const alreadySubmittedStates = new Set([
      "ANALIZANDO",
      "EN_REVISION",
      "REVISION",
      "APROBADO",
      "BLOQUEADO",
    ]);

    if (alreadySubmittedStates.has(estadoKey)) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        `El sílabo no puede enviarse porque ya está en estado ${estadoRaw}`,
      );
    }

    // Reenvío tras corrección: el docente solo ajusta secciones observadas.
    if (estadoKey === "DESAPROBADO") {
      await syllabusRepository.updateReviewStatus(id, "ANALIZANDO");

      return {
        ok: true,
        message: "Sílabo reenviado a revisión correctamente",
        estadoAnterior: current.estadoRevision,
        estadoNuevo: "ANALIZANDO",
      };
    }

    await this.validateSyllabusBeforeSubmit(id);

    await syllabusRepository.updateReviewStatus(id, "ANALIZANDO");

    return {
      ok: true,
      message: "Sílabo enviado a revisión correctamente",
      estadoAnterior: current.estadoRevision,
      estadoNuevo: "ANALIZANDO",
    };
  }

  // ---------- APORTE ----------
  async createAporte(data: ContributionCreateType) {
    const rawData = data as any;

    const silaboId = Number(
      rawData.silaboId ?? rawData.syllabusId ?? rawData.silabo_id,
    );

    if (!silaboId || Number.isNaN(silaboId)) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "ID de sílabo inválido",
      );
    }

    await this.assertSyllabusCanBeEdited(silaboId);

    const resultadoProgramaCodigo = String(
      rawData.resultadoProgramaCodigo ??
        rawData.resultado_programa_codigo ??
        rawData.codigo ??
        "",
    ).trim();

    const resultadoProgramaDescripcion = String(
      rawData.resultadoProgramaDescripcion ??
        rawData.resultado_programa_descripcion ??
        rawData.descripcion ??
        "",
    ).trim();

    const aporteValor = String(
      rawData.aporteValor ?? rawData.aporte_valor ?? "",
    ).trim();

    if (!resultadoProgramaCodigo) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "El código del resultado del programa es obligatorio",
      );
    }

    if (!resultadoProgramaDescripcion) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "La descripción del resultado del programa es obligatoria",
      );
    }

    if (aporteValor !== "K" && aporteValor !== "R") {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "El aporte debe ser K o R",
      );
    }

    const payload: any = {
      silaboId,
      resultadoProgramaCodigo,
      resultadoProgramaDescripcion,
      aporteValor,
    };

    const existingContributions =
      await syllabusRepository.findContributionsBySilaboId(silaboId);

    const existing = existingContributions.find((item: any) => {
      const currentCode = String(
        item.resultadoProgramaCodigo ??
          item.resultado_programa_codigo ??
          item.codigo ??
          "",
      ).trim();

      return currentCode === resultadoProgramaCodigo;
    }) as any;

    if (existing) {
      const updated = await syllabusRepository.updateContribution(silaboId, 0, {
        resultadoProgramaCodigo,
        resultadoProgramaDescripcion,
        aporteValor,
      } as any);

      return {
        ok: true,
        message: "Aporte actualizado correctamente",
        data: updated ?? existing,
      };
    }

    try {
      const result = await syllabusRepository.createContribution(payload);

      return {
        ok: true,
        message: "Aporte registrado correctamente",
        data: result,
      };
    } catch (error: any) {
      const message = String(error?.message ?? error ?? "");

      if (
        message.includes("duplicate") ||
        message.includes("duplicado") ||
        message.includes("unique") ||
        message.includes("silabo_aporte_resultado_programa")
      ) {
        return {
          ok: true,
          message:
            "El aporte ya estaba registrado. No se volvió a insertar para evitar duplicados.",
          data: payload,
        };
      }

      throw error;
    }
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

    const revisionData = await syllabusRepository.findRevisionSections(id);
    this.validateRevisionSectionsForApproval(revisionData);

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

    const revisionData = await syllabusRepository.findRevisionSections(id);
    this.validateRevisionSectionsForDisapproval(revisionData);

    // Validar con el esquema DesaprobarSilabo
    const parsed = DesaprobarSilabo.safeParse(data);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError("BadRequest", "BAD_REQUEST", details);
    }

    const missingComments = parsed.data.observaciones.some(
      (item) => !String(item.comentario ?? "").trim(),
    );

    if (missingComments) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Toda sección desaprobada debe incluir comentario",
      );
    }

    await syllabusRepository.disapproveSyllabus(id, parsed.data);

    const rejectedFromRevision =
      await syllabusRepository.findRejectedRevisionSectionNumbers(id);

    const rejectedFromPayload = parsed.data.observaciones.map((item) =>
      Number(item.numeroSeccion),
    );

    const rejectedSectionNumbers = this.normalizeSectionNumbers(
      rejectedFromRevision.length > 0
        ? rejectedFromRevision
        : rejectedFromPayload,
    );

    const assignedDocenteIds =
      await syllabusRepository.getAssignedDocenteIds(id);

    for (const docenteId of assignedDocenteIds) {
      await this.grantDisapprovedSectionPermissions(
        id,
        rejectedSectionNumbers,
        docenteId,
      );
    }
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

    const revisionSchema = z.object({
      docenteId: z.number().int().positive().optional(),
      secciones: z
        .array(
          z.object({
            numeroSeccion: z.number().int().min(1).max(9),
            nombreSeccion: z.string().trim().min(1).max(255),
            estado: z
              .enum(["PENDIENTE", "REVISADO", "RECHAZADO", "APROBADO"])
              .optional(),
            comentario: z.string().trim().max(2000).optional(),
          }),
        )
        .min(1)
        .max(9),
    });
    const parsed = revisionSchema.safeParse(data);

    // Validar que se proporcionen secciones
    if (!parsed.success) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "Datos de revisión inválidos",
      );
    }

    // Guardar o actualizar cada sección
    const results = await syllabusRepository.upsertRevisionSections(
      id,
      parsed.data.secciones,
      parsed.data.docenteId,
    );

    return {
      silaboId: id,
      seccionesGuardadas: results.length,
      secciones: results,
    };
  }

  async getSyllabusCatalog() {
    return await syllabusRepository.getSyllabusCatalog();
  }

  // ---------- SECCIÓN I: DATOS GENERALES ----------
  async updateDatosGenerales(id: number, data: DatosGeneralesUpdate) {
    await this.assertSyllabusCanBeEdited(id);

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

  private async assertSemanasValidForSilabo(
    silaboId: number,
    semanas: Array<{ semana: number }> | undefined,
    excludeUnidadId?: number,
  ) {
    if (!semanas?.length) return;

    const incoming = new Set<number>();

    for (const item of semanas) {
      const semana = Number(item.semana);

      if (!Number.isInteger(semana) || semana < 1 || semana > 16) {
        throw new AppError(
          "BadRequest",
          "BAD_REQUEST",
          "Cada semana debe estar entre 1 y 16.",
        );
      }

      if (incoming.has(semana)) {
        throw new AppError(
          "BadRequest",
          "BAD_REQUEST",
          `La semana ${semana} está duplicada.`,
        );
      }

      incoming.add(semana);
    }

    const unidades = await syllabusRepository.findUnidadesBySilaboId(silaboId);

    for (const unidad of unidades) {
      if (excludeUnidadId && unidad.id === excludeUnidadId) {
        continue;
      }

      const existing = await syllabusRepository.findSemanasByUnidadId(
        unidad.id,
      );

      for (const row of existing) {
        const semana = Number(row.semana);

        if (incoming.has(semana)) {
          throw new AppError(
            "BadRequest",
            "BAD_REQUEST",
            `La semana ${semana} ya está registrada en otra unidad.`,
          );
        }
      }
    }
  }

  async createUnidad(silaboId: number, data: UnidadCreate) {
    const syllabus = await syllabusRepository.findById(silaboId);
    if (!syllabus) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    await this.assertSyllabusCanBeEdited(silaboId);

    const { semanas, ...unidadData } = data;

    await this.assertSemanasValidForSilabo(silaboId, semanas);

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
    await this.assertSyllabusCanBeEdited(silaboId);

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

    if (semanas !== undefined) {
      await this.assertSemanasValidForSilabo(silaboId, semanas, unidadId);

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
    await this.assertSyllabusCanBeEdited(silaboId);

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

    await this.assertSyllabusCanBeEdited(silaboId);

    return syllabusRepository.insertFuente(silaboId, data);
  }

  async updateFuente(silaboId: number, fuenteId: number, data: FuenteUpdate) {
    await this.assertSyllabusCanBeEdited(silaboId);

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
    await this.assertSyllabusCanBeEdited(silaboId);

    const deleted = await syllabusRepository.deleteFuente(silaboId, fuenteId);
    if (!deleted) {
      throw new AppError("NotFound", "NOT_FOUND", "Fuente no encontrada");
    }
    return { ok: true, message: "Fuente eliminada correctamente" };
  }

  // ---------- SECCIÓN IX: APORTES (GET y PUT) ----------
  async getContributions(silaboId: number) {
    const rows = await syllabusRepository.findContributionsBySilaboId(silaboId);

    return rows
      .map((row: any, index: number) => {
        const codigo = String(
          row.resultadoProgramaCodigo ?? row.resultado_programa_codigo ?? "",
        ).trim();

        if (!/^RP\d+$/i.test(codigo)) {
          return null;
        }

        const rpMatch = codigo.match(/^RP(\d+)$/i);
        const stableId = rpMatch ? Number(rpMatch[1]) : index + 1;

        const descripcion =
          row.resultadoProgramaDescripcion ??
          row.resultado_programa_descripcion ??
          "";

        const aporteValor = row.aporteValor ?? row.aporte_valor ?? "";

        return {
          id: stableId,
          silaboId: row.silaboId ?? silaboId,
          resultadoProgramaCodigo: codigo,
          resultadoProgramaDescripcion: descripcion,
          aporteValor,
          codigo,
          descripcion,
          nivel: aporteValor,
          level: aporteValor,
          code: codigo,
          description: descripcion,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async deleteContribution(silaboId: number, resultadoProgramaCodigo: string) {
    await this.assertSyllabusCanBeEdited(silaboId);

    const codigo = String(resultadoProgramaCodigo).trim();
    if (!codigo) {
      throw new AppError(
        "ValidationError",
        "BAD_REQUEST",
        "El código del resultado del programa es obligatorio",
      );
    }

    const result = await syllabusRepository.deleteContribution(
      silaboId,
      codigo,
    );
    if (!result) {
      throw new AppError("NotFound", "NOT_FOUND", "Aporte no encontrado");
    }

    return result;
  }

  async updateContribution(
    silaboId: number,
    contributionId: number,
    data: any,
  ) {
    await this.assertSyllabusCanBeEdited(silaboId);

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

  private buildSilaboCourseIndex(
    rows: Awaited<ReturnType<typeof syllabusRepository.listSilaboCourseRefs>>,
  ) {
    const index = new Map<
      string,
      { id: number; cursoNombre: string; cursoCodigo: string | null }
    >();

    for (const row of rows) {
      const nombre = this.normalizeText(row.cursoNombre);
      if (!nombre) continue;

      const key = normalizeCourseName(nombre);
      if (!key || index.has(key)) continue;

      index.set(key, {
        id: row.id,
        cursoNombre: nombre,
        cursoCodigo: row.cursoCodigo ?? null,
      });
    }

    return index;
  }

  private findSilaboByCurriculumCourse(
    course: CurriculumCourse,
    silaboRefs: Awaited<
      ReturnType<typeof syllabusRepository.listSilaboCourseRefs>
    >,
  ) {
    const comparableNames = getCourseComparableNames(course);
    const found = silaboRefs.find((ref) => {
      const refName = normalizeCourseName(String(ref.cursoNombre ?? ""));
      return comparableNames.includes(refName);
    });

    return found ?? null;
  }

  private async mapRelatedCurriculumCourse(
    nombreMalla: string,
    index: Map<
      string,
      { id: number; cursoNombre: string; cursoCodigo: string | null }
    >,
    silaboRows: Awaited<
      ReturnType<typeof syllabusRepository.listSilaboCourseRefs>
    >,
    user?: UserSession,
  ) {
    const curriculumCourse = findCurriculumCourseByName(nombreMalla);
    const match = curriculumCourse
      ? this.findSilaboByCurriculumCourse(curriculumCourse, silaboRows)
      : index.get(normalizeCourseName(nombreMalla));

    if (match && user && (await this.canReadSyllabus(user, match.id))) {
      return {
        nombreMalla: curriculumCourse?.nombre ?? nombreMalla,
        cursoNombre: match.cursoNombre,
        cursoCodigo: match.cursoCodigo ?? curriculumCourse?.codigo ?? null,
        silaboId: match.id,
        disponible: true,
      };
    }

    return {
      nombreMalla: curriculumCourse?.nombre ?? nombreMalla,
      cursoNombre: curriculumCourse?.nombre ?? nombreMalla,
      cursoCodigo: curriculumCourse?.codigo ?? null,
      silaboId: null,
      disponible: false,
    };
  }

  private async buildCurriculumContextPayload(options: {
    silaboId: number | null;
    courseName: string;
    cursoCodigo?: string | null;
    cicloFromSilabo?: string | null;
    user?: UserSession;
  }) {
    const courseName = this.normalizeText(options.courseName);
    const silaboRows = await syllabusRepository.listSilaboCourseRefs();
    const index = this.buildSilaboCourseIndex(silaboRows);
    const curriculum = findCurriculumCourseByName(courseName);

    const indexMatch = curriculum
      ? this.findSilaboByCurriculumCourse(curriculum, silaboRows)
      : index.get(normalizeCourseName(courseName));
    const resolvedSilaboId = options.silaboId ?? indexMatch?.id ?? null;
    const canReadResolvedSilabo =
      resolvedSilaboId && options.user
        ? await this.canReadSyllabus(options.user, resolvedSilaboId)
        : Boolean(options.silaboId);
    const visibleSilaboId = canReadResolvedSilabo ? resolvedSilaboId : null;
    const resolvedCodigo =
      options.cursoCodigo ?? indexMatch?.cursoCodigo ?? null;

    if (!curriculum) {
      return {
        hasCurriculumContext: false,
        actual: {
          silaboId: visibleSilaboId,
          cursoNombre: courseName,
          cursoCodigo: resolvedCodigo,
          ciclo: options.cicloFromSilabo ?? null,
          linea: null,
          disponible: Boolean(visibleSilaboId),
        },
        anteriores: [],
        posteriores: [],
        message: "No hay contexto curricular registrado para este curso.",
      };
    }

    const anteriores = await Promise.all(
      getCurriculumAnteriores(curriculum).map((nombre) =>
        this.mapRelatedCurriculumCourse(
          nombre,
          index,
          silaboRows,
          options.user,
        ),
      ),
    );

    const posteriores = await Promise.all(
      getCurriculumPosteriores(curriculum).map((nombre) =>
        this.mapRelatedCurriculumCourse(
          nombre,
          index,
          silaboRows,
          options.user,
        ),
      ),
    );

    return {
      hasCurriculumContext: true,
      actual: {
        silaboId: visibleSilaboId,
        cursoNombre: curriculum.nombre,
        cursoCodigo: resolvedCodigo ?? curriculum.codigo ?? null,
        ciclo: curriculum.ciclo ?? options.cicloFromSilabo ?? null,
        linea: curriculum.modalidad ?? null,
        disponible: Boolean(visibleSilaboId),
      },
      anteriores,
      posteriores,
      message: null,
    };
  }

  async getCurriculumContext(syllabusId: number, user?: UserSession) {
    const silabo = await syllabusRepository.findById(syllabusId);

    if (!silabo) {
      throw new AppError("NotFound", "NOT_FOUND", "Sílabo no encontrado");
    }

    return this.buildCurriculumContextPayload({
      silaboId: syllabusId,
      courseName: String(silabo.cursoNombre ?? ""),
      cursoCodigo: silabo.cursoCodigo ?? null,
      cicloFromSilabo: silabo.ciclo ?? null,
      user,
    });
  }

  async getCurriculumContextPreview(courseName: string, user?: UserSession) {
    const normalizedName = this.normalizeText(courseName);

    if (!normalizedName) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "El nombre del curso es obligatorio",
      );
    }

    return this.buildCurriculumContextPayload({
      silaboId: null,
      courseName: normalizedName,
      user,
    });
  }
}

export const syllabusService = new SyllabusService();

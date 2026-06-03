import { AppError } from "../../error";
import type { UserSession } from "../auth/types";
import {
  canAuthUserCreateSyllabus,
  resolveAuthUserId,
  resolveAuthUserRole,
  type AuthUser,
} from "../../lib/auth-context";
import {
  curriculumCourses,
  type CurriculumCourse,
} from "../syllabus/curriculum-courses";
import { curriculumRepository } from "./repository";
import {
  CurriculumCourseCreateSchema,
  CurriculumCourseUpdateSchema,
  CurriculumPeriodSchema,
  DEFAULT_CURRICULUM_PERIOD,
  type CurriculumCourseItem,
  type CurriculumMeshResponse,
} from "./types";

const PRIVILEGED_ROLE_IDS = new Set([2, 3, 4]);

const CYCLE_NAMES: Record<number, string> = {
  1: "Ciclo I",
  2: "Ciclo II",
  3: "Ciclo III",
  4: "Ciclo IV",
  5: "Ciclo V",
  6: "Ciclo VI",
  7: "Ciclo VII",
  8: "Ciclo VIII",
  9: "Ciclo IX",
  10: "Ciclo X",
};

export class CurriculumService {
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
      ...(user as Record<string, unknown>),
      id,
      role,
      email: (user as Record<string, unknown>)?.email as string,
      name: ((user as Record<string, unknown>)?.name as string) ?? null,
    } as UserSession;
  }

  private assertCanManageCurriculum(user?: UserSession | AuthUser) {
    const currentUser = this.toUserSession(user);
    const roleId = resolveAuthUserRole(currentUser);

    if (
      (roleId && PRIVILEGED_ROLE_IDS.has(roleId)) ||
      canAuthUserCreateSyllabus(currentUser)
    ) {
      return currentUser;
    }

    throw new AppError(
      "Forbidden",
      "FORBIDDEN",
      "No tienes permisos para gestionar la malla curricular",
    );
  }

  private normalizePeriod(periodo?: string | null) {
    const value = String(periodo ?? DEFAULT_CURRICULUM_PERIOD).trim();
    return CurriculumPeriodSchema.parse(value || DEFAULT_CURRICULUM_PERIOD);
  }

  private mapSeedCourse(course: CurriculumCourse) {
    return {
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
    };
  }

  private normalizePrerrequisitos(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  private mapCourse(row: {
    id: number;
    periodo: string;
    codigo: string;
    nombre: string;
    ciclo: number | null;
    creditos: number;
    horasTeoria: number;
    horasPractica: number;
    modalidad: string;
    tipoCurso: string | null;
    areaCurricular: string | null;
    prerrequisitos: unknown;
    activo: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  }): CurriculumCourseItem {
    return {
      id: row.id,
      periodo: row.periodo,
      codigo: row.codigo,
      nombre: row.nombre,
      ciclo: row.ciclo,
      creditos: row.creditos,
      horasTeoria: row.horasTeoria,
      horasPractica: row.horasPractica,
      modalidad: row.modalidad,
      tipoCurso: row.tipoCurso,
      areaCurricular: row.areaCurricular,
      prerrequisitos: this.normalizePrerrequisitos(row.prerrequisitos),
      activo: row.activo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async ensurePeriodSeeded(periodo: string) {
    await curriculumRepository.seedCourses(
      periodo,
      curriculumCourses.map((course) => this.mapSeedCourse(course)),
    );
  }

  async listPeriods(user?: UserSession | AuthUser) {
    this.assertCanManageCurriculum(user);

    await this.ensurePeriodSeeded(DEFAULT_CURRICULUM_PERIOD);

    const periods = await curriculumRepository.listPeriods();

    if (periods.length === 0) {
      return [DEFAULT_CURRICULUM_PERIOD];
    }

    return periods;
  }

  async getMesh(
    periodoParam?: string | null,
    user?: UserSession | AuthUser,
  ): Promise<CurriculumMeshResponse> {
    this.assertCanManageCurriculum(user);

    const periodo = this.normalizePeriod(periodoParam);

    await this.ensurePeriodSeeded(periodo);

    const rows = await curriculumRepository.listCoursesByPeriod(periodo);
    const courses = rows.map((row) => this.mapCourse(row));

    const ciclos = Array.from({ length: 10 }, (_, index) => {
      const ciclo = index + 1;

      return {
        ciclo,
        nombre: CYCLE_NAMES[ciclo] ?? `Ciclo ${ciclo}`,
        cursos: courses.filter((course) => course.ciclo === ciclo),
      };
    });

    const electivos = courses.filter(
      (course) => course.ciclo === null || course.ciclo <= 0,
    );

    return {
      periodo,
      ciclos,
      electivos,
    };
  }

  async updateCourse(
    id: number,
    payload: unknown,
    user?: UserSession | AuthUser,
  ) {
    this.assertCanManageCurriculum(user);

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de curso inválido");
    }

    const parsed = CurriculumCourseUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        parsed.error.issues.map((issue) => issue.message).join(", "),
      );
    }

    const existing = await curriculumRepository.findCourseById(id);

    if (!existing) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Curso de malla no encontrado",
      );
    }

    const result = await curriculumRepository.updateCourse(id, parsed.data);

    if (!result) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Curso de malla no encontrado",
      );
    }

    return this.mapCourse(result);
  }

  async createCourse(payload: unknown, user?: UserSession | AuthUser) {
    this.assertCanManageCurriculum(user);

    const parsed = CurriculumCourseCreateSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        parsed.error.issues.map((issue) => issue.message).join(", "),
      );
    }

    const periodo = this.normalizePeriod(
      parsed.data.periodo ?? DEFAULT_CURRICULUM_PERIOD,
    );

    const result = await curriculumRepository.createCourse(
      periodo,
      parsed.data,
    );

    if (!result) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "No se pudo crear el curso",
      );
    }

    return this.mapCourse(result);
  }

  async deactivateCourse(id: number, user?: UserSession | AuthUser) {
    this.assertCanManageCurriculum(user);

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de curso inválido");
    }

    const existing = await curriculumRepository.findCourseById(id);

    if (!existing) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Curso de malla no encontrado",
      );
    }

    const result = await curriculumRepository.deactivateCourse(id);

    if (!result) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "Curso de malla no encontrado",
      );
    }

    return this.mapCourse(result);
  }
}

export const curriculumService = new CurriculumService();

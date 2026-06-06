import { AppError } from "../../error";
import type { UserSession } from "../auth/types";
import { syllabusRepository } from "../syllabus/repository";
import { teacherRepository } from "../teacher/repository";
import { assignmentsRepository } from "./repository";
import {
  SYLLABUS_ALREADY_ASSIGNED_MESSAGE,
  type CreateAssignmentRequest,
  type SilaboFilters,
  type SilaboListItem,
  type CourseSimple,
} from "./types";

const COMITE_CURRICULAR_OPERATIVO_ROLE_ID = 5;

class AssignmentsService {
  assertCanManageAssignments(user?: UserSession) {
    if (!user || Number(user.role) !== COMITE_CURRICULAR_OPERATIVO_ROLE_ID) {
      throw new AppError(
        "Forbidden",
        "FORBIDDEN",
        "Solo el Comité Curricular Operativo puede gestionar asignaciones docentes.",
      );
    }
  }

  async list(filters: SilaboFilters): Promise<SilaboListItem[]> {
    return await assignmentsRepository.getAll(filters);
  }

  async getAllCourses(options?: {
    sinAsignar?: boolean;
  }): Promise<CourseSimple[]> {
    return await assignmentsRepository.getAllCourses(options);
  }

  async create(assignmentPayload: CreateAssignmentRequest, user?: UserSession) {
    this.assertCanManageAssignments(user);

    const teacher = await teacherRepository.findById(
      assignmentPayload.teacherId,
    );

    if (!teacher) {
      throw new AppError(
        "Docente no encontrado",
        "BAD_REQUEST",
        "El docente no existe.",
      );
    }

    const syllabus = await syllabusRepository.findById(
      assignmentPayload.syllabusId,
    );

    if (!syllabus) {
      throw new AppError(
        "Sílabo no encontrado",
        "BAD_REQUEST",
        "El sílabo no existe.",
      );
    }

    const alreadyAssigned = await assignmentsRepository.hasDocenteForSilabo(
      syllabus.id,
    );

    if (alreadyAssigned) {
      throw new AppError(
        "Conflicto de asignación",
        "CONFLICT",
        SYLLABUS_ALREADY_ASSIGNED_MESSAGE,
      );
    }

    const createAssigment = {
      syllabus: {
        id: syllabus.id,
        name: syllabus.cursoNombre,
        code: syllabus.cursoCodigo,
        department: syllabus.departamentoAcademico,
      },
      teacher: {
        id: teacher.id,
        email: teacher.correo,
        name: teacher.nombre,
      },
      message: assignmentPayload.message,
      academyPeriod: assignmentPayload.academicPeriod,
    };

    return await assignmentsRepository.create(createAssigment);
  }

  async unassign(syllabusId: number, user?: UserSession) {
    this.assertCanManageAssignments(user);

    if (!Number.isFinite(syllabusId) || syllabusId <= 0) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de sílabo inválido.");
    }

    const assignmentState =
      await assignmentsRepository.getAssignmentState(syllabusId);

    if (!assignmentState) {
      throw new AppError(
        "Sílabo no encontrado",
        "NOT_FOUND",
        "El sílabo no existe.",
      );
    }

    if (!assignmentState.docenteId && !assignmentState.asignadoADocenteId) {
      return {
        ok: true,
        message: "El sílabo ya se encuentra sin docente asignado.",
        data: assignmentState,
      };
    }

    const result = await assignmentsRepository.unassign(syllabusId, user?.id);

    return {
      ok: true,
      message:
        "Docente desasignado correctamente. El sílabo volvió a estar disponible para asignación.",
      data: result,
    };
  }
}

export const assignmentsService = new AssignmentsService();

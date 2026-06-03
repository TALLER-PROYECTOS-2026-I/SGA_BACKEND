import { AppError } from "../../error";
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

class AssignmentsService {
  async list(filters: SilaboFilters): Promise<SilaboListItem[]> {
    return await assignmentsRepository.getAll(filters);
  }

  async getAllCourses(options?: { sinAsignar?: boolean }): Promise<CourseSimple[]> {
    return await assignmentsRepository.getAllCourses(options);
  }

  async create(assignmentPayload: CreateAssignmentRequest) {
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
}

export const assignmentsService = new AssignmentsService();

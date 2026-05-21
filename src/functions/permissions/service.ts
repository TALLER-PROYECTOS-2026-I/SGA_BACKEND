import { AppError } from "../../error";
import { permissionsRepository } from "./repository";
import { PermissionsSchema } from "./types";
import { syllabusService } from "../syllabus/service";

export class PermissionsService {
  async getPermissionsByDocenteId(docenteId: number, silaboId?: number | null) {
    if (!docenteId || Number.isNaN(docenteId)) {
      throw new AppError(
        "PermissionsServiceError",
        "BAD_REQUEST",
        "docenteId inválido",
      );
    }

    if (silaboId) {
      await syllabusService.ensureDisapprovedSectionPermissions(
        silaboId,
        docenteId,
      );

      return await permissionsRepository.findPermissionsByDocenteIdAndSilaboId(
        docenteId,
        silaboId,
      );
    }

    return await permissionsRepository.findPermissionsByDocenteId(docenteId);
  }

  async assignPermissions(body: unknown) {
    const parsed = PermissionsSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        "PermissionsServiceError",
        "BAD_REQUEST",
        "Error de validación",
        parsed.error.flatten().fieldErrors,
      );
    }

    return await permissionsRepository.savePermissionsBySilaboIdAndDocenteId(
      parsed.data.silaboId,
      parsed.data.docenteId,
      parsed.data.permisos,
    );
  }
}

export const permissionsService = new PermissionsService();

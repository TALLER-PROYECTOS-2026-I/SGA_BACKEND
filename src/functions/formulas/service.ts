import { AppError } from "../../error";
import { formulasRepository } from "./repository";
import {
  formulaCatalogCreateSchema,
  type FormulaCatalogCreate,
  type FormulaTipo,
} from "./types";

class FormulasService {
  async list(tipo?: FormulaTipo) {
    return await formulasRepository.findAll({ tipo });
  }

  async create(data: unknown, creadoPorDocenteId?: number | null) {
    const parsed = formulaCatalogCreateSchema.parse(data);
    return await formulasRepository.create(parsed, creadoPorDocenteId);
  }

  async delete(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(
        "BadRequest",
        "BAD_REQUEST",
        "El identificador de la formula no es valido.",
      );
    }

    const deleted = await formulasRepository.softDelete(id);

    if (!deleted) {
      throw new AppError(
        "NotFound",
        "NOT_FOUND",
        "La formula solicitada no existe.",
      );
    }

    return deleted;
  }
}

export const formulasService = new FormulasService();
export type { FormulaCatalogCreate };

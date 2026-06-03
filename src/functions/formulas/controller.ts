import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { AppError } from "../../error";
import { controller, getAuthenticatedUser, route } from "../../lib/decorators";
import { response } from "../../utils/response";
import { formulasService } from "./service";
import { formulaCatalogQuerySchema } from "./types";
import type { UserSession } from "../auth/types";

const DIRECTOR_ROLE_IDS = new Set([2, 4]);

function assertDirector(req: HttpRequest): UserSession {
  const user = getAuthenticatedUser(req);

  if (!DIRECTOR_ROLE_IDS.has(Number(user.role))) {
    throw new AppError(
      "Forbidden",
      "FORBIDDEN",
      "Solo el director de escuela puede administrar formulas.",
    );
  }

  return user;
}

@controller("formulas")
export class FormulasController {
  @route("/", "GET")
  async list(req: HttpRequest): Promise<HttpResponseInit> {
    getAuthenticatedUser(req);

    const query = formulaCatalogQuerySchema.parse({
      tipo: req.query.get("tipo")?.trim() || undefined,
    });

    const formulas = await formulasService.list(query.tipo);
    return response.ok("Formulas obtenidas correctamente.", formulas);
  }

  @route("/", "POST")
  async create(req: HttpRequest): Promise<HttpResponseInit> {
    const user = assertDirector(req);
    const body = await req.json();
    const created = await formulasService.create(body, user.id);

    return response.created("Formula creada correctamente.", created);
  }

  @route("/{id}", "DELETE")
  async delete(req: HttpRequest): Promise<HttpResponseInit> {
    assertDirector(req);

    const id = Number(req.params.id);
    const deleted = await formulasService.delete(id);

    return response.ok("Formula eliminada correctamente.", deleted);
  }
}

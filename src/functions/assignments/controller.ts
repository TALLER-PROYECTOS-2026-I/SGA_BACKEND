import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { controller, route } from "../../lib/decorators";
import { STATUS_CODES } from "../../status-codes";
import { Listable } from "../../types";
import { assignmentsService } from "./service";
import { createAssignmentRequestSchema, listQueryParamsSchema } from "./types";

@controller("assignments")
export class AssignmentsController implements Listable {
  @route("/", "GET")
  async list(req: HttpRequest): Promise<HttpResponseInit> {
    const codigo = req.query.get("codigo")?.trim() || undefined;
    const nombre = req.query.get("nombre")?.trim() || undefined;
    const idSilaboParam = req.query.get("idSilabo")?.trim() || undefined;
    const idDocenteParam = req.query.get("idDocente")?.trim() || undefined;
    const areaCurricular = req.query.get("areaCurricular")?.trim() || undefined;
    const sinAsignarParam = req.query.get("sinAsignar")?.trim() || undefined;

    const filters = listQueryParamsSchema.parse({
      codigo,
      nombre,
      idSilabo: idSilaboParam,
      idDocente: idDocenteParam,
      areaCurricular: areaCurricular,
      sinAsignar: sinAsignarParam,
    });

    const items = await assignmentsService.list(filters);

    return {
      status: STATUS_CODES.OK,
      headers: { "Content-Type": "application/json" },
      jsonBody: {
        message: "Listado de sílabos obtenido correctamente.",
        data: items,
      },
    };
  }

  @route("/courses", "GET")
  async getAllCourses(req: HttpRequest): Promise<HttpResponseInit> {
    const sinAsignarParam = req.query.get("sinAsignar")?.trim();
    const sinAsignar =
      sinAsignarParam === "true" || sinAsignarParam === "1";
    const courses = await assignmentsService.getAllCourses({ sinAsignar });

    return {
      status: STATUS_CODES.OK,
      headers: { "Content-Type": "application/json" },
      jsonBody: {
        success: true,
        message: "Lista de cursos obtenida correctamente.",
        data: courses,
      },
    };
  }

  @route("/", "POST")
  async createAssignment(req: HttpRequest) {
    const body = await req.json();
    const parsedBody = createAssignmentRequestSchema.parse(body);
    await assignmentsService.create(parsedBody);
    return {
      status: STATUS_CODES.OK,
      headers: { "Content-Type": "application/json" },
      jsonBody: {
        message: "Asignación creada correctamente.",
      },
    };
  }
}

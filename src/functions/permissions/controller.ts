import {
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";
import { Updatable } from "../../types";
import { controller, route } from "../../lib/decorators";
import { permissionsService } from "./service";
import { AppError } from "../../error";
import { STATUS_CODES } from "../../status-codes";

@controller("permisos")
export class PermissionsController implements Updatable {
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

  @route("/{docenteId}/", "GET")
  async getPermissionsByDocente(
    _req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const docenteId = Number(_req.params.docenteId);

    if (!docenteId || Number.isNaN(docenteId)) {
      throw new AppError(
        "ERROR_PARAMETROS",
        "BAD_REQUEST",
        "Falta el parámetro docenteId",
      );
    }

    const silaboIdParam = _req.query.get("silaboId");
    const silaboId = silaboIdParam ? Number(silaboIdParam) : null;

    if (silaboIdParam && (!silaboId || Number.isNaN(silaboId))) {
      throw new AppError(
        "ERROR_PARAMETROS",
        "BAD_REQUEST",
        "El parámetro silaboId es inválido",
      );
    }

    const data = await permissionsService.getPermissionsByDocenteId(
      docenteId,
      silaboId,
    );

    return {
      status: STATUS_CODES.OK,
      jsonBody: data,
    };
  }

  @route("/", "POST")
  async assignPermissions(
    _req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const body = await _req.json();

    const data = await permissionsService.assignPermissions(body);

    return {
      status: STATUS_CODES.OK,
      jsonBody: {
        message: "Permisos asignados correctamente",
        data,
      },
    };
  }
}

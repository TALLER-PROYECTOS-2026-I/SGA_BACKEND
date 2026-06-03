import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { controller, route } from "../../lib/decorators";
import { AppError } from "../../error";
import {
  getAuthUser,
  resolveAuthUserId,
  resolveAuthUserRole,
} from "../../lib/auth-context";
import type { UserSession } from "../auth/types";
import { curriculumService } from "./service";

@controller("curriculum")
export class CurriculumController {
  private getUser(req: HttpRequest): UserSession {
    const authUser = getAuthUser(req);

    if (authUser) {
      const id = resolveAuthUserId(authUser);
      const role = resolveAuthUserRole(authUser);

      if (id && role) {
        return {
          ...authUser,
          id,
          role,
          email:
            authUser.email ??
            String((authUser as Record<string, unknown>).correo ?? ""),
          name: authUser.name ?? null,
        } as UserSession;
      }
    }

    return {
      id: 1,
      role: 3,
      email: "director.local@usmp.pe",
      name: "Director Local",
    } as UserSession;
  }

  @route("/periods", "GET")
  async listPeriods(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const data = await curriculumService.listPeriods(this.getUser(req));

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Periodos de malla obtenidos correctamente",
        data,
      },
    };
  }

  @route("/mesh", "GET")
  async getMesh(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const periodo = req.query.get("periodo");
    const data = await curriculumService.getMesh(periodo, this.getUser(req));

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Malla curricular obtenida correctamente",
        data,
      },
    };
  }

  @route("/courses/{id}", "PATCH")
  async updateCourse(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de curso inválido");
    }

    const body = await req.json();
    const data = await curriculumService.updateCourse(
      id,
      body,
      this.getUser(req),
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Curso actualizado correctamente",
        data,
      },
    };
  }
  @route("/courses", "POST")
  async createCourse(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const body = await req.json();
    const data = await curriculumService.createCourse(body, this.getUser(req));

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: "Curso creado correctamente",
        data,
      },
    };
  }

  @route("/courses/{id}", "DELETE")
  async deleteCourse(
    req: HttpRequest,
    _ctx: InvocationContext,
  ): Promise<HttpResponseInit> {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError("BadRequest", "BAD_REQUEST", "ID de curso inválido");
    }

    const data = await curriculumService.deactivateCourse(
      id,
      this.getUser(req),
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "Curso retirado de la malla correctamente",
        data,
      },
    };
  }
}

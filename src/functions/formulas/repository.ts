import { and, asc, eq, type SQL } from "drizzle-orm";
import { formulaCatalogo } from "../../../drizzle/schema";
import { BaseRepository } from "../../lib/repository";
import type { FormulaCatalogCreate, FormulaCatalogListFilters } from "./types";

class FormulasRepository extends BaseRepository {
  async findAll(filters: FormulaCatalogListFilters = {}) {
    const conditions: SQL[] = [];

    if (!filters.includeInactive) {
      conditions.push(eq(formulaCatalogo.activo, true));
    }

    if (filters.tipo) {
      conditions.push(eq(formulaCatalogo.tipo, filters.tipo));
    }

    let query = this.db.select().from(formulaCatalogo).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(
      asc(formulaCatalogo.tipo),
      asc(formulaCatalogo.nombre),
    );
  }

  async create(data: FormulaCatalogCreate, creadoPorDocenteId?: number | null) {
    const [created] = await this.db
      .insert(formulaCatalogo)
      .values({
        tipo: data.tipo,
        nombre: data.nombre,
        expresion: data.expresion,
        descripcion: data.descripcion?.trim() || null,
        variablesJson: data.variablesJson ?? null,
        subformulasJson: data.subformulasJson ?? null,
        activo: data.activo ?? true,
        creadoPorDocenteId: creadoPorDocenteId ?? null,
      })
      .returning();

    return created;
  }

  async softDelete(id: number) {
    const [deleted] = await this.db
      .update(formulaCatalogo)
      .set({
        activo: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(formulaCatalogo.id, id))
      .returning();

    return deleted ?? null;
  }
}

export const formulasRepository = new FormulasRepository();

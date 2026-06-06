import z from "zod";

export const formulaTipoSchema = z.enum(["PE", "PF"]);

export const formulaCatalogQuerySchema = z.object({
  tipo: formulaTipoSchema.optional(),
});

export const formulaCatalogCreateSchema = z.object({
  tipo: formulaTipoSchema,
  nombre: z.string().trim().min(1, "El nombre es requerido."),
  expresion: z.string().trim().min(1, "La expresion es requerida."),
  descripcion: z.string().trim().optional().nullable(),
  variablesJson: z.unknown().optional().nullable(),
  subformulasJson: z.unknown().optional().nullable(),
  activo: z.boolean().optional(),
});

export type FormulaTipo = z.infer<typeof formulaTipoSchema>;
export type FormulaCatalogQuery = z.infer<typeof formulaCatalogQuerySchema>;
export type FormulaCatalogCreate = z.infer<typeof formulaCatalogCreateSchema>;

export interface FormulaCatalogListFilters {
  tipo?: FormulaTipo;
  includeInactive?: boolean;
}

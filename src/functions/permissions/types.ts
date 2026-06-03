import { z } from "zod";

export const PermissionsSchema = z.object({
  silaboId: z.number().int().positive(),
  docenteId: z.number().int().positive(),
  permisos: z.array(
    z.object({
      numeroSeccion: z.number().int().positive(),
    }),
  ),
});
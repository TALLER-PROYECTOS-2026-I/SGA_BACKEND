import { z } from "zod";

// Schema para los filtros de búsqueda
export const silaboFiltersSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  idSilabo: z.number().int().positive().optional(),
  idDocente: z.number().int().positive().optional(),
  sinAsignar: z.boolean().optional(),
  areaCurricular: z.string().optional(),
});
export type SilaboFilters = z.infer<typeof silaboFiltersSchema>;

// Schema para un item de la lista de sílabos
export const silaboListItemSchema = z.object({
  cursoCodigo: z.string().nullable(),
  cursoNombre: z.string().nullable(),
  estadoRevision: z.string().nullable(),
  syllabusId: z.number().int().positive(),
  docenteId: z.number().int().positive().nullable(),
  nombreDocente: z.string().nullable(),
  docenteEmail: z.string().nullable(),
  areaCurricular: z.string().nullable(),
});
export type SilaboListItem = z.infer<typeof silaboListItemSchema>;

// Schema para lista simple de cursos (solo id, código y nombre)
export const courseSimpleSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().nullable(),
  name: z.string().nullable(),
  ciclo: z.string().nullable(),
  escuela: z.string().nullable(),
  estadoRevision: z.string().nullable(),
  docenteId: z.number().int().positive().nullable().optional(),
  nombreDocente: z.string().nullable().optional(),
});
export type CourseSimple = z.infer<typeof courseSimpleSchema>;

// Schema para validar query params del GET
export const listQueryParamsSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  idSilabo: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0),
      "idSilabo inválido",
    ),
  idDocente: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0),
      "idDocente inválido",
    ),
  areaCurricular: z.string().optional(),
  sinAsignar: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
});

export const createAssignmentRequestSchema = z.object({
  teacherId: z.number(),
  syllabusId: z.coerce.number(),
  academicPeriod: z.string(),
  message: z
    .string()
    .max(400, "El mensaje no puede exceder los 400 caracteres"),
});
export type CreateAssignmentRequest = z.infer<
  typeof createAssignmentRequestSchema
>;

export const createAssignmentPayloadSchema = z.object({
  syllabus: z.object({
    id: z.number(),
    name: z.string().nullable(),
    code: z.string().nullable(),
    department: z.string().nullable(),
  }),
  teacher: z.object({
    id: z.number(),
    email: z.email().nullable(),
    name: z.string().nullable(),
  }),
  message: z
    .string()
    .max(400, "El mensaje no puede exceder los 400 caracteres"),
  academyPeriod: z.string(),
});

export type CreateAssignmentPayload = z.infer<
  typeof createAssignmentPayloadSchema
>;

export const SYLLABUS_ALREADY_ASSIGNED_MESSAGE =
  "Este sílabo ya tiene docente asignado. Primero debe desasignarlo.";

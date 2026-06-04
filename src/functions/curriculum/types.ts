import { z } from "zod";

export const DEFAULT_CURRICULUM_PERIOD = "2026-I";

export const CurriculumPeriodSchema = z
  .string()
  .trim()
  .min(1, "El periodo académico es obligatorio")
  .max(20, "El periodo académico no debe superar 20 caracteres");

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).nullable().optional();

export const CurriculumCourseCreateSchema = z.object({
  periodo: CurriculumPeriodSchema.optional(),

  codigo: z
    .string()
    .trim()
    .min(1, "El código del curso es obligatorio")
    .max(50, "El código no debe superar 50 caracteres"),

  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del curso es obligatorio")
    .max(200, "El nombre del curso no debe superar 200 caracteres"),

  ciclo: z
    .number()
    .int("El ciclo debe ser un número entero")
    .min(1, "El ciclo debe ser mayor o igual a 1")
    .max(10, "El ciclo no debe superar 10")
    .nullable()
    .optional(),

  creditos: z
    .number()
    .int("Los créditos deben ser un número entero")
    .min(0, "Los créditos no pueden ser negativos")
    .max(30, "Los créditos no deben superar 30"),

  horasTeoria: z
    .number()
    .int("Las horas de teoría deben ser un número entero")
    .min(0, "Las horas de teoría no pueden ser negativas")
    .max(30, "Las horas de teoría no deben superar 30")
    .optional(),

  horasPractica: z
    .number()
    .int("Las horas de práctica deben ser un número entero")
    .min(0, "Las horas de práctica no pueden ser negativas")
    .max(30, "Las horas de práctica no deben superar 30")
    .optional(),

  modalidad: z
    .string()
    .trim()
    .min(1, "La modalidad es obligatoria")
    .max(80, "La modalidad no debe superar 80 caracteres")
    .optional(),

  tipoCurso: optionalText(
    120,
    "El tipo de curso no debe superar 120 caracteres",
  ),

  areaCurricular: optionalText(
    160,
    "El área curricular no debe superar 160 caracteres",
  ),

  prerrequisitos: z.array(z.string().trim()).optional(),
});

export const CurriculumCourseUpdateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "El código del curso es obligatorio")
    .max(50, "El código no debe superar 50 caracteres")
    .optional(),

  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del curso es obligatorio")
    .max(200, "El nombre del curso no debe superar 200 caracteres")
    .optional(),

  ciclo: z
    .number()
    .int("El ciclo debe ser un número entero")
    .min(1, "El ciclo debe ser mayor o igual a 1")
    .max(10, "El ciclo no debe superar 10")
    .nullable()
    .optional(),

  creditos: z
    .number()
    .int("Los créditos deben ser un número entero")
    .min(0, "Los créditos no pueden ser negativos")
    .max(30, "Los créditos no deben superar 30")
    .optional(),

  horasTeoria: z
    .number()
    .int("Las horas de teoría deben ser un número entero")
    .min(0, "Las horas de teoría no pueden ser negativas")
    .max(30, "Las horas de teoría no deben superar 30")
    .optional(),

  horasPractica: z
    .number()
    .int("Las horas de práctica deben ser un número entero")
    .min(0, "Las horas de práctica no pueden ser negativas")
    .max(30, "Las horas de práctica no deben superar 30")
    .optional(),

  modalidad: z
    .string()
    .trim()
    .min(1, "La modalidad es obligatoria")
    .max(80, "La modalidad no debe superar 80 caracteres")
    .optional(),

  tipoCurso: optionalText(
    120,
    "El tipo de curso no debe superar 120 caracteres",
  ),

  areaCurricular: optionalText(
    160,
    "El área curricular no debe superar 160 caracteres",
  ),

  prerrequisitos: z.array(z.string().trim()).optional(),
});

export type CurriculumCourseCreate = z.infer<
  typeof CurriculumCourseCreateSchema
>;

export type CurriculumCourseUpdate = z.infer<
  typeof CurriculumCourseUpdateSchema
>;

export type CurriculumCourseItem = {
  id: number;
  periodo: string;
  codigo: string;
  nombre: string;
  ciclo: number | null;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  modalidad: string;
  tipoCurso: string | null;
  areaCurricular: string | null;
  prerrequisitos: string[];
  activo: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CurriculumMeshResponse = {
  periodo: string;
  ciclos: Array<{
    ciclo: number;
    nombre: string;
    cursos: CurriculumCourseItem[];
  }>;
  electivos: CurriculumCourseItem[];
};

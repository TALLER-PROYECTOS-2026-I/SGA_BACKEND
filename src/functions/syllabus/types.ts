// types.ts
import { boolean, int, z } from "zod";

const SHORT_TEXT_MAX = 255;
const MEDIUM_TEXT_MAX = 1000;
const LONG_TEXT_MAX = 6000;
const OBSERVATION_MAX = 2000;
const nonEmptyShortText = (label: string) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(SHORT_TEXT_MAX);
const optionalShortText = z.string().trim().max(SHORT_TEXT_MAX).optional();
const optionalMediumText = z.string().trim().max(MEDIUM_TEXT_MAX).optional();
const optionalLongText = z.string().trim().max(LONG_TEXT_MAX).optional();
const nonNegativeInt = z.number().int().nonnegative();

//---------------------------
export const SyllabusCreateSchema = z.object({
  asignadoADocenteId: z.coerce.number().optional(),
  asignado_a_docente_id: z.number().optional(),
  docenteId: z.coerce.number().optional(),

  creadoPorDocenteId: z.coerce.number().optional(),
  actualizadoPorDocenteId: z.coerce.number().optional(),
  nombreAsignatura: nonEmptyShortText("El nombre de asignatura"),
  departamentoAcademico: nonEmptyShortText("El departamento académico"),
  escuelaProfesional: nonEmptyShortText("La escuela profesional"),
  programaAcademico: nonEmptyShortText("El programa académico"),
  semestreAcademico: nonEmptyShortText("El semestre académico"),
  tipoAsignatura: nonEmptyShortText("El tipo de asignatura"),
  tipoEstudios: nonEmptyShortText("El tipo de estudios"),
  modalidad: nonEmptyShortText("La modalidad"),
  codigoAsignatura: nonEmptyShortText("El código de asignatura"),
  ciclo: nonEmptyShortText("El ciclo"),
  requisitos: z.string().trim().max(MEDIUM_TEXT_MAX),

  // 🔹 Campos de horas
  horasTeoria: nonNegativeInt,
  horasPractica: nonNegativeInt,
  horasLaboratorio: nonNegativeInt.nullable().optional(),
  horasTotales: nonNegativeInt,

  horasTeoriaLectivaPresencial: nonNegativeInt.nullable().optional(),
  horasTeoriaLectivaDistancia: nonNegativeInt.nullable().optional(),
  horasTeoriaNoLectivaPresencial: nonNegativeInt.nullable().optional(),
  horasTeoriaNoLectivaDistancia: nonNegativeInt.nullable().optional(),

  horasPracticaLectivaPresencial: nonNegativeInt.nullable().optional(),
  horasPracticaLectivaDistancia: nonNegativeInt.nullable().optional(),
  horasPracticaNoLectivaPresencial: nonNegativeInt.nullable().optional(),
  horasPracticaNoLectivaDistancia: nonNegativeInt.nullable().optional(),

  // 🔹 Campos de créditos
  creditosTeoria: nonNegativeInt,
  creditosPractica: nonNegativeInt,
  creditosTotales: nonNegativeInt,
  estadoRevision: optionalShortText,
});

export const SumillaSchema = z.object({
  sumilla: z
    .string()
    .trim()
    .min(1, { message: "La sumilla es obligatoria y debe ser texto" })
    .max(LONG_TEXT_MAX, {
      message: `La sumilla no debe superar ${LONG_TEXT_MAX} caracteres`,
    })
    .refine((val) => val.trim().split(/\s+/).length >= 80, {
      message: "La sumilla debe tener al menos 80 palabras",
    }),
});
//----------------------------

/* comunes */
export const OrderSchema = z
  .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return undefined;
    return typeof v === "string" ? Number(v) : v;
  });

export const IdSchema = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
  .transform((v) => (typeof v === "string" ? Number(v) : v))
  .optional();

/* code componentes: letra.número */
export const CodeSchemaComponent = z.preprocess(
  (v) => {
    const s =
      typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
    const raw = s.toLowerCase().trim();
    const m = raw.match(/^([a-z])[\s._-]*([0-9]+)$/);
    if (m) return `${m[1]}.${Number(m[2])}`;
    return raw;
  },
  z
    .string()
    .regex(
      /^[a-z]\.[1-9]\d*$/,
      "El codigo debe ser letra.numero, ejemplo g.1-g.2",
    ),
);

/* code actitudinales: una letra */
export const CodeSchemaAttitude = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]$/, "Ingresa el codigo (a-z)");
//1
/* COMPONENTES */
export const CreateComponentsSchema = z.object({
  items: z
    .array(
      z.object({
        id: IdSchema.optional(),
        text: z
          .string()
          .trim()
          .min(1, "El campo 'text' es obligatorio")
          .max(MEDIUM_TEXT_MAX),
        code: CodeSchemaComponent.optional(), // ← tiene code
        order: OrderSchema,
      }),
    )
    .default([]),
});
export type CreateComponents = z.infer<typeof CreateComponentsSchema>;

/* ACTITUDINALES */
export const CreateAttitudesSchema = z.object({
  items: z
    .array(
      z.object({
        id: IdSchema.optional(),
        text: z
          .string()
          .trim()
          .min(1, "El campo 'text' es obligatorio")
          .max(MEDIUM_TEXT_MAX),
        code: CodeSchemaAttitude.optional(),
        order: OrderSchema,
      }),
    )
    .default([]),
});
export type CreateAttitudes = z.infer<typeof CreateAttitudesSchema>;

/* COMPETENCIAS (si tu service usa UpsertCompetenciesSchema, expórtalo aquí) */
export const UpsertCompetenciesSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: IdSchema.optional(),
          text: z
            .string()
            .trim()
            .min(1, "Deberias completar el campo 'text' ")
            .max(MEDIUM_TEXT_MAX),
          // aquí puedes dejar solo letras/números simples:
          code: z
            .union([
              z
                .string()
                .trim()
                .min(1, "El campo 'code' es obligatorio")
                .max(20),
              z.number(),
            ])
            .transform((v) => v.toString().trim())
            .optional(),
          order: OrderSchema,
        }),
      )
      .default([]),
  })
  .strict();
export type UpsertCompetencies = z.infer<typeof UpsertCompetenciesSchema>;

// =====================================================
// 🔹 APORTES
// =====================================================
export const ContributionCreateSchema = z.object({
  syllabusId: z.number().min(1, { message: "El ID del sílabo es obligatorio" }),
  resultadoProgramaCodigo: z
    .string()
    .trim()
    .min(1, { message: "El código del resultado del programa es obligatorio" })
    .max(20),
  resultadoProgramaDescripcion: optionalLongText,
  aporteValor: z
    .enum(["K", "R", ""], {
      message: "El aporte solo puede ser 'K', 'R' o vacío",
    })
    .optional()
    .default(""),
});

export type ContributionCreateType = z.infer<typeof ContributionCreateSchema>;

// =====================================================
// 🔹 RESPUESTA COMPLETA DEL SÍLABO
// =====================================================
export const CompleteSyllabusResponseSchema = z.object({
  // I. DATOS GENERALES
  datosGenerales: z.object({
    departamentoAcademico: z.string().nullable(),
    escuelaProfesional: z.string().nullable(),
    programaAcademico: z.string().nullable(),
    semestreAcademico: z.string().nullable(),
    areaCurricular: z.string().nullable(),
    codigoAsignatura: z.string().nullable(),
    nombreAsignatura: z.string().nullable(),
    tipoAsignatura: z.string().nullable(),
    tipoEstudios: z.string().nullable(),
    modalidad: z.string().nullable(),
    ciclo: z.string().nullable(),
    requisitos: z.string().nullable(),
    docentes: z.string().nullable(),

    // Horas
    horasTeoria: z.number().nullable(),
    horasPractica: z.number().nullable(),
    horasLaboratorio: z.number().nullable(),
    horasTotales: z.number().nullable(),

    // Créditos
    creditosTeoria: z.number().nullable(),
    creditosPractica: z.number().nullable(),
    creditosTotales: z.number().nullable(),
  }),

  // II. SUMILLA
  sumilla: z.string().nullable(),

  // III. COMPETENCIAS DEL CURSO
  competenciasCurso: z.array(
    z.object({
      id: z.number(),
      codigo: z.string().nullable(),
      descripcion: z.string(),
      orden: z.number().nullable(),
    }),
  ),

  // IV. COMPONENTES DE COMPETENCIAS
  componentesConceptuales: z.array(
    z.object({
      id: z.number(),
      codigo: z.string().nullable(),
      descripcion: z.string(),
      orden: z.number().nullable(),
    }),
  ),

  componentesProcedimentales: z.array(
    z.object({
      id: z.number(),
      codigo: z.string().nullable(),
      descripcion: z.string(),
      orden: z.number().nullable(),
    }),
  ),

  componentesActitudinales: z.array(
    z.object({
      id: z.number(),
      codigo: z.string().nullable(),
      descripcion: z.string(),
      orden: z.number().nullable(),
    }),
  ),

  // V. RESULTADOS DE APRENDIZAJE
  resultadosAprendizaje: z.array(
    z.object({
      id: z.number(),
      descripcion: z.string(),
      orden: z.number().nullable(),
    }),
  ),

  // VI. UNIDADES DIDÁCTICAS
  unidadesDidacticas: z.array(
    z.object({
      id: z.number(),
      numero: z.number(),
      titulo: z.string(),
      semanaInicio: z.number().nullable(),
      semanaFin: z.number().nullable(),
      contenidosConceptuales: z.string().nullable(),
      contenidosProcedimentales: z.string().nullable(),
      actividadesAprendizaje: z.string().nullable(),
      horasLectivasTeoria: z.number().nullable(),
      horasLectivasPractica: z.number().nullable(),
    }),
  ),

  // VII. ESTRATEGIAS METODOLÓGICAS
  estrategiasMetodologicas: z.string().nullable(),

  // VIII. RECURSOS DIDÁCTICOS
  recursosDidacticos: z.array(
    z.object({
      id: z.number(),
      recursoNombre: z.string(),
      destino: z.string().nullable(),
      observaciones: z.string().nullable(),
    }),
  ),

  // IX. EVALUACIÓN DEL APRENDIZAJE
  evaluacionAprendizaje: z.object({
    planEvaluacion: z.array(
      z.object({
        id: z.number(),
        componenteNombre: z.string(),
        instrumentoNombre: z.string().nullable(),
        semana: z.number().nullable(),
        fecha: z.string().nullable(),
      }),
    ),
    formulaEvaluacion: z.string().nullable(),
  }),

  // X. FUENTES DE INFORMACIÓN
  fuentes: z.array(
    z.object({
      id: z.number(),
      tipo: z.string(),
      autores: z.string().nullable(),
      anio: z.number().nullable(),
      titulo: z.string().nullable(),
      editorial: z.string().nullable(),
      ciudad: z.string().nullable(),
      isbn: z.string().nullable(),
      url: z.string().nullable(),
    }),
  ),

  // APORTE A RESULTADOS DEL PROGRAMA
  aportesResultadosPrograma: z.array(
    z.object({
      resultadoCodigo: z.string(),
      resultadoDescripcion: z.string().nullable(),
      aporteValor: z.string().nullable(),
    }),
  ),
});

export type CompleteSyllabusResponse = z.infer<
  typeof CompleteSyllabusResponseSchema
>;

/* ========================================
   SECCIÓN VIII: FUENTES DE CONSULTA
   ======================================== */
const FuenteTipoSchema = z
  .enum([
    "LIBRO",
    "ART",
    "WEB",
    "libro",
    "articulo",
    "recurso_electronico",
    "otro",
  ])
  .transform((value) => {
    if (value === "libro") return "LIBRO";
    if (value === "articulo") return "ART";
    if (value === "recurso_electronico") return "WEB";
    if (value === "otro") return "ART";
    return value;
  });

export const FuenteCreateSchema = z.object({
  tipo: FuenteTipoSchema,
  autores: z
    .string()
    .trim()
    .min(1, "El autor o fuente es obligatorio")
    .max(MEDIUM_TEXT_MAX),
  anio: z.number().int().min(1900).max(2100).optional(),
  titulo: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(MEDIUM_TEXT_MAX),
  editorialRevista: optionalShortText,
  ciudad: optionalShortText,
  isbnIssn: optionalShortText,
  doiUrl: z
    .string()
    .trim()
    .url("La URL no tiene un formato válido")
    .optional()
    .or(z.literal("")),
  notas: optionalMediumText,
});

export const FuenteUpdateSchema = FuenteCreateSchema.partial();

export type FuenteCreate = z.output<typeof FuenteCreateSchema>;
export type FuenteUpdate = z.output<typeof FuenteUpdateSchema>;

/* ========================================
   SECCIÓN IV: UNIDADES (PROGRAMACIÓN DE CONTENIDOS)
   ======================================== */

// Schema para las semanas de una unidad
export const UnidadSemanaSchema = z.object({
  id: z.number().int().optional(),
  silaboUnidadId: z.number().int().optional(),
  semana: z.number().int().min(1).max(16),
  contenidosConceptuales: optionalLongText.nullable(),
  contenidosProcedimentales: optionalLongText.nullable(),
  actividadesAprendizaje: optionalLongText.nullable(),
  horasLectivasTeoria: z.number().int().nonnegative().default(0),
  horasLectivasPractica: z.number().int().nonnegative().default(0),
  horasNoLectivasTeoria: z.number().int().nonnegative().default(0),
  horasNoLectivasPractica: z.number().int().nonnegative().default(0),
  creadoEn: z.string().optional(),
  actualizadoEn: z.string().optional(),
});

export const UnidadCreateSchema = z.object({
  numero: z.number().int().min(1).max(16),
  titulo: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(SHORT_TEXT_MAX),
  capacidadesText: optionalLongText,
  semanaInicio: z.number().int().min(1).max(16).optional(),
  semanaFin: z.number().int().min(1).max(16).optional(),
  contenidosConceptuales: optionalLongText,
  contenidosProcedimentales: optionalLongText,
  actividadesAprendizaje: optionalLongText,
  horasLectivasTeoria: z.number().int().nonnegative().optional(),
  horasLectivasPractica: z.number().int().nonnegative().optional(),
  horasNoLectivasTeoria: z.number().int().nonnegative().optional(),
  horasNoLectivasPractica: z.number().int().nonnegative().optional(),
  semanas: z.array(UnidadSemanaSchema).optional(),
});

export const UnidadUpdateSchema = UnidadCreateSchema.partial();

// Schema para respuesta completa de unidad (GET)
export const UnidadCompleteSchema = z.object({
  id: z.number().int(),
  silaboId: z.number().int(),
  numero: z.number().int(),
  titulo: z.string(),
  capacidadesText: z.string().nullable().optional(),
  semanaInicio: z.number().int().nullable().optional(),
  semanaFin: z.number().int().nullable().optional(),
  contenidosConceptuales: z.string().nullable().optional(),
  contenidosProcedimentales: z.string().nullable().optional(),
  actividadesAprendizaje: z.string().nullable().optional(),
  horasLectivasTeoria: z.number().int().nullable().optional(),
  horasLectivasPractica: z.number().int().nullable().optional(),
  horasNoLectivasTeoria: z.number().int().nullable().optional(),
  horasNoLectivasPractica: z.number().int().nullable().optional(),
  creadoEn: z.string().optional(),
  actualizadoEn: z.string().optional(),
  semanas: z.array(UnidadSemanaSchema),
});

export type UnidadSemana = z.infer<typeof UnidadSemanaSchema>;
export type UnidadCreate = z.infer<typeof UnidadCreateSchema>;
export type UnidadUpdate = z.infer<typeof UnidadUpdateSchema>;
export type UnidadComplete = z.infer<typeof UnidadCompleteSchema>;

/* ========================================
   SECCIÓN I: DATOS GENERALES (UPDATE)
   ======================================== */
export const DatosGeneralesUpdateSchema = z.object({
  departamentoAcademico: optionalShortText,
  escuelaProfesional: optionalShortText,
  programaAcademico: optionalShortText,
  areaCurricular: optionalShortText,
  cursoCodigo: optionalShortText,
  cursoNombre: optionalShortText,
  semestreAcademico: optionalShortText,
  tipoAsignatura: optionalShortText,
  tipoDeEstudios: optionalShortText,
  modalidadDeAsignatura: optionalShortText,
  formatoDeCurso: optionalShortText,
  ciclo: optionalShortText,
  requisitos: optionalMediumText,
  horasTeoria: nonNegativeInt.optional(),
  horasPractica: nonNegativeInt.optional(),
  horasLaboratorio: nonNegativeInt.optional(),
  horasTotales: nonNegativeInt.optional(),
  creditosTotales: nonNegativeInt.optional(),
});

export const DesaprobarSilabo = z.object({
  silaboId: z.number().int().positive(),
  docenteId: z.number().int().positive().optional(),
  observaciones: z.array(
    z.object({
      numeroSeccion: int(),
      nombreSeccion: z.string().trim().min(1).max(SHORT_TEXT_MAX),
      comentario: z.string().trim().max(OBSERVATION_MAX),
      estado: z.enum(["APROBADO", "DESAPROBADO"]).optional(), // Opcional porque usamos valor fijo en backend
    }),
  ),
});

export type DatosGeneralesUpdate = z.infer<typeof DatosGeneralesUpdateSchema>;

/* ========================================
   FÓRMULA DE EVALUACIÓN
   ======================================== */

// Variable individual de la fórmula
export const FormulaVariableSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "El código de la variable es requerido")
    .max(20),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre de la variable es requerido")
    .max(SHORT_TEXT_MAX),
  tipo: z.string().trim().max(SHORT_TEXT_MAX).default(""),
  descripcion: optionalMediumText,
  orden: z.number().int().nonnegative().optional(),
});

// Subfórmula (expresión intermedia)
export const FormulaSubformulaSchema = z.object({
  variableCodigo: z
    .string()
    .trim()
    .min(1, "El código de la variable es requerido")
    .max(20),
  expresion: z
    .string()
    .trim()
    .min(1, "La expresión es requerida")
    .max(MEDIUM_TEXT_MAX),
});

// Mapeo de variable a plan de evaluación
export const FormulaVariablePlanMappingSchema = z.object({
  variableCodigo: z.string().min(1, "El código de la variable es requerido"),
  planEvaluacionOfertaId: z
    .number()
    .int()
    .positive("ID del plan de evaluación requerido"),
});

// Plan de evaluación (componente de evaluación)
export const PlanEvaluacionSchema = z.object({
  id: z.number().int().positive(),
  componenteNombre: z.string().trim().max(SHORT_TEXT_MAX),
  instrumentoNombre: z.string().trim().max(SHORT_TEXT_MAX).nullable(),
  semana: z.number().int().min(1).max(16).nullable(),
  fecha: z.string().nullable(),
  instrucciones: z.string().trim().max(MEDIUM_TEXT_MAX).nullable(),
  rubricaUrl: z.string().trim().url().nullable().or(z.literal("")),
});

// Variable con su mapeo al plan
export const FormulaVariableWithPlanSchema = FormulaVariableSchema.extend({
  planEvaluacion: PlanEvaluacionSchema.nullable().optional(),
});

// Respuesta completa de la fórmula de evaluación (GET)
export const FormulaEvaluacionCompleteSchema = z.object({
  id: z.number().int().positive(),
  silaboId: z.number().int().positive(),
  nombreRegla: z.string(),
  variableFinalCodigo: z.string(),
  expresionFinal: z.string(),
  activo: z.boolean(),
  variables: z.array(FormulaVariableSchema),
  subformulas: z.array(FormulaSubformulaSchema),
  variablePlanMappings: z.array(FormulaVariablePlanMappingSchema),
  planesEvaluacion: z.array(PlanEvaluacionSchema).optional(),
});

// Schema para crear una nueva fórmula (POST)
export const FormulaEvaluacionCreateSchema = z.object({
  silaboId: z.number().int().positive("ID del sílabo requerido"),
  nombreRegla: z
    .string()
    .trim()
    .min(1, "El nombre de la regla es requerido")
    .max(SHORT_TEXT_MAX),
  variableFinalCodigo: z
    .string()
    .trim()
    .min(1, "El código de la variable final es requerido")
    .max(20),
  expresionFinal: z
    .string()
    .trim()
    .min(1, "La expresión final es requerida")
    .max(MEDIUM_TEXT_MAX),
  activo: z.boolean().default(true),
  variables: z
    .array(FormulaVariableSchema)
    .min(1, "Debe incluir al menos una variable"),
  subformulas: z.array(FormulaSubformulaSchema).optional().default([]),
  variablePlanMappings: z
    .array(FormulaVariablePlanMappingSchema)
    .optional()
    .default([]),
});

// Schema para actualizar una fórmula existente (PUT)
export const FormulaEvaluacionUpdateSchema = z.object({
  nombreRegla: z.string().trim().min(1).max(SHORT_TEXT_MAX).optional(),
  variableFinalCodigo: z.string().trim().min(1).max(20).optional(),
  expresionFinal: z.string().trim().min(1).max(MEDIUM_TEXT_MAX).optional(),
  activo: z.boolean().optional(),
  variables: z.array(FormulaVariableSchema).optional(),
  subformulas: z.array(FormulaSubformulaSchema).optional(),
  variablePlanMappings: z.array(FormulaVariablePlanMappingSchema).optional(),
});

export type FormulaVariable = z.infer<typeof FormulaVariableSchema>;
export type FormulaSubformula = z.infer<typeof FormulaSubformulaSchema>;
export type FormulaVariablePlanMapping = z.infer<
  typeof FormulaVariablePlanMappingSchema
>;
export type PlanEvaluacion = z.infer<typeof PlanEvaluacionSchema>;
export type FormulaEvaluacionComplete = z.infer<
  typeof FormulaEvaluacionCompleteSchema
>;
export type FormulaEvaluacionCreate = z.infer<
  typeof FormulaEvaluacionCreateSchema
>;
export type FormulaEvaluacionUpdate = z.infer<
  typeof FormulaEvaluacionUpdateSchema
>;

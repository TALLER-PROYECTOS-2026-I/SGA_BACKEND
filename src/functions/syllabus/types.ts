// types.ts
import { boolean, int, z } from "zod";

//---------------------------
export const SyllabusCreateSchema = z.object({
  nombreAsignatura: z.string(),
  departamentoAcademico: z.string(),
  escuelaProfesional: z.string(),
  programaAcademico: z.string(),
  semestreAcademico: z.string(),
  tipoAsignatura: z.string(),
  tipoEstudios: z.string(),
  modalidad: z.string(),
  codigoAsignatura: z.string(),
  ciclo: z.string(),
  requisitos: z.string(),

  // 🔹 Campos de horas
  horasTeoria: z.number(),
  horasPractica: z.number(),
  horasLaboratorio: z.number().nullable().optional(),
  horasTotales: z.number(),

  horasTeoriaLectivaPresencial: z.number().nullable().optional(),
  horasTeoriaLectivaDistancia: z.number().nullable().optional(),
  horasTeoriaNoLectivaPresencial: z.number().nullable().optional(),
  horasTeoriaNoLectivaDistancia: z.number().nullable().optional(),

  horasPracticaLectivaPresencial: z.number().nullable().optional(),
  horasPracticaLectivaDistancia: z.number().nullable().optional(),
  horasPracticaNoLectivaPresencial: z.number().nullable().optional(),
  horasPracticaNoLectivaDistancia: z.number().nullable().optional(),

  // 🔹 Campos de créditos
  creditosTeoria: z.number(),
  creditosPractica: z.number(),
  creditosTotales: z.number(),
});

export const SumillaSchema = z.object({
  sumilla: z
    .string()
    .min(1, { message: "La sumilla es obligatoria y debe ser texto" })
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
        text: z.string().trim().min(1, "El campo 'text' es obligatorio"),
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
        text: z.string().min(1, "El campo 'text' es obligatorio"),
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
          text: z.string().trim().min(1, "Deberias completar el campo 'text' "),
          // aquí puedes dejar solo letras/números simples:
          code: z
            .union([
              z.string().trim().min(1, "El campo 'code' es obligatorio"),
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
    .min(1, { message: "El código del resultado del programa es obligatorio" }),
  resultadoProgramaDescripcion: z.string().optional(),
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
export const FuenteCreateSchema = z.object({
  tipo: z.enum(["libro", "articulo", "recurso_electronico", "otro"]),
  autores: z.string().optional(),
  anio: z.number().int().min(1900).max(2100).optional(),
  titulo: z.string().min(1, "El título es obligatorio"),
  editorialRevista: z.string().optional(),
  ciudad: z.string().optional(),
  isbnIssn: z.string().optional(),
  doiUrl: z.string().url().optional().or(z.literal("")),
  notas: z.string().optional(),
});

export const FuenteUpdateSchema = FuenteCreateSchema.partial();

export type FuenteCreate = z.infer<typeof FuenteCreateSchema>;
export type FuenteUpdate = z.infer<typeof FuenteUpdateSchema>;

/* ========================================
   SECCIÓN IV: UNIDADES (PROGRAMACIÓN DE CONTENIDOS)
   ======================================== */

// Schema para las semanas de una unidad
export const UnidadSemanaSchema = z.object({
  id: z.number().int().optional(),
  silaboUnidadId: z.number().int().optional(),
  semana: z.number().int().min(1).max(16),
  contenidosConceptuales: z.string().optional().nullable(),
  contenidosProcedimentales: z.string().optional().nullable(),
  actividadesAprendizaje: z.string().optional().nullable(),
  horasLectivasTeoria: z.number().int().nonnegative().default(0),
  horasLectivasPractica: z.number().int().nonnegative().default(0),
  horasNoLectivasTeoria: z.number().int().nonnegative().default(0),
  horasNoLectivasPractica: z.number().int().nonnegative().default(0),
  creadoEn: z.string().optional(),
  actualizadoEn: z.string().optional(),
});

// Schema para crear un contenido conceptual
export const ContenidoConceptualCreateSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(400, "La descripción no debe exceder 400 caracteres"),
  orden: z.number().int().positive().optional(),
});

export const ContenidoConceptualUpdateSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(400, "La descripción no debe exceder 400 caracteres"),
  orden: z.number().int().positive().optional(),
});

export const ContenidoConceptualResponseSchema = z.object({
  id: z.number().int(),
  silaboUnidadSemanaId: z.number().int(),
  descripcion: z.string(),
  orden: z.number().int(),
  creadoEn: z.string().optional(),
  actualizadoEn: z.string().optional(),
});

export const UnidadCreateSchema = z.object({
  numero: z.number().int().positive(),
  titulo: z.string().min(1, "El título es obligatorio"),
  capacidadesText: z.string().optional(),
  semanaInicio: z.number().int().positive().optional(),
  semanaFin: z.number().int().positive().optional(),
  contenidosConceptuales: z.string().optional(),
  contenidosProcedimentales: z.string().optional(),
  actividadesAprendizaje: z.string().optional(),
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
  departamentoAcademico: z.string().optional(),
  escuelaProfesional: z.string().optional(),
  programaAcademico: z.string().optional(),
  areaCurricular: z.string().optional(),
  cursoCodigo: z.string().optional(),
  cursoNombre: z.string().optional(),
  semestreAcademico: z.string().optional(),
  tipoAsignatura: z.string().optional(),
  tipoDeEstudios: z.string().optional(),
  modalidadDeAsignatura: z.string().optional(),
  formatoDeCurso: z.string().optional(),
  ciclo: z.string().optional(),
  requisitos: z.string().optional(),
  horasTeoria: z.number().int().nonnegative().optional(),
  horasPractica: z.number().int().nonnegative().optional(),
  horasLaboratorio: z.number().int().nonnegative().optional(),
  horasTotales: z.number().int().nonnegative().optional(),
  creditosTotales: z.number().int().nonnegative().optional(),
});

export const DesaprobarSilabo = z.object({
  silaboId: z.number().int().positive(),
  observaciones: z.array(
    z.object({
      numeroSeccion: int(),
      nombreSeccion: z.string(),
      comentario: z.string(),
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
  codigo: z.string().min(1, "El código de la variable es requerido"),
  nombre: z.string().min(1, "El nombre de la variable es requerido"),
  tipo: z.string().default(""),
  descripcion: z.string().optional(),
  orden: z.number().int().nonnegative().optional(),
});

// Subfórmula (expresión intermedia)
export const FormulaSubformulaSchema = z.object({
  variableCodigo: z.string().min(1, "El código de la variable es requerido"),
  expresion: z.string().min(1, "La expresión es requerida"),
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
  componenteNombre: z.string(),
  instrumentoNombre: z.string().nullable(),
  semana: z.number().int().nullable(),
  fecha: z.string().nullable(),
  instrucciones: z.string().nullable(),
  rubricaUrl: z.string().nullable(),
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
  nombreRegla: z.string().min(1, "El nombre de la regla es requerido"),
  variableFinalCodigo: z
    .string()
    .min(1, "El código de la variable final es requerido"),
  expresionFinal: z.string().min(1, "La expresión final es requerida"),
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
  nombreRegla: z.string().min(1).optional(),
  variableFinalCodigo: z.string().min(1).optional(),
  expresionFinal: z.string().min(1).optional(),
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

export type ContenidoConceptualCreate = z.infer<
  typeof ContenidoConceptualCreateSchema
>;

export type ContenidoConceptualUpdate = z.infer<
  typeof ContenidoConceptualUpdateSchema
>;

export type ContenidoConceptualResponse = z.infer<
  typeof ContenidoConceptualResponseSchema
>;

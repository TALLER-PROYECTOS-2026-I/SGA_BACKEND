/**
 * Mapeo oficial sílabo: sección (1–9) ↔ endpoints.
 * Usar estos valores en assertCanEditSyllabus y en documentación de rutas.
 */
export const SYLLABUS_SECTION = {
  DATOS_GENERALES: 1,
  SUMILLA: 2,
  COMPETENCIAS: 3,
  PROGRAMACION: 4,
  ESTRATEGIAS: 5,
  RECURSOS: 6,
  EVALUACION: 7,
  FUENTES: 8,
  APORTES: 9,
} as const;

export type SyllabusSectionNumber =
  (typeof SYLLABUS_SECTION)[keyof typeof SYLLABUS_SECTION];

export const SECTION_EDIT_LABELS: Record<number, string> = {
  [SYLLABUS_SECTION.DATOS_GENERALES]: "Datos generales",
  [SYLLABUS_SECTION.SUMILLA]: "Sumilla",
  [SYLLABUS_SECTION.COMPETENCIAS]: "Competencias y componentes",
  [SYLLABUS_SECTION.PROGRAMACION]: "Programación del contenido",
  [SYLLABUS_SECTION.ESTRATEGIAS]: "Estrategias metodológicas",
  [SYLLABUS_SECTION.RECURSOS]: "Recursos didácticos",
  [SYLLABUS_SECTION.EVALUACION]: "Evaluación del aprendizaje",
  [SYLLABUS_SECTION.FUENTES]: "Fuentes de consulta",
  [SYLLABUS_SECTION.APORTES]: "Aporte de la asignatura",
};

const ROUTE_SECTION_RULES: Array<{
  pattern: RegExp;
  section: SyllabusSectionNumber;
}> = [
  {
    pattern: /\/datos-generales\b/i,
    section: SYLLABUS_SECTION.DATOS_GENERALES,
  },
  { pattern: /\/sumilla\b/i, section: SYLLABUS_SECTION.SUMILLA },
  {
    pattern: /\/(competencies|components|attitudes)\b/i,
    section: SYLLABUS_SECTION.COMPETENCIAS,
  },
  { pattern: /\/unidades\b/i, section: SYLLABUS_SECTION.PROGRAMACION },
  {
    pattern:
      /\/(estrategias_metodologicas|estrategias|methodological-strategies)\b/i,
    section: SYLLABUS_SECTION.ESTRATEGIAS,
  },
  {
    pattern: /\/(recursos_didacticos|recursos_didacticos_notas|recursos)\b/i,
    section: SYLLABUS_SECTION.RECURSOS,
  },
  {
    pattern:
      /\/(formula_evaluacion|formula|evaluacion_aprendizaje|plan_evaluacion)\b/i,
    section: SYLLABUS_SECTION.EVALUACION,
  },
  { pattern: /\/fuentes\b/i, section: SYLLABUS_SECTION.FUENTES },
  {
    pattern: /\/(contribution|resultados|outcomes|aportes)\b/i,
    section: SYLLABUS_SECTION.APORTES,
  },
];

export function isValidSectionNumber(
  value: number,
): value is SyllabusSectionNumber {
  return Number.isFinite(value) && value >= 1 && value <= 9;
}

export function getSectionLabel(sectionNumber: number): string {
  return SECTION_EDIT_LABELS[sectionNumber] ?? `sección ${sectionNumber}`;
}

/** Resuelve número de sección a partir del path de la petición (p. ej. /api/syllabus/10/competencies). */
export function getSectionNumberForPath(
  path: string,
): SyllabusSectionNumber | null {
  const normalized = String(path ?? "").trim();

  for (const rule of ROUTE_SECTION_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.section;
    }
  }

  return null;
}

export function getSectionNumberForEndpoint(
  endpointKey: string,
): SyllabusSectionNumber | null {
  const key = String(endpointKey ?? "")
    .trim()
    .toLowerCase();

  const map: Record<string, SyllabusSectionNumber> = {
    "datos-generales": SYLLABUS_SECTION.DATOS_GENERALES,
    sumilla: SYLLABUS_SECTION.SUMILLA,
    competencies: SYLLABUS_SECTION.COMPETENCIAS,
    components: SYLLABUS_SECTION.COMPETENCIAS,
    attitudes: SYLLABUS_SECTION.COMPETENCIAS,
    unidades: SYLLABUS_SECTION.PROGRAMACION,
    programacion: SYLLABUS_SECTION.PROGRAMACION,
    estrategias_metodologicas: SYLLABUS_SECTION.ESTRATEGIAS,
    estrategias: SYLLABUS_SECTION.ESTRATEGIAS,
    recursos_didacticos_notas: SYLLABUS_SECTION.RECURSOS,
    recursos_didacticos: SYLLABUS_SECTION.RECURSOS,
    recursos: SYLLABUS_SECTION.RECURSOS,
    formula_evaluacion: SYLLABUS_SECTION.EVALUACION,
    formula: SYLLABUS_SECTION.EVALUACION,
    fuentes: SYLLABUS_SECTION.FUENTES,
    contribution: SYLLABUS_SECTION.APORTES,
    aportes: SYLLABUS_SECTION.APORTES,
  };

  return map[key] ?? null;
}

export type CurriculumCourse = {
  codigo: string;
  nombre: string;
  ciclo: number | null;
  creditos: number;
  horasTeoria: number;
  horasPractica: number;
  modalidad: string;
  prerrequisitos: string[];
  aliases?: string[];
};

export function normalizeCourseName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Malla curricular estática (sin tablas nuevas). */
export const curriculumCourses: CurriculumCourse[] = [
  {
    codigo: "09013707051",
    nombre: "INGENIERÍA DE SOFTWARE I",
    ciclo: 6,
    creditos: 4,
    horasTeoria: 3,
    horasPractica: 2,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["GESTIÓN DE PROCESOS"],
  },
  {
    codigo: "09013707052",
    nombre: "INGENIERÍA DE SOFTWARE II",
    ciclo: 7,
    creditos: 5,
    horasTeoria: 3,
    horasPractica: 4,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["INGENIERÍA DE SOFTWARE I"],
    aliases: ["INGENIERIA DE SOFTWARE 2", "INGENIERÍA DE SOFTWARE 2"],
  },
  {
    codigo: "09112108051",
    nombre: "TALLER DE PROYECTOS",
    ciclo: 8,
    creditos: 5,
    horasTeoria: 0,
    horasPractica: 10,
    modalidad: "VIRTUAL",
    prerrequisitos: ["INGENIERÍA DE SOFTWARE II", "INTELIGENCIA ARTIFICIAL"],
    aliases: ["TALLER DE PROYECTO", "TALLER PROYECTO", "TALLER PROYECTOS"],
  },
  {
    codigo: "09072108042",
    nombre: "DISEÑO E IMPLEMENTACIÓN DE SISTEMAS",
    ciclo: 8,
    creditos: 4,
    horasTeoria: 3,
    horasPractica: 2,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["INGENIERÍA DE SOFTWARE II"],
    aliases: ["DISEÑO E IMPLEMENTACION DE SISTEMAS"],
  },
  {
    codigo: "09066408042",
    nombre: "GESTIÓN DE RECURSOS DE TECNOLOGÍAS DE INFORMACIÓN",
    ciclo: 8,
    creditos: 4,
    horasTeoria: 4,
    horasPractica: 0,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["INGENIERÍA DE SOFTWARE II"],
  },
  {
    codigo: "09013707040",
    nombre: "GESTIÓN DE PROCESOS",
    ciclo: 5,
    creditos: 4,
    horasTeoria: 3,
    horasPractica: 2,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["TECNOLOGÍA DE INFORMACIÓN II"],
  },
  {
    codigo: "09013707030",
    nombre: "TECNOLOGÍA DE INFORMACIÓN II",
    ciclo: 4,
    creditos: 4,
    horasTeoria: 2,
    horasPractica: 3,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["TECNOLOGÍA DE INFORMACIÓN I"],
    aliases: [
      "TECNOLOGIA DE INFORMACION II",
      "TECNOLOGÍA DE LA INFORMACIÓN II",
    ],
  },
  {
    codigo: "09013707020",
    nombre: "TECNOLOGÍA DE INFORMACIÓN I",
    ciclo: 3,
    creditos: 4,
    horasTeoria: 2,
    horasPractica: 3,
    modalidad: "PRESENCIAL",
    prerrequisitos: ["INTRODUCCIÓN A LA PROGRAMACIÓN"],
  },
  {
    codigo: "09013707010",
    nombre: "INTRODUCCIÓN A LA PROGRAMACIÓN",
    ciclo: 2,
    creditos: 4,
    horasTeoria: 2,
    horasPractica: 3,
    modalidad: "PRESENCIAL",
    prerrequisitos: [],
  },
  {
    codigo: "ELEC001",
    nombre: "ELECTIVO LIBRE",
    ciclo: null,
    creditos: 0,
    horasTeoria: 0,
    horasPractica: 0,
    modalidad: "PRESENCIAL",
    prerrequisitos: [],
  },
  {
    codigo: "ELEC002",
    nombre: "ELECTIVO DE ESPECIALIDAD",
    ciclo: null,
    creditos: 0,
    horasTeoria: 0,
    horasPractica: 0,
    modalidad: "PRESENCIAL",
    prerrequisitos: [],
  },
];

export function getCourseComparableNames(course: CurriculumCourse) {
  return [course.nombre, ...(course.aliases ?? [])]
    .map(normalizeCourseName)
    .filter(Boolean);
}

export function findCurriculumCourseByName(name: string) {
  const normalized = normalizeCourseName(name);

  return (
    curriculumCourses.find((course) =>
      getCourseComparableNames(course).includes(normalized),
    ) ?? null
  );
}

export function getCurriculumAnteriores(course: CurriculumCourse): string[] {
  return course.prerrequisitos.slice(-2);
}

export function getCurriculumPosteriores(course: CurriculumCourse): string[] {
  const currentNames = getCourseComparableNames(course);

  return curriculumCourses
    .filter((item) =>
      item.prerrequisitos.some((prerrequisito) =>
        currentNames.includes(normalizeCourseName(prerrequisito)),
      ),
    )
    .map((item) => item.nombre)
    .slice(0, 2);
}

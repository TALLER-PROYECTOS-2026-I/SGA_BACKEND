import {
  pgTable,
  index,
  foreignKey,
  unique,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  check,
  varchar,
  text,
  smallint,
  date,
  json,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const silaboSeccionPermiso = pgTable(
  "silabo_seccion_permiso",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    docenteId: integer("docente_id").notNull(),
    numeroSeccion: integer("numero_seccion").notNull(),
    puedeEditar: boolean("puede_editar").default(false).notNull(),
    puedeComentar: boolean("puede_comentar").default(true).notNull(),
    fechaLimite: timestamp("fecha_limite", { mode: "string" }),
    bloqueadoPorEstado: boolean("bloqueado_por_estado")
      .default(false)
      .notNull(),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_permiso_seccion").using(
      "btree",
      table.numeroSeccion.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_permiso_silabo_docente").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.docenteId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.docenteId],
      foreignColumns: [docente.id],
      name: "silabo_seccion_permiso_docente_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_seccion_permiso_silabo_id_fkey",
    }).onDelete("cascade"),
    unique("uq_permiso_silabo_docente_seccion").on(
      table.silaboId,
      table.docenteId,
      table.numeroSeccion,
    ),
  ],
);

export const docente = pgTable(
  "docente",
  {
    id: serial().primaryKey().notNull(),
    correo: varchar().notNull(),
    categoriaUsuarioId: integer("categoria_usuario_id").notNull(),
    activo: boolean().default(true),
    azureAdObjectId: varchar("azure_ad_object_id"),
    tenantId: varchar("tenant_id"),
    ultimoAccesoEn: timestamp("ultimo_acceso_en", { mode: "string" }),
    gradoAcademico: varchar("grado_academico"),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
    nombreDocente: varchar("nombre_docente", { length: 100 }),
    gradoAcademicoId: integer("grado_academico_id"),
    numeroCelular: varchar("numero_celular", { length: 9 })
      .default("999999999")
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_docente_correo").using(
      "btree",
      sql`lower(btrim((correo)::text))`,
    ),
    foreignKey({
      columns: [table.categoriaUsuarioId],
      foreignColumns: [categoriaUsuario.id],
      name: "docente_categoria_usuario_id_fkey",
    }),
    foreignKey({
      columns: [table.gradoAcademicoId],
      foreignColumns: [gradoAcademicoCatalogo.id],
      name: "docente_grado_academico_id_fkey",
    }),
    unique("docente_correo_key").on(table.correo),
    unique("uq_docente_numero_celular").on(table.numeroCelular),
    check(
      "ck_docente_numero_celular_9dig",
      sql`(numero_celular)::text ~ '^[9][0-9]{8}$'::text`,
    ),
  ],
);

export const silaboUnidad = pgTable(
  "silabo_unidad",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    numero: integer().notNull(),
    titulo: varchar().notNull(),
    capacidadesText: text("capacidades_text"),
    contenidosConceptuales: text("contenidos_conceptuales"),
    contenidosProcedimentales: text("contenidos_procedimentales"),
    actividadesAprendizaje: text("actividades_aprendizaje"),
    horasLectivasTeoria: integer("horas_lectivas_teoria"),
    horasLectivasPractica: integer("horas_lectivas_practica"),
    horasNoLectivasTeoria: integer("horas_no_lectivas_teoria"),
    horasNoLectivasPractica: integer("horas_no_lectivas_practica"),
  },
  (table) => [
    uniqueIndex("uq_silabo_unidad").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.numero.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_unidad_silabo_id_fkey",
    }),
    unique("silabo_unidad_silabo_numero_uk").on(table.silaboId, table.numero),
  ],
);

export const categoriaUsuario = pgTable(
  "categoria_usuario",
  {
    id: serial().primaryKey().notNull(),
    nombreCategoria: varchar("nombre_categoria").notNull(),
    descripcion: text(),
    activo: boolean().default(true),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
  },
  (table) => [
    unique("categoria_usuario_nombre_categoria_key").on(table.nombreCategoria),
  ],
);

export const funcionAplicacion = pgTable(
  "funcion_aplicacion",
  {
    id: serial().primaryKey().notNull(),
    codigo: varchar().notNull(),
    nombrePublico: varchar("nombre_publico"),
    descripcion: text(),
    modulo: varchar(),
    activo: boolean().default(true),
  },
  (table) => [unique("funcion_aplicacion_nombre_funcion_key").on(table.codigo)],
);

export const silaboDocente = pgTable(
  "silabo_docente",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    docenteId: integer("docente_id").notNull(),
    observaciones: text(),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
    rol: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.docenteId],
      foreignColumns: [docente.id],
      name: "silabo_docente_docente_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_docente_silabo_id_fkey",
    }),
    unique("silabo_docente_unq").on(table.silaboId, table.docenteId),
    unique("uq_silabo_docente_silabo_docente").on(
      table.silaboId,
      table.docenteId,
    ),
    unique("uq_silabo_docente").on(table.silaboId, table.docenteId, table.rol),
  ],
);

export const silaboUnidadBackup = pgTable("silabo_unidad_backup", {
  id: integer(),
  silaboId: integer("silabo_id"),
  numero: integer(),
  titulo: varchar(),
  capacidadesText: text("capacidades_text"),
  contenidosConceptuales: text("contenidos_conceptuales"),
  contenidosProcedimentales: text("contenidos_procedimentales"),
  actividadesAprendizaje: text("actividades_aprendizaje"),
  horasLectivasTeoria: integer("horas_lectivas_teoria"),
  horasLectivasPractica: integer("horas_lectivas_practica"),
  horasNoLectivasTeoria: integer("horas_no_lectivas_teoria"),
  horasNoLectivasPractica: integer("horas_no_lectivas_practica"),
  contenidosConceptualesSemana: text("contenidos_conceptuales_semana"),
  contenidosProcedimentalesSemana: text("contenidos_procedimentales_semana"),
  actividadesAprendizajeSemana: text("actividades_aprendizaje_semana"),
  horasLectivasTeoriaSemanaArr: smallint("horas_lectivas_teoria_semana_arr"),
  horasLectivasPracticaSemanaArr: smallint(
    "horas_lectivas_practica_semana_arr",
  ),
  horasNoLectivasTeoriaSemanaArr: smallint(
    "horas_no_lectivas_teoria_semana_arr",
  ),
  horasNoLectivasPracticaSemanaArr: smallint(
    "horas_no_lectivas_practica_semana_arr",
  ),
});

export const silabo = pgTable(
  "silabo",
  {
    id: serial().primaryKey().notNull(),
    departamentoAcademico: varchar("departamento_academico"),
    escuelaProfesional: varchar("escuela_profesional"),
    programaAcademico: varchar("programa_academico"),
    areaCurricular: varchar("area_curricular"),
    cursoCodigo: varchar("curso_codigo"),
    cursoNombre: varchar("curso_nombre"),
    semestreAcademico: varchar("semestre_academico"),
    tipoAsignatura: varchar("tipo_asignatura"),
    tipoDeEstudios: varchar("tipo_de_estudios"),
    modalidadDeAsignatura: varchar("modalidad_de_asignatura"),
    formatoDeCurso: varchar("formato_de_curso"),
    ciclo: varchar(),
    requisitos: text(),
    horasTeoria: integer("horas_teoria"),
    horasPractica: integer("horas_practica"),
    horasLaboratorio: integer("horas_laboratorio"),
    horasTeoriaLectivaPresencial: integer("horas_teoria_lectiva_presencial"),
    horasTeoriaLectivaDistancia: integer("horas_teoria_lectiva_distancia"),
    horasTeoriaNoLectivaPresencial: integer(
      "horas_teoria_no_lectiva_presencial",
    ),
    horasTeoriaNoLectivaDistancia: integer("horas_teoria_no_lectiva_distancia"),
    horasPracticaLectivaPresencial: integer(
      "horas_practica_lectiva_presencial",
    ),
    horasPracticaLectivaDistancia: integer("horas_practica_lectiva_distancia"),
    horasPracticaNoLectivaPresencial: integer(
      "horas_practica_no_lectiva_presencial",
    ),
    horasPracticaNoLectivaDistancia: integer(
      "horas_practica_no_lectiva_distancia",
    ),
    creditosTeoria: integer("creditos_teoria"),
    creditosPractica: integer("creditos_practica"),
    estrategiasMetodologicas: text("estrategias_metodologicas"),
    recursosDidacticosNotas: text("recursos_didacticos_notas"),
    politicas: text(),
    observaciones: text(),
    estadoRevision: varchar("estado_revision").default("ASIGNADO").notNull(),
    asignadoADocenteId: integer("asignado_a_docente_id"),
    creadoPorDocenteId: integer("creado_por_docente_id"),
    actualizadoPorDocenteId: integer("actualizado_por_docente_id"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
    horasTotales: integer("horas_totales"),
    creditosTotales: integer("creditos_totales"),
  },
  (table) => [
    index("idx_silabo_estado").using(
      "btree",
      table.estadoRevision.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("uq_silabo_curso_sem_prog").using(
      "btree",
      sql`btrim((curso_codigo)::text)`,
      sql`btrim((semestre_academico)::text)`,
      sql`btrim((programa_academico)::text)`,
    ),
    foreignKey({
      columns: [table.actualizadoPorDocenteId],
      foreignColumns: [docente.id],
      name: "silabo_actualizado_por_docente_id_fkey",
    }),
    foreignKey({
      columns: [table.asignadoADocenteId],
      foreignColumns: [docente.id],
      name: "silabo_asignado_a_docente_id_fkey",
    }),
    foreignKey({
      columns: [table.creadoPorDocenteId],
      foreignColumns: [docente.id],
      name: "silabo_creado_por_docente_id_fkey",
    }),
  ],
);

export const formulaEvaluacionSubformula = pgTable(
  "formula_evaluacion_subformula",
  {
    id: serial().primaryKey().notNull(),
    formulaEvaluacionReglaId: integer("formula_evaluacion_regla_id").notNull(),
    variableCodigo: varchar("variable_codigo").notNull(),
    expresion: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.formulaEvaluacionReglaId],
      foreignColumns: [formulaEvaluacionRegla.id],
      name: "formula_evaluacion_subformula_formula_evaluacion_regla_id_fkey",
    }),
    unique("formula_evaluacion_subformula_unq").on(
      table.formulaEvaluacionReglaId,
      table.variableCodigo,
    ),
    unique("uq_subformula_regla_var").on(
      table.formulaEvaluacionReglaId,
      table.variableCodigo,
    ),
    unique("formula_subf_uk").on(
      table.formulaEvaluacionReglaId,
      table.variableCodigo,
    ),
  ],
);

export const gradoAcademicoCatalogo = pgTable(
  "grado_academico_catalogo",
  {
    id: serial().primaryKey().notNull(),
    codigo: varchar().notNull(),
    nombre: varchar().notNull(),
    abreviatura: varchar(),
    activo: boolean().default(true),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
  },
  (table) => [unique("grado_academico_catalogo_codigo_key").on(table.codigo)],
);

export const formulaEvaluacionVariable = pgTable(
  "formula_evaluacion_variable",
  {
    id: serial().primaryKey().notNull(),
    formulaEvaluacionReglaId: integer("formula_evaluacion_regla_id").notNull(),
    codigo: varchar().notNull(),
    nombre: varchar().notNull(),
    tipo: varchar().notNull(),
    descripcion: text(),
    orden: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.formulaEvaluacionReglaId],
      foreignColumns: [formulaEvaluacionRegla.id],
      name: "formula_evaluacion_variable_formula_evaluacion_regla_id_fkey",
    }),
    unique("formula_evaluacion_variable_unq").on(
      table.formulaEvaluacionReglaId,
      table.codigo,
    ),
    unique("uq_variable_regla_codigo").on(
      table.formulaEvaluacionReglaId,
      table.codigo,
    ),
  ],
);

export const silaboUnidadSemana = pgTable(
  "silabo_unidad_semana",
  {
    id: serial().primaryKey().notNull(),
    silaboUnidadId: integer("silabo_unidad_id").notNull(),
    semana: smallint().notNull(),
    contenidosConceptuales: text("contenidos_conceptuales"),
    contenidosProcedimentales: text("contenidos_procedimentales"),
    actividadesAprendizaje: text("actividades_aprendizaje"),
    horasLectivasTeoria: integer("horas_lectivas_teoria").default(0),
    horasLectivasPractica: integer("horas_lectivas_practica").default(0),
    horasNoLectivasTeoria: integer("horas_no_lectivas_teoria").default(0),
    horasNoLectivasPractica: integer("horas_no_lectivas_practica").default(0),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_silabo_unidad_semana_semana").using(
      "btree",
      table.semana.asc().nullsLast().op("int2_ops"),
    ),
    index("idx_silabo_unidad_semana_unidad_id").using(
      "btree",
      table.silaboUnidadId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.silaboUnidadId],
      foreignColumns: [silaboUnidad.id],
      name: "fk_silabo_unidad",
    }).onDelete("cascade"),
    unique("silabo_unidad_semana_uk").on(table.silaboUnidadId, table.semana),
    check(
      "silabo_unidad_semana_semana_check",
      sql`(semana >= 1) AND (semana <= 16)`,
    ),
  ],
);

export const formulaEvaluacionVariablePlan = pgTable(
  "formula_evaluacion_variable_plan",
  {
    id: serial().primaryKey().notNull(),
    formulaEvaluacionReglaId: integer("formula_evaluacion_regla_id").notNull(),
    variableCodigo: varchar("variable_codigo").notNull(),
    planEvaluacionOfertaId: integer("plan_evaluacion_oferta_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.formulaEvaluacionReglaId],
      foreignColumns: [formulaEvaluacionRegla.id],
      name: "formula_evaluacion_variable_pl_formula_evaluacion_regla_id_fkey",
    }),
    foreignKey({
      columns: [table.planEvaluacionOfertaId],
      foreignColumns: [planEvaluacionOferta.id],
      name: "formula_evaluacion_variable_plan_plan_evaluacion_oferta_id_fkey",
    }),
    unique("formula_evaluacion_variable_plan_unq").on(
      table.formulaEvaluacionReglaId,
      table.variableCodigo,
      table.planEvaluacionOfertaId,
    ),
    unique("uq_var_plan_regla_var_plan").on(
      table.formulaEvaluacionReglaId,
      table.variableCodigo,
      table.planEvaluacionOfertaId,
    ),
  ],
);

export const planEvaluacionOferta = pgTable(
  "plan_evaluacion_oferta",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    componenteNombre: varchar("componente_nombre").notNull(),
    instrumentoNombre: varchar("instrumento_nombre"),
    semana: integer(),
    fecha: date(),
    instrucciones: text(),
    rubricaUrl: varchar("rubrica_url"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_plan_eval_silabo_componente").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.componenteNombre.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "plan_evaluacion_oferta_silabo_id_fkey",
    }),
    unique("plan_evaluacion_oferta_unq").on(
      table.silaboId,
      table.componenteNombre,
      table.semana,
    ),
    unique("uq_plan_eval_silabo_comp_semana").on(
      table.silaboId,
      table.componenteNombre,
      table.semana,
    ),
  ],
);

export const silaboCompetenciaComponente = pgTable(
  "silabo_competencia_componente",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    grupo: varchar().notNull(),
    codigo: varchar(),
    descripcion: text().notNull(),
    competenciaCodigoRelacionada: varchar("competencia_codigo_relacionada"),
    orden: integer(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_competencia_componente_silabo_id_fkey",
    }),
  ],
);

export const recursoDidacticoCatalogo = pgTable(
  "recurso_didactico_catalogo",
  {
    id: serial().primaryKey().notNull(),
    codigo: varchar().notNull(),
    nombre: varchar().notNull(),
    descripcion: text(),
    activo: boolean().default(true),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
  },
  (table) => [unique("recurso_didactico_catalogo_codigo_key").on(table.codigo)],
);

export const silaboCompetenciaCurso = pgTable(
  "silabo_competencia_curso",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    codigo: varchar(),
    descripcion: text().notNull(),
    referenciaProgramaCodigo: varchar("referencia_programa_codigo"),
    orden: integer(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_competencia_curso_silabo_id_fkey",
    }),
  ],
);

export const silaboFuente = pgTable(
  "silabo_fuente",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    tipo: varchar().notNull(),
    autores: varchar(),
    anio: integer(),
    titulo: text(),
    editorialRevista: varchar("editorial_revista"),
    ciudad: varchar(),
    isbnIssn: varchar("isbn_issn"),
    doiUrl: varchar("doi_url"),
    notas: text(),
  },
  (table) => [
    uniqueIndex("uq_silabo_fuente").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.titulo.asc().nullsLast().op("text_ops"),
      table.anio.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_fuente_silabo_id_fkey",
    }),
  ],
);

export const formulaEvaluacionRegla = pgTable(
  "formula_evaluacion_regla",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    nombreRegla: varchar("nombre_regla").notNull(),
    variableFinalCodigo: varchar("variable_final_codigo").notNull(),
    expresionFinal: text("expresion_final").notNull(),
    descripcion: text(),
    version: integer().default(1),
    activo: boolean().default(true),
    lenguaje: varchar().default("INFIX"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "formula_evaluacion_regla_silabo_id_fkey",
    }),
    unique("formula_evaluacion_regla_unq").on(
      table.silaboId,
      table.nombreRegla,
      table.version,
    ),
    unique("uq_regla_silabo_nombre_version").on(
      table.silaboId,
      table.nombreRegla,
      table.version,
    ),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: serial().primaryKey().notNull(),
    tabla: varchar().notNull(),
    registroPk: varchar("registro_pk").notNull(),
    accion: varchar().notNull(),
    descripcion: text(),
    docenteId: integer("docente_id"),
    ipOrigen: varchar("ip_origen"),
    userAgent: varchar("user_agent"),
    oldValues: json("old_values"),
    newValues: json("new_values"),
    silaboId: integer("silabo_id"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_audit_event_accion").using(
      "btree",
      table.accion.asc().nullsLast().op("text_ops"),
    ),
    index("idx_audit_event_docente").using(
      "btree",
      table.docenteId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_audit_event_fecha").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_audit_event_silabo").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_audit_event_tabla_pk").using(
      "btree",
      table.tabla.asc().nullsLast().op("text_ops"),
      table.registroPk.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.docenteId],
      foreignColumns: [docente.id],
      name: "audit_event_docente_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "audit_event_silabo_id_fkey",
    }),
  ],
);

export const evaluacionAprendizaje = pgTable(
  "evaluacion_aprendizaje",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    fechaCreacion: timestamp("fecha_creacion", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
    formulaReglaId: integer("formula_regla_id").notNull(),
  },
  (table) => [
    index("idx_ea_silabo_id").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_evaluacion_aprendizaje_silabo").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.formulaReglaId],
      foreignColumns: [formulaEvaluacionRegla.id],
      name: "evaluacion_aprendizaje_formula_regla_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "evaluacion_aprendizaje_silabo_id_fkey",
    }),
  ],
);

export const silaboRecursoDidactico = pgTable(
  "silabo_recurso_didactico",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    recursoId: integer("recurso_id").notNull(),
    silaboUnidadId: integer("silabo_unidad_id"),
    destino: varchar(),
    urlReferencia: varchar("url_referencia"),
    observaciones: text(),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { mode: "string" }).defaultNow(),
    claveUnica: text("clave_unica").generatedAlwaysAs(
      sql`(((((((silabo_id)::text || '-'::text) || (recurso_id)::text) || '-'::text) || COALESCE((silabo_unidad_id)::text, '0'::text)) || '-'::text) || (COALESCE(destino, ''::character varying))::text)`,
    ),
  },
  (table) => [
    index("idx_silabo_recurso").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.recursoId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.recursoId],
      foreignColumns: [recursoDidacticoCatalogo.id],
      name: "silabo_recurso_didactico_recurso_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_recurso_didactico_silabo_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboUnidadId],
      foreignColumns: [silaboUnidad.id],
      name: "silabo_recurso_didactico_silabo_unidad_id_fkey",
    }),
    unique("uq_recurso_por_silabo").on(table.silaboId, table.recursoId),
    unique("uq_silabo_recurso").on(table.claveUnica),
  ],
);

export const silaboResultadoAprendizaje = pgTable(
  "silabo_resultado_aprendizaje",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    descripcion: text().notNull(),
    orden: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_resultado_aprendizaje_curso_silabo_id_fkey",
    }),
    unique("silabo_ra_uk").on(table.silaboId, table.orden),
  ],
);

export const silaboRevisionComentario = pgTable(
  "silabo_revision_comentario",
  {
    id: serial().primaryKey().notNull(),
    silaboRevisionSeccionId: integer("silabo_revision_seccion_id").notNull(),
    autorId: integer("autor_id"),
    mensaje: text().notNull(),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
    leido: boolean().default(false),
  },
  (table) => [
    index("idx_rev_com_autor").using(
      "btree",
      table.autorId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_rev_com_seccion").using(
      "btree",
      table.silaboRevisionSeccionId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.autorId],
      foreignColumns: [docente.id],
      name: "silabo_revision_comentario_autor_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.silaboRevisionSeccionId],
      foreignColumns: [silaboRevisionSeccion.id],
      name: "silabo_revision_comentario_silabo_revision_seccion_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const silaboRevisionHistorial = pgTable(
  "silabo_revision_historial",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    revisorId: integer("revisor_id").notNull(),
    accion: varchar().notNull(),
    descripcion: text(),
    creadoEn: timestamp("creado_en", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_rev_hist_accion").using(
      "btree",
      table.accion.asc().nullsLast().op("text_ops"),
    ),
    index("idx_rev_hist_fecha").using(
      "btree",
      table.creadoEn.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_rev_hist_revisor").using(
      "btree",
      table.revisorId.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_rev_hist_silabo").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.revisorId],
      foreignColumns: [docente.id],
      name: "silabo_revision_historial_revisor_id_fkey",
    }),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_revision_historial_silabo_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const silaboRevisionSeccion = pgTable(
  "silabo_revision_seccion",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    numeroSeccion: integer("numero_seccion").notNull(),
    nombreSeccion: varchar("nombre_seccion").notNull(),
    estado: varchar().default("PENDIENTE").notNull(),
    revisadoPor: integer("revisado_por"),
    revisadoEn: timestamp("revisado_en", { mode: "string" }).defaultNow(),
    comentariosCount: integer("comentarios_count").default(0),
  },
  (table) => [
    index("idx_rev_estado").using(
      "btree",
      table.estado.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("uq_silabo_rev_seccion").using(
      "btree",
      table.silaboId.asc().nullsLast().op("int4_ops"),
      table.numeroSeccion.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.revisadoPor],
      foreignColumns: [docente.id],
      name: "silabo_revision_seccion_revisado_por_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_revision_seccion_silabo_id_fkey",
    }).onDelete("cascade"),
    unique("uq_rev_seccion_silabo_num").on(table.silaboId, table.numeroSeccion),
  ],
);

export const silaboSumilla = pgTable(
  "silabo_sumilla",
  {
    id: serial().primaryKey().notNull(),
    silaboId: integer("silabo_id").notNull(),
    contenido: text().notNull(),
    palabrasClave: text("palabras_clave"),
    version: integer().default(1),
    esActual: boolean("es_actual").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_sumilla_silabo_id_fkey",
    }),
    unique("silabo_sumilla_unq").on(table.silaboId, table.version),
    unique("uq_silabo_sumilla_silabo_version").on(
      table.silaboId,
      table.version,
    ),
  ],
);

export const categoriaFuncion = pgTable(
  "categoria_funcion",
  {
    categoriaUsuarioId: integer("categoria_usuario_id").notNull(),
    funcionAplicacionId: integer("funcion_aplicacion_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoriaUsuarioId],
      foreignColumns: [categoriaUsuario.id],
      name: "categoria_funcion_acceso_categoria_usuario_id_fkey",
    }),
    foreignKey({
      columns: [table.funcionAplicacionId],
      foreignColumns: [funcionAplicacion.id],
      name: "categoria_funcion_acceso_funcion_aplicacion_id_fkey",
    }),
    primaryKey({
      columns: [table.categoriaUsuarioId, table.funcionAplicacionId],
      name: "categoria_funcion_acceso_pk",
    }),
  ],
);

export const silaboAporteResultadoPrograma = pgTable(
  "silabo_aporte_resultado_programa",
  {
    silaboId: integer("silabo_id").notNull(),
    resultadoProgramaCodigo: varchar("resultado_programa_codigo").notNull(),
    resultadoProgramaDescripcion: text("resultado_programa_descripcion"),
    aporteValor: varchar("aporte_valor"),
  },
  (table) => [
    foreignKey({
      columns: [table.silaboId],
      foreignColumns: [silabo.id],
      name: "silabo_aporte_resultado_programa_silabo_id_fkey",
    }),
    primaryKey({
      columns: [table.silaboId, table.resultadoProgramaCodigo],
      name: "silabo_aporte_resultado_programa_pk",
    }),
  ],
);

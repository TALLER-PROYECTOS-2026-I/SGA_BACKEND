import { relations } from "drizzle-orm/relations";
import {
  docente,
  silaboSeccionPermiso,
  silabo,
  categoriaUsuario,
  gradoAcademicoCatalogo,
  silaboUnidad,
  silaboDocente,
  formulaEvaluacionRegla,
  formulaEvaluacionSubformula,
  formulaEvaluacionVariable,
  silaboUnidadSemana,
  silaboContenidoConceptual,
  formulaEvaluacionVariablePlan,
  planEvaluacionOferta,
  silaboCompetenciaComponente,
  silaboCompetenciaCurso,
  silaboFuente,
  auditEvent,
  evaluacionAprendizaje,
  recursoDidacticoCatalogo,
  silaboRecursoDidactico,
  silaboResultadoAprendizaje,
  silaboRevisionComentario,
  silaboRevisionSeccion,
  silaboRevisionHistorial,
  silaboSumilla,
  categoriaFuncion,
  funcionAplicacion,
  silaboAporteResultadoPrograma,
} from "./schema";

export const silaboSeccionPermisoRelations = relations(
  silaboSeccionPermiso,
  ({ one }) => ({
    docente: one(docente, {
      fields: [silaboSeccionPermiso.docenteId],
      references: [docente.id],
    }),
    silabo: one(silabo, {
      fields: [silaboSeccionPermiso.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const docenteRelations = relations(docente, ({ one, many }) => ({
  silaboSeccionPermisos: many(silaboSeccionPermiso),
  categoriaUsuario: one(categoriaUsuario, {
    fields: [docente.categoriaUsuarioId],
    references: [categoriaUsuario.id],
  }),
  gradoAcademicoCatalogo: one(gradoAcademicoCatalogo, {
    fields: [docente.gradoAcademicoId],
    references: [gradoAcademicoCatalogo.id],
  }),
  silaboDocentes: many(silaboDocente),
  silabos_actualizadoPorDocenteId: many(silabo, {
    relationName: "silabo_actualizadoPorDocenteId_docente_id",
  }),
  silabos_asignadoADocenteId: many(silabo, {
    relationName: "silabo_asignadoADocenteId_docente_id",
  }),
  silabos_creadoPorDocenteId: many(silabo, {
    relationName: "silabo_creadoPorDocenteId_docente_id",
  }),
  auditEvents: many(auditEvent),
  silaboRevisionComentarios: many(silaboRevisionComentario),
  silaboRevisionHistorials: many(silaboRevisionHistorial),
  silaboRevisionSeccions: many(silaboRevisionSeccion),
}));

export const silaboRelations = relations(silabo, ({ one, many }) => ({
  silaboSeccionPermisos: many(silaboSeccionPermiso),
  silaboUnidads: many(silaboUnidad),
  silaboDocentes: many(silaboDocente),
  docente_actualizadoPorDocenteId: one(docente, {
    fields: [silabo.actualizadoPorDocenteId],
    references: [docente.id],
    relationName: "silabo_actualizadoPorDocenteId_docente_id",
  }),
  docente_asignadoADocenteId: one(docente, {
    fields: [silabo.asignadoADocenteId],
    references: [docente.id],
    relationName: "silabo_asignadoADocenteId_docente_id",
  }),
  docente_creadoPorDocenteId: one(docente, {
    fields: [silabo.creadoPorDocenteId],
    references: [docente.id],
    relationName: "silabo_creadoPorDocenteId_docente_id",
  }),
  planEvaluacionOfertas: many(planEvaluacionOferta),
  silaboCompetenciaComponentes: many(silaboCompetenciaComponente),
  silaboCompetenciaCursos: many(silaboCompetenciaCurso),
  silaboFuentes: many(silaboFuente),
  formulaEvaluacionReglas: many(formulaEvaluacionRegla),
  auditEvents: many(auditEvent),
  evaluacionAprendizajes: many(evaluacionAprendizaje),
  silaboRecursoDidacticos: many(silaboRecursoDidactico),
  silaboResultadoAprendizajes: many(silaboResultadoAprendizaje),
  silaboRevisionHistorials: many(silaboRevisionHistorial),
  silaboRevisionSeccions: many(silaboRevisionSeccion),
  silaboSumillas: many(silaboSumilla),
  silaboAporteResultadoProgramas: many(silaboAporteResultadoPrograma),
}));

export const categoriaUsuarioRelations = relations(
  categoriaUsuario,
  ({ many }) => ({
    docentes: many(docente),
    categoriaFuncions: many(categoriaFuncion),
  }),
);

export const gradoAcademicoCatalogoRelations = relations(
  gradoAcademicoCatalogo,
  ({ many }) => ({
    docentes: many(docente),
  }),
);

export const silaboUnidadRelations = relations(
  silaboUnidad,
  ({ one, many }) => ({
    silabo: one(silabo, {
      fields: [silaboUnidad.silaboId],
      references: [silabo.id],
    }),
    silaboUnidadSemanas: many(silaboUnidadSemana),
    silaboRecursoDidacticos: many(silaboRecursoDidactico),
  }),
);

export const silaboDocenteRelations = relations(silaboDocente, ({ one }) => ({
  docente: one(docente, {
    fields: [silaboDocente.docenteId],
    references: [docente.id],
  }),
  silabo: one(silabo, {
    fields: [silaboDocente.silaboId],
    references: [silabo.id],
  }),
}));

export const formulaEvaluacionSubformulaRelations = relations(
  formulaEvaluacionSubformula,
  ({ one }) => ({
    formulaEvaluacionRegla: one(formulaEvaluacionRegla, {
      fields: [formulaEvaluacionSubformula.formulaEvaluacionReglaId],
      references: [formulaEvaluacionRegla.id],
    }),
  }),
);

export const formulaEvaluacionReglaRelations = relations(
  formulaEvaluacionRegla,
  ({ one, many }) => ({
    formulaEvaluacionSubformulas: many(formulaEvaluacionSubformula),
    formulaEvaluacionVariables: many(formulaEvaluacionVariable),
    formulaEvaluacionVariablePlans: many(formulaEvaluacionVariablePlan),
    silabo: one(silabo, {
      fields: [formulaEvaluacionRegla.silaboId],
      references: [silabo.id],
    }),
    evaluacionAprendizajes: many(evaluacionAprendizaje),
  }),
);

export const formulaEvaluacionVariableRelations = relations(
  formulaEvaluacionVariable,
  ({ one }) => ({
    formulaEvaluacionRegla: one(formulaEvaluacionRegla, {
      fields: [formulaEvaluacionVariable.formulaEvaluacionReglaId],
      references: [formulaEvaluacionRegla.id],
    }),
  }),
);

export const silaboUnidadSemanaRelations = relations(
  silaboUnidadSemana,
  ({ one }) => ({
    silaboUnidad: one(silaboUnidad, {
      fields: [silaboUnidadSemana.silaboUnidadId],
      references: [silaboUnidad.id],
    }),
  }),
);

export const silaboContenidoConceptualRelations = relations(
  silaboContenidoConceptual,
  ({ one }) => ({
    silaboUnidadSemana: one(silaboUnidadSemana, {
      fields: [silaboContenidoConceptual.silaboUnidadSemanaId],
      references: [silaboUnidadSemana.id],
    }),
    creadoPorDocente: one(docente, {
      fields: [silaboContenidoConceptual.creadoPorDocenteId],
      references: [docente.id],
      relationName: "contenido_conceptual_creado_por_docente_id",
    }),
    actualizadoPorDocente: one(docente, {
      fields: [silaboContenidoConceptual.actualizadoPorDocenteId],
      references: [docente.id],
      relationName: "contenido_conceptual_actualizado_por_docente_id",
    }),
  }),
);

export const formulaEvaluacionVariablePlanRelations = relations(
  formulaEvaluacionVariablePlan,
  ({ one }) => ({
    formulaEvaluacionRegla: one(formulaEvaluacionRegla, {
      fields: [formulaEvaluacionVariablePlan.formulaEvaluacionReglaId],
      references: [formulaEvaluacionRegla.id],
    }),
    planEvaluacionOferta: one(planEvaluacionOferta, {
      fields: [formulaEvaluacionVariablePlan.planEvaluacionOfertaId],
      references: [planEvaluacionOferta.id],
    }),
  }),
);

export const planEvaluacionOfertaRelations = relations(
  planEvaluacionOferta,
  ({ one, many }) => ({
    formulaEvaluacionVariablePlans: many(formulaEvaluacionVariablePlan),
    silabo: one(silabo, {
      fields: [planEvaluacionOferta.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboCompetenciaComponenteRelations = relations(
  silaboCompetenciaComponente,
  ({ one }) => ({
    silabo: one(silabo, {
      fields: [silaboCompetenciaComponente.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboCompetenciaCursoRelations = relations(
  silaboCompetenciaCurso,
  ({ one }) => ({
    silabo: one(silabo, {
      fields: [silaboCompetenciaCurso.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboFuenteRelations = relations(silaboFuente, ({ one }) => ({
  silabo: one(silabo, {
    fields: [silaboFuente.silaboId],
    references: [silabo.id],
  }),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
  docente: one(docente, {
    fields: [auditEvent.docenteId],
    references: [docente.id],
  }),
  silabo: one(silabo, {
    fields: [auditEvent.silaboId],
    references: [silabo.id],
  }),
}));

export const evaluacionAprendizajeRelations = relations(
  evaluacionAprendizaje,
  ({ one }) => ({
    formulaEvaluacionRegla: one(formulaEvaluacionRegla, {
      fields: [evaluacionAprendizaje.formulaReglaId],
      references: [formulaEvaluacionRegla.id],
    }),
    silabo: one(silabo, {
      fields: [evaluacionAprendizaje.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboRecursoDidacticoRelations = relations(
  silaboRecursoDidactico,
  ({ one }) => ({
    recursoDidacticoCatalogo: one(recursoDidacticoCatalogo, {
      fields: [silaboRecursoDidactico.recursoId],
      references: [recursoDidacticoCatalogo.id],
    }),
    silabo: one(silabo, {
      fields: [silaboRecursoDidactico.silaboId],
      references: [silabo.id],
    }),
    silaboUnidad: one(silaboUnidad, {
      fields: [silaboRecursoDidactico.silaboUnidadId],
      references: [silaboUnidad.id],
    }),
  }),
);

export const recursoDidacticoCatalogoRelations = relations(
  recursoDidacticoCatalogo,
  ({ many }) => ({
    silaboRecursoDidacticos: many(silaboRecursoDidactico),
  }),
);

export const silaboResultadoAprendizajeRelations = relations(
  silaboResultadoAprendizaje,
  ({ one }) => ({
    silabo: one(silabo, {
      fields: [silaboResultadoAprendizaje.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboRevisionComentarioRelations = relations(
  silaboRevisionComentario,
  ({ one }) => ({
    docente: one(docente, {
      fields: [silaboRevisionComentario.autorId],
      references: [docente.id],
    }),
    silaboRevisionSeccion: one(silaboRevisionSeccion, {
      fields: [silaboRevisionComentario.silaboRevisionSeccionId],
      references: [silaboRevisionSeccion.id],
    }),
  }),
);

export const silaboRevisionSeccionRelations = relations(
  silaboRevisionSeccion,
  ({ one, many }) => ({
    silaboRevisionComentarios: many(silaboRevisionComentario),
    docente: one(docente, {
      fields: [silaboRevisionSeccion.revisadoPor],
      references: [docente.id],
    }),
    silabo: one(silabo, {
      fields: [silaboRevisionSeccion.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboRevisionHistorialRelations = relations(
  silaboRevisionHistorial,
  ({ one }) => ({
    docente: one(docente, {
      fields: [silaboRevisionHistorial.revisorId],
      references: [docente.id],
    }),
    silabo: one(silabo, {
      fields: [silaboRevisionHistorial.silaboId],
      references: [silabo.id],
    }),
  }),
);

export const silaboSumillaRelations = relations(silaboSumilla, ({ one }) => ({
  silabo: one(silabo, {
    fields: [silaboSumilla.silaboId],
    references: [silabo.id],
  }),
}));

export const categoriaFuncionRelations = relations(
  categoriaFuncion,
  ({ one }) => ({
    categoriaUsuario: one(categoriaUsuario, {
      fields: [categoriaFuncion.categoriaUsuarioId],
      references: [categoriaUsuario.id],
    }),
    funcionAplicacion: one(funcionAplicacion, {
      fields: [categoriaFuncion.funcionAplicacionId],
      references: [funcionAplicacion.id],
    }),
  }),
);

export const funcionAplicacionRelations = relations(
  funcionAplicacion,
  ({ many }) => ({
    categoriaFuncions: many(categoriaFuncion),
  }),
);

export const silaboAporteResultadoProgramaRelations = relations(
  silaboAporteResultadoPrograma,
  ({ one }) => ({
    silabo: one(silabo, {
      fields: [silaboAporteResultadoPrograma.silaboId],
      references: [silabo.id],
    }),
  }),
);

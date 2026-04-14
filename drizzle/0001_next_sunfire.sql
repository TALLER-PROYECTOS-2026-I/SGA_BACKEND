CREATE TABLE "audit_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"tabla" varchar NOT NULL,
	"registro_pk" varchar NOT NULL,
	"accion" varchar NOT NULL,
	"descripcion" text,
	"docente_id" integer,
	"ip_origen" varchar,
	"user_agent" varchar,
	"old_values" json,
	"new_values" json,
	"silabo_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categoria_funcion" (
	"categoria_usuario_id" integer NOT NULL,
	"funcion_aplicacion_id" integer NOT NULL,
	CONSTRAINT "categoria_funcion_acceso_pk" PRIMARY KEY("categoria_usuario_id","funcion_aplicacion_id")
);
--> statement-breakpoint
CREATE TABLE "docente" (
	"id" serial PRIMARY KEY NOT NULL,
	"correo" varchar NOT NULL,
	"categoria_usuario_id" integer NOT NULL,
	"activo" boolean DEFAULT true,
	"azure_ad_object_id" varchar,
	"tenant_id" varchar,
	"ultimo_acceso_en" timestamp,
	"grado_academico" varchar,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	"nombre_docente" varchar(100),
	"grado_academico_id" integer,
	"numero_celular" varchar(9) DEFAULT '999999999' NOT NULL,
	CONSTRAINT "docente_correo_key" UNIQUE("correo"),
	CONSTRAINT "uq_docente_numero_celular" UNIQUE("numero_celular"),
	CONSTRAINT "ck_docente_numero_celular_9dig" CHECK ((numero_celular)::text ~ '^[9][0-9]{8}$'::text)
);
--> statement-breakpoint
CREATE TABLE "evaluacion_aprendizaje" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"fecha_creacion" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"formula_regla_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formula_evaluacion_regla" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"nombre_regla" varchar NOT NULL,
	"variable_final_codigo" varchar NOT NULL,
	"expresion_final" text NOT NULL,
	"descripcion" text,
	"version" integer DEFAULT 1,
	"activo" boolean DEFAULT true,
	"lenguaje" varchar DEFAULT 'INFIX',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "formula_evaluacion_regla_unq" UNIQUE("silabo_id","nombre_regla","version"),
	CONSTRAINT "uq_regla_silabo_nombre_version" UNIQUE("silabo_id","nombre_regla","version")
);
--> statement-breakpoint
CREATE TABLE "formula_evaluacion_subformula" (
	"id" serial PRIMARY KEY NOT NULL,
	"formula_evaluacion_regla_id" integer NOT NULL,
	"variable_codigo" varchar NOT NULL,
	"expresion" text NOT NULL,
	CONSTRAINT "formula_evaluacion_subformula_unq" UNIQUE("formula_evaluacion_regla_id","variable_codigo"),
	CONSTRAINT "uq_subformula_regla_var" UNIQUE("formula_evaluacion_regla_id","variable_codigo"),
	CONSTRAINT "formula_subf_uk" UNIQUE("formula_evaluacion_regla_id","variable_codigo")
);
--> statement-breakpoint
CREATE TABLE "formula_evaluacion_variable" (
	"id" serial PRIMARY KEY NOT NULL,
	"formula_evaluacion_regla_id" integer NOT NULL,
	"codigo" varchar NOT NULL,
	"nombre" varchar NOT NULL,
	"tipo" varchar NOT NULL,
	"descripcion" text,
	"orden" integer,
	CONSTRAINT "formula_evaluacion_variable_unq" UNIQUE("formula_evaluacion_regla_id","codigo"),
	CONSTRAINT "uq_variable_regla_codigo" UNIQUE("formula_evaluacion_regla_id","codigo")
);
--> statement-breakpoint
CREATE TABLE "formula_evaluacion_variable_plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"formula_evaluacion_regla_id" integer NOT NULL,
	"variable_codigo" varchar NOT NULL,
	"plan_evaluacion_oferta_id" integer NOT NULL,
	CONSTRAINT "formula_evaluacion_variable_plan_unq" UNIQUE("formula_evaluacion_regla_id","variable_codigo","plan_evaluacion_oferta_id"),
	CONSTRAINT "uq_var_plan_regla_var_plan" UNIQUE("formula_evaluacion_regla_id","variable_codigo","plan_evaluacion_oferta_id")
);
--> statement-breakpoint
CREATE TABLE "grado_academico_catalogo" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar NOT NULL,
	"nombre" varchar NOT NULL,
	"abreviatura" varchar,
	"activo" boolean DEFAULT true,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	CONSTRAINT "grado_academico_catalogo_codigo_key" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "plan_evaluacion_oferta" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"componente_nombre" varchar NOT NULL,
	"instrumento_nombre" varchar,
	"semana" integer,
	"fecha" date,
	"instrucciones" text,
	"rubrica_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plan_evaluacion_oferta_unq" UNIQUE("silabo_id","componente_nombre","semana"),
	CONSTRAINT "uq_plan_eval_silabo_comp_semana" UNIQUE("silabo_id","componente_nombre","semana")
);
--> statement-breakpoint
CREATE TABLE "recurso_didactico_catalogo" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar NOT NULL,
	"nombre" varchar NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	CONSTRAINT "recurso_didactico_catalogo_codigo_key" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "silabo_competencia_componente" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"grupo" varchar NOT NULL,
	"codigo" varchar,
	"descripcion" text NOT NULL,
	"competencia_codigo_relacionada" varchar,
	"orden" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "silabo_competencia_curso" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"codigo" varchar,
	"descripcion" text NOT NULL,
	"referencia_programa_codigo" varchar,
	"orden" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "silabo_docente" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"docente_id" integer NOT NULL,
	"observaciones" text,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	"rol" varchar NOT NULL,
	CONSTRAINT "silabo_docente_unq" UNIQUE("silabo_id","docente_id"),
	CONSTRAINT "uq_silabo_docente_silabo_docente" UNIQUE("silabo_id","docente_id"),
	CONSTRAINT "uq_silabo_docente" UNIQUE("silabo_id","docente_id","rol")
);
--> statement-breakpoint
CREATE TABLE "silabo_recurso_didactico" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"recurso_id" integer NOT NULL,
	"silabo_unidad_id" integer,
	"destino" varchar,
	"url_referencia" varchar,
	"observaciones" text,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	"clave_unica" text GENERATED ALWAYS AS ((((((((silabo_id)::text || '-'::text) || (recurso_id)::text) || '-'::text) || COALESCE((silabo_unidad_id)::text, '0'::text)) || '-'::text) || (COALESCE(destino, ''::character varying))::text)) STORED,
	CONSTRAINT "uq_recurso_por_silabo" UNIQUE("silabo_id","recurso_id"),
	CONSTRAINT "uq_silabo_recurso" UNIQUE("clave_unica")
);
--> statement-breakpoint
CREATE TABLE "silabo_resultado_aprendizaje" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"descripcion" text NOT NULL,
	"orden" integer,
	CONSTRAINT "silabo_ra_uk" UNIQUE("silabo_id","orden")
);
--> statement-breakpoint
CREATE TABLE "silabo_revision_comentario" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_revision_seccion_id" integer NOT NULL,
	"autor_id" integer,
	"mensaje" text NOT NULL,
	"creado_en" timestamp DEFAULT now(),
	"leido" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "silabo_revision_historial" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"revisor_id" integer NOT NULL,
	"accion" varchar NOT NULL,
	"descripcion" text,
	"creado_en" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "silabo_revision_seccion" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"numero_seccion" integer NOT NULL,
	"nombre_seccion" varchar NOT NULL,
	"estado" varchar DEFAULT 'PENDIENTE' NOT NULL,
	"revisado_por" integer,
	"revisado_en" timestamp DEFAULT now(),
	"comentarios_count" integer DEFAULT 0,
	CONSTRAINT "uq_rev_seccion_silabo_num" UNIQUE("silabo_id","numero_seccion")
);
--> statement-breakpoint
CREATE TABLE "silabo_seccion_permiso" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"docente_id" integer NOT NULL,
	"numero_seccion" integer NOT NULL,
	"puede_editar" boolean DEFAULT false NOT NULL,
	"puede_comentar" boolean DEFAULT true NOT NULL,
	"fecha_limite" timestamp,
	"bloqueado_por_estado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_permiso_silabo_docente_seccion" UNIQUE("silabo_id","docente_id","numero_seccion")
);
--> statement-breakpoint
CREATE TABLE "silabo_sumilla" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"contenido" text NOT NULL,
	"palabras_clave" text,
	"version" integer DEFAULT 1,
	"es_actual" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "silabo_sumilla_unq" UNIQUE("silabo_id","version"),
	CONSTRAINT "uq_silabo_sumilla_silabo_version" UNIQUE("silabo_id","version")
);
--> statement-breakpoint
CREATE TABLE "silabo_unidad_backup" (
	"id" integer,
	"silabo_id" integer,
	"numero" integer,
	"titulo" varchar,
	"capacidades_text" text,
	"contenidos_conceptuales" text,
	"contenidos_procedimentales" text,
	"actividades_aprendizaje" text,
	"horas_lectivas_teoria" integer,
	"horas_lectivas_practica" integer,
	"horas_no_lectivas_teoria" integer,
	"horas_no_lectivas_practica" integer,
	"contenidos_conceptuales_semana" text,
	"contenidos_procedimentales_semana" text,
	"actividades_aprendizaje_semana" text,
	"horas_lectivas_teoria_semana_arr" smallint,
	"horas_lectivas_practica_semana_arr" smallint,
	"horas_no_lectivas_teoria_semana_arr" smallint,
	"horas_no_lectivas_practica_semana_arr" smallint
);
--> statement-breakpoint
ALTER TABLE "silabo_unidad_contenido" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "silabo_evaluacion" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "silabo_resultado_aprendizaje_curso" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario_autorizado" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categoria_funcion_acceso" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "silabo_unidad_contenido" CASCADE;--> statement-breakpoint
DROP TABLE "silabo_evaluacion" CASCADE;--> statement-breakpoint
DROP TABLE "silabo_resultado_aprendizaje_curso" CASCADE;--> statement-breakpoint
DROP TABLE "usuario_autorizado" CASCADE;--> statement-breakpoint
DROP TABLE "categoria_funcion_acceso" CASCADE;--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" DROP CONSTRAINT "funcion_aplicacion_nombre_funcion_key";--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" DROP CONSTRAINT "silabo_unidad_semana_silabo_unidad_id_fkey";
--> statement-breakpoint
ALTER TABLE "silabo" DROP CONSTRAINT "silabo_actualizado_por_usuario_autorizado_id_fkey";
--> statement-breakpoint
ALTER TABLE "silabo" DROP CONSTRAINT "silabo_asignado_a_usuario_autorizado_id_fkey";
--> statement-breakpoint
ALTER TABLE "silabo" DROP CONSTRAINT "silabo_creado_por_usuario_autorizado_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_semana_unidad";--> statement-breakpoint
DROP INDEX "idx_fuente_silabo";--> statement-breakpoint
DROP INDEX "idx_silabo_actualizado";--> statement-breakpoint
DROP INDEX "idx_silabo_asignado";--> statement-breakpoint
DROP INDEX "idx_silabo_creado_por";--> statement-breakpoint
DROP INDEX "idx_unidad_silabo";--> statement-breakpoint
ALTER TABLE "silabo_aporte_resultado_programa" DROP CONSTRAINT "silabo_aporte_resultado_programa_pkey";--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ALTER COLUMN "semana" SET DATA TYPE smallint;--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ALTER COLUMN "horas_lectivas_teoria" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ALTER COLUMN "horas_lectivas_practica" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ALTER COLUMN "horas_no_lectivas_teoria" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ALTER COLUMN "horas_no_lectivas_practica" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "silabo_aporte_resultado_programa" ALTER COLUMN "aporte_valor" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "silabo_aporte_resultado_programa" ADD CONSTRAINT "silabo_aporte_resultado_programa_pk" PRIMARY KEY("silabo_id","resultado_programa_codigo");--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD COLUMN "creado_en" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD COLUMN "actualizado_en" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" ADD COLUMN "codigo" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" ADD COLUMN "nombre_publico" varchar;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "recursos_didacticos_notas" text;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "estado_revision" varchar DEFAULT 'ASIGNADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "asignado_a_docente_id" integer;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "creado_por_docente_id" integer;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "actualizado_por_docente_id" integer;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "horasTotales" integer;--> statement-breakpoint
ALTER TABLE "silabo" ADD COLUMN "creditosTotales" integer;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "contenidos_conceptuales" text;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "contenidos_procedimentales" text;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "actividades_aprendizaje" text;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "horas_lectivas_teoria" integer;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "horas_lectivas_practica" integer;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "horas_no_lectivas_teoria" integer;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD COLUMN "horas_no_lectivas_practica" integer;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria_funcion" ADD CONSTRAINT "categoria_funcion_acceso_categoria_usuario_id_fkey" FOREIGN KEY ("categoria_usuario_id") REFERENCES "public"."categoria_usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria_funcion" ADD CONSTRAINT "categoria_funcion_acceso_funcion_aplicacion_id_fkey" FOREIGN KEY ("funcion_aplicacion_id") REFERENCES "public"."funcion_aplicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docente" ADD CONSTRAINT "docente_categoria_usuario_id_fkey" FOREIGN KEY ("categoria_usuario_id") REFERENCES "public"."categoria_usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docente" ADD CONSTRAINT "docente_grado_academico_id_fkey" FOREIGN KEY ("grado_academico_id") REFERENCES "public"."grado_academico_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluacion_aprendizaje" ADD CONSTRAINT "evaluacion_aprendizaje_formula_regla_id_fkey" FOREIGN KEY ("formula_regla_id") REFERENCES "public"."formula_evaluacion_regla"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluacion_aprendizaje" ADD CONSTRAINT "evaluacion_aprendizaje_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_evaluacion_regla" ADD CONSTRAINT "formula_evaluacion_regla_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_evaluacion_subformula" ADD CONSTRAINT "formula_evaluacion_subformula_formula_evaluacion_regla_id_fkey" FOREIGN KEY ("formula_evaluacion_regla_id") REFERENCES "public"."formula_evaluacion_regla"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_evaluacion_variable" ADD CONSTRAINT "formula_evaluacion_variable_formula_evaluacion_regla_id_fkey" FOREIGN KEY ("formula_evaluacion_regla_id") REFERENCES "public"."formula_evaluacion_regla"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_evaluacion_variable_plan" ADD CONSTRAINT "formula_evaluacion_variable_pl_formula_evaluacion_regla_id_fkey" FOREIGN KEY ("formula_evaluacion_regla_id") REFERENCES "public"."formula_evaluacion_regla"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formula_evaluacion_variable_plan" ADD CONSTRAINT "formula_evaluacion_variable_plan_plan_evaluacion_oferta_id_fkey" FOREIGN KEY ("plan_evaluacion_oferta_id") REFERENCES "public"."plan_evaluacion_oferta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_evaluacion_oferta" ADD CONSTRAINT "plan_evaluacion_oferta_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_competencia_componente" ADD CONSTRAINT "silabo_competencia_componente_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_competencia_curso" ADD CONSTRAINT "silabo_competencia_curso_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_docente" ADD CONSTRAINT "silabo_docente_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_docente" ADD CONSTRAINT "silabo_docente_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_recurso_didactico" ADD CONSTRAINT "silabo_recurso_didactico_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "public"."recurso_didactico_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_recurso_didactico" ADD CONSTRAINT "silabo_recurso_didactico_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_recurso_didactico" ADD CONSTRAINT "silabo_recurso_didactico_silabo_unidad_id_fkey" FOREIGN KEY ("silabo_unidad_id") REFERENCES "public"."silabo_unidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_resultado_aprendizaje" ADD CONSTRAINT "silabo_resultado_aprendizaje_curso_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_comentario" ADD CONSTRAINT "silabo_revision_comentario_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."docente"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_comentario" ADD CONSTRAINT "silabo_revision_comentario_silabo_revision_seccion_id_fkey" FOREIGN KEY ("silabo_revision_seccion_id") REFERENCES "public"."silabo_revision_seccion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_historial" ADD CONSTRAINT "silabo_revision_historial_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_historial" ADD CONSTRAINT "silabo_revision_historial_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_seccion" ADD CONSTRAINT "silabo_revision_seccion_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "public"."docente"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_revision_seccion" ADD CONSTRAINT "silabo_revision_seccion_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_seccion_permiso" ADD CONSTRAINT "silabo_seccion_permiso_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "public"."docente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_seccion_permiso" ADD CONSTRAINT "silabo_seccion_permiso_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_sumilla" ADD CONSTRAINT "silabo_sumilla_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_event_accion" ON "audit_event" USING btree ("accion" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_event_docente" ON "audit_event" USING btree ("docente_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_event_fecha" ON "audit_event" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_event_silabo" ON "audit_event" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_event_tabla_pk" ON "audit_event" USING btree ("tabla" text_ops,"registro_pk" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docente_correo" ON "docente" USING btree (lower(btrim((correo)::text)));--> statement-breakpoint
CREATE INDEX "idx_ea_silabo_id" ON "evaluacion_aprendizaje" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_evaluacion_aprendizaje_silabo" ON "evaluacion_aprendizaje" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_eval_silabo_componente" ON "plan_evaluacion_oferta" USING btree ("silabo_id" text_ops,"componente_nombre" text_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_recurso" ON "silabo_recurso_didactico" USING btree ("silabo_id" int4_ops,"recurso_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_com_autor" ON "silabo_revision_comentario" USING btree ("autor_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_com_seccion" ON "silabo_revision_comentario" USING btree ("silabo_revision_seccion_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_hist_accion" ON "silabo_revision_historial" USING btree ("accion" text_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_hist_fecha" ON "silabo_revision_historial" USING btree ("creado_en" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_hist_revisor" ON "silabo_revision_historial" USING btree ("revisor_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_hist_silabo" ON "silabo_revision_historial" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rev_estado" ON "silabo_revision_seccion" USING btree ("estado" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_silabo_rev_seccion" ON "silabo_revision_seccion" USING btree ("silabo_id" int4_ops,"numero_seccion" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_permiso_seccion" ON "silabo_seccion_permiso" USING btree ("numero_seccion" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_permiso_silabo_docente" ON "silabo_seccion_permiso" USING btree ("silabo_id" int4_ops,"docente_id" int4_ops);--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD CONSTRAINT "fk_silabo_unidad" FOREIGN KEY ("silabo_unidad_id") REFERENCES "public"."silabo_unidad"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_actualizado_por_docente_id_fkey" FOREIGN KEY ("actualizado_por_docente_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_asignado_a_docente_id_fkey" FOREIGN KEY ("asignado_a_docente_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_creado_por_docente_id_fkey" FOREIGN KEY ("creado_por_docente_id") REFERENCES "public"."docente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_silabo_unidad_semana_semana" ON "silabo_unidad_semana" USING btree ("semana" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_unidad_semana_unidad_id" ON "silabo_unidad_semana" USING btree ("silabo_unidad_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_silabo_fuente" ON "silabo_fuente" USING btree ("silabo_id" int4_ops,"titulo" text_ops,"anio" text_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_estado" ON "silabo" USING btree ("estado_revision" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_silabo_curso_sem_prog" ON "silabo" USING btree (btrim((curso_codigo)::text),btrim((semestre_academico)::text),btrim((programa_academico)::text));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_silabo_unidad" ON "silabo_unidad" USING btree ("silabo_id" int4_ops,"numero" int4_ops);--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" DROP COLUMN "nombre_funcion";--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" DROP COLUMN "titulo_visible";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "horas_totales";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "creditos_totales";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "docentes_text";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "sumilla";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "recursos_didacticos";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "asignado_a_usuario_autorizado_id";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "creado_por_usuario_autorizado_id";--> statement-breakpoint
ALTER TABLE "silabo" DROP COLUMN "actualizado_por_usuario_autorizado_id";--> statement-breakpoint
ALTER TABLE "silabo_unidad" DROP COLUMN "semana_inicio";--> statement-breakpoint
ALTER TABLE "silabo_unidad" DROP COLUMN "semana_fin";--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD CONSTRAINT "silabo_unidad_semana_uk" UNIQUE("silabo_unidad_id","semana");--> statement-breakpoint
ALTER TABLE "funcion_aplicacion" ADD CONSTRAINT "funcion_aplicacion_nombre_funcion_key" UNIQUE("codigo");--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD CONSTRAINT "silabo_unidad_silabo_numero_uk" UNIQUE("silabo_id","numero");--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD CONSTRAINT "silabo_unidad_semana_semana_check" CHECK ((semana >= 1) AND (semana <= 16));--> statement-breakpoint
DROP TYPE "public"."aporte_enum";
-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations

CREATE TYPE "public"."aporte_enum" AS ENUM('K', 'R');--> statement-breakpoint
CREATE TABLE "silabo_unidad_contenido" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_unidad_id" integer NOT NULL,
	"tipo" varchar,
	"descripcion" text NOT NULL,
	"orden" integer
);
--> statement-breakpoint
CREATE TABLE "silabo_unidad_semana" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_unidad_id" integer NOT NULL,
	"semana" integer NOT NULL,
	"contenidos_conceptuales" text,
	"contenidos_procedimentales" text,
	"actividades_aprendizaje" text,
	"horas_lectivas_teoria" integer,
	"horas_lectivas_practica" integer,
	"horas_no_lectivas_teoria" integer,
	"horas_no_lectivas_practica" integer
);
--> statement-breakpoint
CREATE TABLE "silabo_evaluacion" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"componente_nombre" varchar,
	"descripcion" text,
	"instrumento_nombre" varchar,
	"criterios" text,
	"ponderacion" numeric(5, 2),
	"semana" integer,
	"minimo_aprobatorio" boolean
);
--> statement-breakpoint
CREATE TABLE "silabo_fuente" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"tipo" varchar NOT NULL,
	"autores" varchar,
	"anio" integer,
	"titulo" text,
	"editorial_revista" varchar,
	"ciudad" varchar,
	"isbn_issn" varchar,
	"doi_url" varchar,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "categoria_usuario" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_categoria" varchar NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	CONSTRAINT "categoria_usuario_nombre_categoria_key" UNIQUE("nombre_categoria")
);
--> statement-breakpoint
CREATE TABLE "funcion_aplicacion" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_funcion" varchar NOT NULL,
	"titulo_visible" varchar,
	"descripcion" text,
	"modulo" varchar,
	"activo" boolean DEFAULT true,
	CONSTRAINT "funcion_aplicacion_nombre_funcion_key" UNIQUE("nombre_funcion")
);
--> statement-breakpoint
CREATE TABLE "silabo" (
	"id" serial PRIMARY KEY NOT NULL,
	"departamento_academico" varchar,
	"escuela_profesional" varchar,
	"programa_academico" varchar,
	"area_curricular" varchar,
	"curso_codigo" varchar,
	"curso_nombre" varchar,
	"semestre_academico" varchar,
	"tipo_asignatura" varchar,
	"tipo_de_estudios" varchar,
	"modalidad_de_asignatura" varchar,
	"formato_de_curso" varchar,
	"ciclo" varchar,
	"requisitos" text,
	"horas_teoria" integer,
	"horas_practica" integer,
	"horas_laboratorio" integer,
	"horas_totales" integer,
	"horas_teoria_lectiva_presencial" integer,
	"horas_teoria_lectiva_distancia" integer,
	"horas_teoria_no_lectiva_presencial" integer,
	"horas_teoria_no_lectiva_distancia" integer,
	"horas_practica_lectiva_presencial" integer,
	"horas_practica_lectiva_distancia" integer,
	"horas_practica_no_lectiva_presencial" integer,
	"horas_practica_no_lectiva_distancia" integer,
	"creditos_teoria" integer,
	"creditos_practica" integer,
	"creditos_totales" integer,
	"docentes_text" text,
	"sumilla" text,
	"estrategias_metodologicas" text,
	"recursos_didacticos" text,
	"politicas" text,
	"observaciones" text,
	"asignado_a_usuario_autorizado_id" integer,
	"creado_por_usuario_autorizado_id" integer,
	"actualizado_por_usuario_autorizado_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "silabo_resultado_aprendizaje_curso" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"descripcion" text NOT NULL,
	"orden" integer
);
--> statement-breakpoint
CREATE TABLE "usuario_autorizado" (
	"id" serial PRIMARY KEY NOT NULL,
	"correo" varchar NOT NULL,
	"categoria_usuario_id" integer NOT NULL,
	"activo" boolean DEFAULT true,
	"azure_ad_object_id" varchar,
	"tenant_id" varchar,
	"ultimo_acceso_en" timestamp,
	"creado_en" timestamp DEFAULT now(),
	"actualizado_en" timestamp DEFAULT now(),
	CONSTRAINT "usuario_autorizado_correo_key" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "silabo_unidad" (
	"id" serial PRIMARY KEY NOT NULL,
	"silabo_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"titulo" varchar NOT NULL,
	"capacidades_text" text,
	"semana_inicio" integer,
	"semana_fin" integer
);
--> statement-breakpoint
CREATE TABLE "categoria_funcion_acceso" (
	"categoria_usuario_id" integer NOT NULL,
	"funcion_aplicacion_id" integer NOT NULL,
	CONSTRAINT "categoria_funcion_acceso_pkey" PRIMARY KEY("categoria_usuario_id","funcion_aplicacion_id")
);
--> statement-breakpoint
CREATE TABLE "silabo_aporte_resultado_programa" (
	"silabo_id" integer NOT NULL,
	"resultado_programa_codigo" varchar NOT NULL,
	"resultado_programa_descripcion" text,
	"aporte_valor" "aporte_enum",
	CONSTRAINT "silabo_aporte_resultado_programa_pkey" PRIMARY KEY("silabo_id","resultado_programa_codigo")
);
--> statement-breakpoint
ALTER TABLE "silabo_unidad_contenido" ADD CONSTRAINT "silabo_unidad_contenido_silabo_unidad_id_fkey" FOREIGN KEY ("silabo_unidad_id") REFERENCES "public"."silabo_unidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_unidad_semana" ADD CONSTRAINT "silabo_unidad_semana_silabo_unidad_id_fkey" FOREIGN KEY ("silabo_unidad_id") REFERENCES "public"."silabo_unidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_evaluacion" ADD CONSTRAINT "silabo_evaluacion_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_fuente" ADD CONSTRAINT "silabo_fuente_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_actualizado_por_usuario_autorizado_id_fkey" FOREIGN KEY ("actualizado_por_usuario_autorizado_id") REFERENCES "public"."usuario_autorizado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_asignado_a_usuario_autorizado_id_fkey" FOREIGN KEY ("asignado_a_usuario_autorizado_id") REFERENCES "public"."usuario_autorizado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo" ADD CONSTRAINT "silabo_creado_por_usuario_autorizado_id_fkey" FOREIGN KEY ("creado_por_usuario_autorizado_id") REFERENCES "public"."usuario_autorizado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_resultado_aprendizaje_curso" ADD CONSTRAINT "silabo_resultado_aprendizaje_curso_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_autorizado" ADD CONSTRAINT "usuario_autorizado_categoria_usuario_id_fkey" FOREIGN KEY ("categoria_usuario_id") REFERENCES "public"."categoria_usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_unidad" ADD CONSTRAINT "silabo_unidad_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria_funcion_acceso" ADD CONSTRAINT "categoria_funcion_acceso_categoria_usuario_id_fkey" FOREIGN KEY ("categoria_usuario_id") REFERENCES "public"."categoria_usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categoria_funcion_acceso" ADD CONSTRAINT "categoria_funcion_acceso_funcion_aplicacion_id_fkey" FOREIGN KEY ("funcion_aplicacion_id") REFERENCES "public"."funcion_aplicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silabo_aporte_resultado_programa" ADD CONSTRAINT "silabo_aporte_resultado_programa_silabo_id_fkey" FOREIGN KEY ("silabo_id") REFERENCES "public"."silabo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contenido_unidad" ON "silabo_unidad_contenido" USING btree ("silabo_unidad_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_semana_unidad" ON "silabo_unidad_semana" USING btree ("silabo_unidad_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_eval_silabo" ON "silabo_evaluacion" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_fuente_silabo" ON "silabo_fuente" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_actualizado" ON "silabo" USING btree ("actualizado_por_usuario_autorizado_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_asignado" ON "silabo" USING btree ("asignado_a_usuario_autorizado_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_silabo_creado_por" ON "silabo" USING btree ("creado_por_usuario_autorizado_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_ra_curso_silabo" ON "silabo_resultado_aprendizaje_curso" USING btree ("silabo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_unidad_silabo" ON "silabo_unidad" USING btree ("silabo_id" int4_ops);

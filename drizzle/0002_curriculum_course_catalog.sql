CREATE TABLE IF NOT EXISTS "curriculum_course_catalog" (
  "id" serial PRIMARY KEY NOT NULL,
  "periodo" varchar NOT NULL,
  "codigo" varchar NOT NULL,
  "nombre" varchar NOT NULL,
  "ciclo" integer,
  "creditos" integer DEFAULT 0 NOT NULL,
  "horas_teoria" integer DEFAULT 0 NOT NULL,
  "horas_practica" integer DEFAULT 0 NOT NULL,
  "modalidad" varchar DEFAULT 'PRESENCIAL' NOT NULL,
  "tipo_curso" varchar,
  "area_curricular" varchar,
  "prerrequisitos" json,
  "activo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "uq_curriculum_course_periodo_codigo" UNIQUE("periodo", "codigo")
);

CREATE INDEX IF NOT EXISTS "idx_curriculum_course_periodo"
ON "curriculum_course_catalog" ("periodo");

CREATE INDEX IF NOT EXISTS "idx_curriculum_course_ciclo"
ON "curriculum_course_catalog" ("ciclo");

CREATE INDEX IF NOT EXISTS "idx_curriculum_course_activo"
ON "curriculum_course_catalog" ("activo");
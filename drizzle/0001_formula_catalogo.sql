CREATE TABLE IF NOT EXISTS "formula_catalogo" (
  "id" serial PRIMARY KEY NOT NULL,
  "tipo" varchar NOT NULL,
  "nombre" varchar NOT NULL,
  "expresion" text NOT NULL,
  "descripcion" text,
  "variables_json" json,
  "subformulas_json" json,
  "activo" boolean DEFAULT true NOT NULL,
  "creado_por_docente_id" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "formula_catalogo_creado_por_docente_id_fkey"
    FOREIGN KEY ("creado_por_docente_id") REFERENCES "docente"("id"),
  CONSTRAINT "formula_catalogo_tipo_check"
    CHECK ((tipo)::text IN ('PE', 'PF'))
);

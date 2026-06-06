CREATE TABLE IF NOT EXISTS "syllabus_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "syllabus_id" integer NOT NULL,
  "version_number" integer NOT NULL,
  "snapshot_json" json NOT NULL,
  "status" varchar,
  "modified_by" integer,
  "modified_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "syllabus_versions_modified_by_fkey"
    FOREIGN KEY ("modified_by") REFERENCES "docente"("id") ON DELETE SET NULL,
  CONSTRAINT "syllabus_versions_syllabus_id_fkey"
    FOREIGN KEY ("syllabus_id") REFERENCES "silabo"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_syllabus_versions_syllabus_number"
    UNIQUE ("syllabus_id", "version_number")
);

CREATE INDEX IF NOT EXISTS "idx_syllabus_versions_syllabus"
  ON "syllabus_versions" USING btree ("syllabus_id");

CREATE INDEX IF NOT EXISTS "idx_syllabus_versions_modified_at"
  ON "syllabus_versions" USING btree ("modified_at");

INSERT INTO "categoria_usuario" (
  "id",
  "nombre_categoria",
  "descripcion",
  "activo"
)
VALUES (
  5,
  'comite_curricular_operativo',
  'Comité Curricular Operativo',
  true
)
ON CONFLICT ("nombre_categoria") DO UPDATE
SET
  "descripcion" = EXCLUDED."descripcion",
  "activo" = true,
  "actualizado_en" = now();

SELECT setval(
  pg_get_serial_sequence('"categoria_usuario"', 'id'),
  GREATEST(
    COALESCE((SELECT MAX("id") FROM "categoria_usuario"), 1),
    5
  ),
  true
);

-- =====================================================================
-- VARIABLES DE CONTACTO EN SECUENCIAS DE CORREOS
-- ---------------------------------------------------------------------
-- Hasta ahora el flujo solo transportaba empresa/ciudad/gancho y las
-- plantillas solo resolvían {{empresa}}/{{ciudad}}/{{gancho}}.
-- Este cambio agrega:
--   * nombre  : nombre de la persona de contacto (fallback a empresa).
--   * datos   : jsonb con TODAS las columnas que traiga el sheet/HTML
--               (web, telefono, whatsapp, instagram, region, score...).
-- El cron resuelve {{cualquier_columna}} desde esas columnas + datos.
-- =====================================================================

ALTER TABLE public.secuencia_envios_programados
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS datos   jsonb;

COMMENT ON COLUMN public.secuencia_envios_programados.nombre IS
  'Nombre de la persona de contacto (si el sheet lo trae). {{nombre}} cae a empresa si está vacío.';
COMMENT ON COLUMN public.secuencia_envios_programados.datos IS
  'Bolsa de variables: todas las columnas del sheet/HTML (web, telefono, whatsapp, instagram, region, score...). Se resuelven como {{columna}}.';

COMMENT ON COLUMN public.secuencias_correo_pasos.cuerpo IS
  'Cuerpo del correo con variables {{empresa}}, {{ciudad}}, {{gancho}}, {{nombre}} o cualquier columna del sheet ({{web}}, {{telefono}}, ...).';

-- ---------- Saludos de las plantillas seed con {{nombre}} ----------
-- {{nombre}} cae al nombre de la empresa si el sheet no trae persona de contacto.
UPDATE public.secuencias_correo_pasos
SET cuerpo = regexp_replace(
  cuerpo,
  'Hola equipo de \{\{empresa\}\},',
  'Hola {{nombre}},')
WHERE secuencia_id IN ('a1111111-0000-4000-8000-000000000003', 'a1111111-0000-4000-8000-000000000005')
  AND paso = 1;

UPDATE public.secuencias_correo_pasos
SET cuerpo = regexp_replace(
  cuerpo,
  'Hola de nuevo, \{\{empresa\}\},',
  'Hola de nuevo, {{nombre}}')
WHERE secuencia_id IN ('a1111111-0000-4000-8000-000000000003', 'a1111111-0000-4000-8000-000000000005')
  AND paso = 2;

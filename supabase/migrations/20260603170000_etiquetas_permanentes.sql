-- ============================================================
-- Etiquetas permanentes (2026-06-03)
-- Objetivo: dejar SOLO 5 etiquetas fijas que no se pueden borrar
-- ni renombrar, para clasificar leads de forma consistente.
--
-- Decisiones (confirmadas por Mario):
--   * "Empezar limpio": al final solo existen estas 5 etiquetas.
--   * "Migrar equivalentes": los leads con una etiqueta vieja
--     equivalente conservan su clasificación bajo el nombre nuevo.
--     Los leads con "Seguimiento" o "a la espera de agendamiento
--     (interesado)" quedan sin etiqueta (esas etiquetas se eliminan).
--
-- Idempotente: re-ejecutar produce el mismo resultado final.
-- ============================================================

-- 1. Columna que marca una etiqueta como permanente (protegida)
ALTER TABLE public.lead_tags
  ADD COLUMN IF NOT EXISTS es_permanente boolean NOT NULL DEFAULT false;

-- 2. Crear / asegurar las 5 etiquetas permanentes.
--    nombre es UNIQUE, así que el upsert es seguro y repetible.
INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('No interesa',              '#cc0000', true),
  ('Agente asignado',         '#16a34a', true),
  ('Pendiente asignar agente','#ea580c', true),
  ('Solo quiere propiedades', '#0284c7', true),
  ('Cita agendada',           '#7c3aed', true)
ON CONFLICT (nombre)
  DO UPDATE SET color = EXCLUDED.color, es_permanente = true;

-- 3. Migrar los tag_ids de los leads:
--    a) traducir cada etiqueta vieja equivalente -> nueva permanente
--    b) conservar solo IDs que correspondan a etiquetas permanentes
--       (todo lo demás -Seguimiento, a la espera...- se descarta)
WITH equiv(old_name, new_name) AS (
  VALUES
    ('Agente Asignado',                  'Agente asignado'),
    ('No volver a Contactar',            'No interesa'),
    ('Solo interesado en propiedades',   'Solo quiere propiedades'),
    ('Reunion Agendada Agente IA',       'Cita agendada')
),
trans AS (
  SELECT o.id AS old_id, n.id AS new_id
  FROM equiv e
  JOIN public.lead_tags o ON o.nombre = e.old_name
  JOIN public.lead_tags n ON n.nombre = e.new_name
),
perm AS (
  SELECT id FROM public.lead_tags WHERE es_permanente = true
)
UPDATE public.leads_campana lc
SET tag_ids = COALESCE((
  SELECT array_agg(DISTINCT nid)
  FROM (
    SELECT COALESCE(tr.new_id, t.id) AS nid
    FROM unnest(lc.tag_ids) AS t(id)
    LEFT JOIN trans tr ON tr.old_id = t.id
  ) mapped
  WHERE nid IN (SELECT id FROM perm)
), '{}')
WHERE lc.tag_ids IS NOT NULL
  AND array_length(lc.tag_ids, 1) > 0;

-- 4. Eliminar todas las etiquetas que NO son permanentes
--    (ya migramos los leads, así que no quedan referencias útiles).
DELETE FROM public.lead_tags WHERE es_permanente = false;

-- 5. Candado a nivel de base de datos:
--    impedir BORRAR o RENOMBRAR (o desproteger) una etiqueta permanente.
--    Sí se permite cambiar el color.
CREATE OR REPLACE FUNCTION public.protect_permanent_tags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.es_permanente THEN
      RAISE EXCEPTION 'No se puede borrar la etiqueta permanente "%".', OLD.nombre;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.es_permanente AND
       (NEW.nombre <> OLD.nombre OR NEW.es_permanente = false) THEN
      RAISE EXCEPTION 'No se puede renombrar ni desproteger la etiqueta permanente "%".', OLD.nombre;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_permanent_tags ON public.lead_tags;
CREATE TRIGGER trg_protect_permanent_tags
  BEFORE UPDATE OR DELETE ON public.lead_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_permanent_tags();

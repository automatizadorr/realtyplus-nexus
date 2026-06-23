-- ============================================================
-- Consolidación de etiquetas (2026-06-23)
-- Decisiones (confirmadas por Mario):
--   1. "Sin Respuesta al Bot" es lo mismo que "Sigue en campaña" →
--      migrar los leads que la tengan a "Sigue en campaña" y borrarla.
--   2. Desde ahora TODAS las etiquetas son permanentes (protegidas):
--      marcar las existentes y dejar el default en true para las futuras.
--
-- Orden importante: borrar "Sin Respuesta al Bot" ANTES de hacer todo
-- permanente, porque el trigger protect_permanent_tags bloquea borrar
-- una etiqueta permanente.
--
-- Idempotente: re-ejecutar produce el mismo resultado final.
-- ============================================================

-- 1. Reemplazar "Sin Respuesta al Bot" por "Sigue en campaña" en los leads
--    que la tengan (misma semántica: el lead aún no ha contestado).
UPDATE public.leads_campana lc
SET tag_ids = (
  SELECT array_agg(DISTINCT CASE WHEN t = old.id THEN new.id ELSE t END)
  FROM unnest(lc.tag_ids) AS t
)
FROM public.lead_tags old, public.lead_tags new
WHERE old.nombre = 'Sin Respuesta al Bot'
  AND new.nombre = 'Sigue en campaña'
  AND lc.tag_ids @> ARRAY[old.id];

-- 2. Borrar la etiqueta "Sin Respuesta al Bot" (aún no es permanente → el
--    trigger permite el DELETE).
DELETE FROM public.lead_tags WHERE nombre = 'Sin Respuesta al Bot';

-- 3. Hacer permanentes TODAS las etiquetas existentes.
UPDATE public.lead_tags SET es_permanente = true WHERE es_permanente = false;

-- 4. Que las etiquetas nuevas también nazcan permanentes.
ALTER TABLE public.lead_tags ALTER COLUMN es_permanente SET DEFAULT true;

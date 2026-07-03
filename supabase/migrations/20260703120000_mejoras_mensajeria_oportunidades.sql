-- ============================================================
-- Mejoras mensajería de oportunidades (2026-07-03)
--
-- NOTA: el frontend es resiliente y funciona CON o SIN esta migración.
-- Esta migración habilita dos cosas opcionales:
--   1) Adjuntos (media_url / media_type) en el chat de oportunidades.
--   2) RPC de opciones de filtro (rendimiento; hay fallback en el cliente).
--
-- El marcado de leído ya NO depende de ninguna función: el cliente resuelve
-- los ids inbound no leídos vía la vista (phone_key exacto) y actualiza por id.
-- ============================================================

-- 1) Adjuntos ------------------------------------------------
ALTER TABLE public.mensajes_automatizacion
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- La vista usa m.* (expandido al crearse), así que hay que recrearla para
-- exponer las columnas nuevas. Usamos DROP + CREATE porque CREATE OR REPLACE
-- exige que las columnas nuevas queden AL FINAL, y m.* las inserta antes de
-- phone_key → CREATE OR REPLACE fallaría con "cannot change name of column".
DROP VIEW IF EXISTS public.vista_mensajes_automatizacion;
CREATE VIEW public.vista_mensajes_automatizacion AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_automatizacion m;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

-- 2) Opciones de filtro (campañas / países distintos) --------
CREATE OR REPLACE FUNCTION public.opciones_inbox_automatizacion()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'campaigns', COALESCE(
      (SELECT jsonb_agg(c ORDER BY c)
         FROM (SELECT DISTINCT campaign_name AS c
                 FROM public.vista_inbox_automatizacion
                WHERE campaign_name IS NOT NULL) q),
      '[]'::jsonb),
    'paises', COALESCE(
      (SELECT jsonb_agg(p ORDER BY p)
         FROM (SELECT DISTINCT pais AS p
                 FROM public.vista_inbox_automatizacion
                WHERE pais IS NOT NULL) q),
      '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.opciones_inbox_automatizacion() TO anon, authenticated;

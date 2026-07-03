-- ============================================================
-- Mejoras mensajería de oportunidades (2026-07-03)
--
-- 1) Adjuntos: añade media_url / media_type a mensajes_automatizacion
--    y re-expande vista_mensajes_automatizacion (usa m.* → hay que
--    recrearla para que incluya las columnas nuevas).
-- 2) Marcado de leído exacto por phone_key: RPC que reemplaza el
--    UPDATE con ilike '%phone%' (que contaminaba teléfonos que eran
--    subcadena de otros). También corrige el contador de no leídos.
-- 3) Rendimiento filtros: RPC que devuelve campañas/países distintos
--    en una sola llamada, en vez de traer hasta 5000 filas al cliente.
-- ============================================================

-- 1) Adjuntos ------------------------------------------------
ALTER TABLE public.mensajes_automatizacion
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- Recrear la vista para que m.* incluya las columnas nuevas.
CREATE OR REPLACE VIEW public.vista_mensajes_automatizacion AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_automatizacion m;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

-- 2) Marcar leídos por phone_key exacto ----------------------
CREATE OR REPLACE FUNCTION public.marcar_leidos_automatizacion(p_phone_key text)
RETURNS integer
LANGUAGE sql
-- security_invoker (default): respeta la RLS igual que el UPDATE previo
SET search_path = public
AS $$
  WITH upd AS (
    UPDATE public.mensajes_automatizacion
    SET leido = true
    WHERE regexp_replace(telefono, '[^0-9]', '', 'g') = p_phone_key
      AND direccion = 'inbound'
      AND leido IS DISTINCT FROM true
    RETURNING 1
  )
  SELECT count(*)::int FROM upd;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_leidos_automatizacion(text) TO anon, authenticated;

-- 3) Opciones de filtro (campañas / países distintos) --------
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

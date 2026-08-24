-- =====================================================================
-- Estadisticas del vendedor por canal de contacto (2026-09-06)
-- ---------------------------------------------------------------------
-- Las Estadisticas solo miraban plantillas de WhatsApp y de email. Con la
-- llamada telefonica, Instagram y Facebook ya incorporados al flujo, el
-- vendedor no tenia forma de ver por donde esta contactando de verdad ni
-- que resultado dan las llamadas.
--
-- vendedor_contactos_por_canal(): cuantos contactos hizo por canal en los
--   ultimos N dias (default 30).
-- vendedor_resultados_llamadas(): como terminaron sus llamadas.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.vendedor_contactos_por_canal(_dias int DEFAULT 30)
RETURNS TABLE (canal text, contactos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT cl.canal, count(*) AS contactos
  FROM public.contactos_log cl
  WHERE cl.user_id = auth.uid()
    AND cl.created_at >= now() - make_interval(days => greatest(coalesce(_dias, 30), 1))
  GROUP BY cl.canal
  ORDER BY count(*) DESC;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_contactos_por_canal(int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_contactos_por_canal(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendedor_resultados_llamadas(_dias int DEFAULT 30)
RETURNS TABLE (resultado text, llamadas bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(nullif(btrim(cl.resultado), ''), 'Sin registrar') AS resultado,
         count(*) AS llamadas
  FROM public.contactos_log cl
  WHERE cl.user_id = auth.uid()
    AND cl.canal = 'llamada'
    AND cl.created_at >= now() - make_interval(days => greatest(coalesce(_dias, 30), 1))
  GROUP BY 1
  ORDER BY count(*) DESC;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_resultados_llamadas(int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_resultados_llamadas(int) TO authenticated;

-- =====================================================================
-- Facets para el filtro de Reactivación (pestaña en Buscar Leads)
-- ---------------------------------------------------------------------
-- El filtro profesional sobre leads_campana (8k+ filas) necesita poblar
-- el desplegable de "País" sin traer todas las filas al cliente. Este RPC
-- devuelve los países distintos con su conteo en UNA sola llamada liviana.
-- SECURITY DEFINER + guard has_role(admin): mismo patrón que
-- prospeccion_historial() e kpis_por_pais(). Idempotente.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.leads_campana_paises()
RETURNS TABLE (pais text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(pais), ''), '—') AS pais, count(*) AS n
  FROM public.leads_campana
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.leads_campana_paises() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.leads_campana_paises() TO authenticated, service_role;

-- =====================================================================
-- Fase B (preparacion): elegir a que vendedor entregarle un lead que
-- Camil-AI califico. Round-robin simple: el vendedor activo asignado a
-- ese pais con MENOS leads_campana abiertos (ni ganado ni perdido).
-- Solo la usa el edge function bot-handoff-vendedor (service_role),
-- por eso no se otorga a authenticated/anon.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.elegir_vendedor_para(_pais text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.user_id
  FROM public.vendedores v
  JOIN public.vendedor_paises vp ON vp.user_id = v.user_id
  WHERE v.activo = true AND vp.pais = _pais
  ORDER BY (
    SELECT count(*) FROM public.leads_campana lc
    WHERE lc.vendedor_id = v.user_id AND lc.etapa_venta NOT IN ('ganado', 'perdido')
  ) ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.elegir_vendedor_para(text) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.elegir_vendedor_para(text) TO service_role;

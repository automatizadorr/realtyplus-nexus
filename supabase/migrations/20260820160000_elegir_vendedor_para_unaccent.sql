-- leads_campana trae paises historicos sin tilde ("Mexico") mientras que
-- vendedor_paises usa el catalogo con tilde ("Mexico" con acento, ver
-- src/lib/paises.ts). Sin esto, elegir_vendedor_para nunca encontraba
-- vendedor para leads reales de leads_campana. Match insensible a
-- mayusculas/tildes.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.elegir_vendedor_para(_pais text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT v.user_id
  FROM public.vendedores v
  JOIN public.vendedor_paises vp ON vp.user_id = v.user_id
  WHERE v.activo = true AND lower(unaccent(vp.pais)) = lower(unaccent(_pais))
  ORDER BY (
    SELECT count(*) FROM public.leads_campana lc
    WHERE lc.vendedor_id = v.user_id AND lc.etapa_venta NOT IN ('ganado', 'perdido')
  ) ASC
  LIMIT 1
$$;

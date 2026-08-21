-- =====================================================================
-- RPC para la nueva pestaña "Estadísticas" del vendedor: resumen de sus
-- propios envíos de correo (tabla correo_envios, hoy solo legible por
-- admin vía RLS) + su cupo diario (vendedores.limite_mensajes_dia).
-- SECURITY DEFINER: se salta la RLS a propósito, pero solo devuelve
-- datos filtrados por enviado_por = auth.uid(), nunca ajenos.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.vendedor_correos_resumen()
RETURNS TABLE (
  cupo_diario      int,
  enviados_hoy     bigint,
  total_30d        bigint,
  enviado_30d      bigint,
  entregado_30d    bigint,
  abierto_30d      bigint,
  click_30d        bigint,
  rebotado_30d     bigint,
  fallido_30d      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cupo int;
BEGIN
  IF NOT public.has_role(_uid, 'vendedor') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT v.limite_mensajes_dia INTO _cupo FROM public.vendedores v WHERE v.user_id = _uid;

  RETURN QUERY
  SELECT
    COALESCE(_cupo, 55),
    (SELECT count(*) FROM public.correo_envios ce
       WHERE ce.enviado_por = _uid AND ce.estado <> 'fallido'
         AND ce.enviado_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago'),
    count(*),
    count(*) FILTER (WHERE estado = 'enviado'),
    count(*) FILTER (WHERE estado = 'entregado'),
    count(*) FILTER (WHERE estado = 'abierto'),
    count(*) FILTER (WHERE estado = 'click'),
    count(*) FILTER (WHERE estado = 'rebotado'),
    count(*) FILTER (WHERE estado = 'fallido')
  FROM public.correo_envios
  WHERE enviado_por = _uid
    AND enviado_at >= now() - interval '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_correos_resumen() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_correos_resumen() TO authenticated;

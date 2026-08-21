-- =====================================================================
-- Asignación de leads a un vendedor POR LOTE (no solo la página visible
-- en pantalla). El admin elige una cantidad (100/200/.../900/todos) y el
-- filtro actual (país, solo-sin-asignar, búsqueda); la RPC hace el
-- ORDER BY + LIMIT + UPDATE en una sola transacción del lado del server,
-- evitando mandar miles de UUIDs en la URL de un .in(...) desde el cliente.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_asignar_leads(
  _vendedor_id       uuid,
  _cantidad          int DEFAULT NULL,   -- NULL = todos los que calcen el filtro
  _pais              text DEFAULT NULL, -- NULL o 'all' = cualquier país
  _solo_sin_asignar  boolean DEFAULT true,
  _busqueda          text DEFAULT NULL
)
RETURNS TABLE (asignados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendedores WHERE user_id = _vendedor_id AND activo = true) THEN
    RAISE EXCEPTION 'Vendedor no válido o inactivo';
  END IF;

  WITH candidatos AS (
    SELECT id FROM public.leads_campana
    WHERE (_solo_sin_asignar = false OR vendedor_id IS NULL)
      AND (_pais IS NULL OR _pais = 'all' OR pais = _pais)
      AND (
        _busqueda IS NULL OR btrim(_busqueda) = '' OR
        nombre ILIKE '%' || _busqueda || '%' OR
        email  ILIKE '%' || _busqueda || '%' OR
        telefono ILIKE '%' || _busqueda || '%'
      )
    ORDER BY dias_reales DESC NULLS LAST
    LIMIT COALESCE(_cantidad, 2147483647)
  ),
  actualizados AS (
    UPDATE public.leads_campana lc
    SET vendedor_id = _vendedor_id, fecha_asignacion = now(), etapa_venta = 'nuevo'
    FROM candidatos c
    WHERE lc.id = c.id
    RETURNING lc.id
  )
  SELECT count(*) INTO _n FROM actualizados;

  RETURN QUERY SELECT _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_asignar_leads(uuid, int, text, boolean, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_asignar_leads(uuid, int, text, boolean, text) TO authenticated;

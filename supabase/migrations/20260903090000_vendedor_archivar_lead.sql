-- =====================================================================
-- Botón "Archivar" en la tarjeta del Pipeline: se usa cuando el número
-- no existe (WhatsApp inválido/imposible de contactar). El vendedor no
-- tiene UPDATE genérico en leads_campana (todo pasa por RPC angostas),
-- así que se agrega una específica para archivar, igual patrón que
-- vendedor_toggle_bot / vendedor_mover_etapa.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.vendedor_archivar_lead(_lead_id uuid, _archivado boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.leads_campana
  SET archivado = _archivado
  WHERE id = _lead_id AND vendedor_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_archivar_lead(uuid, boolean) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_archivar_lead(uuid, boolean) TO authenticated;

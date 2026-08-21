-- =====================================================================
-- La pestaña "Reactivación" del vendedor deja de mostrar el filtro de
-- "Leads de campaña" (herramienta de campañas del admin) y pasa a
-- mostrar la MENSAJERÍA real conectada a Camil-AI: vista_inbox_contactos
-- + mensajes_whatsapp (el mismo sistema que usa /inbox, ya scoped por
-- RLS vía leads_campana.vendedor_id — sin cambios ahí).
--
-- Lo único que faltaba para que el vendedor pudiera USAR ese chat (no
-- solo leerlo):
--   1) Apagar/prender el bot (leads_campana.bot_activo) — no hay UPDATE
--      genérico para vendedor en leads_campana (por diseño, todo pasa por
--      RPC angostas). Nueva RPC vendedor_toggle_bot().
--   2) Marcar mensajes como leídos (mensajes_whatsapp.leido) — Fase 2 solo
--      dio SELECT/INSERT a esa tabla. Nueva policy UPDATE acotada.
--   3) send-n8n-webhook: el envío real usa el target "crmrp" (no
--      "oportunidades") — se habilita en el edge function, no en SQL.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.vendedor_toggle_bot(_lead_id uuid, _activo boolean)
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
  SET bot_activo = _activo
  WHERE id = _lead_id AND vendedor_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_toggle_bot(uuid, boolean) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_toggle_bot(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Vendedor marca leido mensajes_whatsapp" ON public.mensajes_whatsapp;
CREATE POLICY "Vendedor marca leido mensajes_whatsapp"
  ON public.mensajes_whatsapp FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_telefono(telefono)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_telefono(telefono)
  );

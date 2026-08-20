-- =====================================================================
-- Fase 2: el vendedor accede a "Mensajes de Oportunidades"
-- (mensajes_automatizacion/mensajes_whatsapp, vía las vistas
-- vista_inbox_automatizacion/vista_mensajes_automatizacion), pero SOLO
-- para los leads que el admin le envio (leads_campana.vendedor_id).
--
-- Las vistas son planas (no security definer) y heredan la RLS de las
-- tablas base para el rol que consulta -> alcanza con dar RLS aca, sin
-- tocar las vistas ni el hook use-automation-contacts.ts.
--
-- Match de telefono: mensajes_automatizacion/mensajes_whatsapp pueden
-- traer el numero con sufijo JID de WhatsApp; se normaliza con
-- regexp_replace a solo digitos (mismo criterio que usa la vista para
-- el phone_key) para comparar contra leads_campana.telefono.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.vendedor_ve_telefono(_telefono text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads_campana lc
    WHERE lc.vendedor_id = auth.uid()
      AND regexp_replace(lc.telefono, '[^0-9]', '', 'g') = regexp_replace(_telefono, '[^0-9]', '', 'g')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_ve_telefono(text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_ve_telefono(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- mensajes_automatizacion
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedor lee mensajes_automatizacion" ON public.mensajes_automatizacion;
CREATE POLICY "Vendedor lee mensajes_automatizacion"
  ON public.mensajes_automatizacion FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_telefono(telefono)
  );

DROP POLICY IF EXISTS "Vendedor inserta mensajes_automatizacion" ON public.mensajes_automatizacion;
CREATE POLICY "Vendedor inserta mensajes_automatizacion"
  ON public.mensajes_automatizacion FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND user_id = auth.uid()
    AND public.vendedor_ve_telefono(telefono)
  );

-- ---------------------------------------------------------------------
-- mensajes_whatsapp
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedor lee mensajes_whatsapp" ON public.mensajes_whatsapp;
CREATE POLICY "Vendedor lee mensajes_whatsapp"
  ON public.mensajes_whatsapp FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_telefono(telefono)
  );

DROP POLICY IF EXISTS "Vendedor inserta mensajes_whatsapp" ON public.mensajes_whatsapp;
CREATE POLICY "Vendedor inserta mensajes_whatsapp"
  ON public.mensajes_whatsapp FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_telefono(telefono)
  );

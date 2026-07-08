-- PASO 2 DE 2: Función helper + políticas RLS para sub_admin.
-- Ejecutar DESPUÉS de que 20260708200000_sub_admin_enum.sql haya confirmado.

-- Helper: verdadero para admin O sub_admin
CREATE OR REPLACE FUNCTION public.has_crm_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'sub_admin'::public.app_role)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_crm_access(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_crm_access(uuid) TO authenticated, service_role;

-- ============================================================
-- RLS SELECT para sub_admin en tablas PII
-- (las políticas de admin no cambian)
-- ============================================================

-- leads_campana
CREATE POLICY "Sub-admins read leads"
  ON public.leads_campana
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- mensajes_whatsapp
CREATE POLICY "Sub-admins read messages"
  ON public.mensajes_whatsapp
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- mensajes_automatizacion
CREATE POLICY "Sub-admins read auto messages"
  ON public.mensajes_automatizacion
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- lead_recovery_campaigns
CREATE POLICY "Sub-admins read campaigns"
  ON public.lead_recovery_campaigns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- lead_notes
CREATE POLICY "Sub-admins read notes"
  ON public.lead_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- logs_expansion (condicional: la tabla puede no existir en todos los entornos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'logs_expansion') THEN
    EXECUTE $p$
      CREATE POLICY "Sub-admins read logs expansion"
        ON public.logs_expansion
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'sub_admin'))
    $p$;
  END IF;
END;
$$;

-- leads_sheet
CREATE POLICY "Sub-admins read leads_sheet"
  ON public.leads_sheet
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- quick_replies (solo los propios)
CREATE POLICY "Sub-admins read quick replies"
  ON public.quick_replies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin') AND auth.uid() = user_id);

-- ============================================================
-- Storage: lectura para sub_admin
-- ============================================================

-- whatsapp-media (ver adjuntos en el chat)
CREATE POLICY "Sub-admins read whatsapp-media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.has_role(auth.uid(), 'sub_admin')
  );

-- reportes (descargar Excel/Word/HTML desde TaggedExport)
CREATE POLICY "Sub-admins read reportes"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reportes'
    AND public.has_role(auth.uid(), 'sub_admin')
  );

-- ============================================================
-- Para asignar el rol a un usuario:
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES ('<uuid-del-usuario>', 'sub_admin');
-- ============================================================

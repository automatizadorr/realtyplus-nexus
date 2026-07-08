-- ============================================================
-- SUB-ADMIN ROLE
-- Puede ver leads, conversaciones y tablas del CRM.
-- NO puede enviar mensajes, disparar webhooks ni borrar datos.
-- send-n8n-webhook ya rechaza a no-admins (has_role 'admin') →
-- los webhooks quedan bloqueados en la capa de Edge Function.
-- ============================================================

-- 1. Añadir el valor al enum (idempotente en PG13+)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';

-- 2. Helper: verdadero para admin O sub_admin
--    Útil para RLS y para edge functions futuras.
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
      AND role IN ('admin', 'sub_admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_crm_access(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_crm_access(uuid) TO authenticated, service_role;

-- ============================================================
-- 3. RLS SELECT para sub_admin en tablas PII
--    (las políticas de admin no cambian)
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

-- logs_expansion
CREATE POLICY "Sub-admins read logs expansion"
  ON public.logs_expansion
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- leads_sheet
CREATE POLICY "Sub-admins read leads_sheet"
  ON public.leads_sheet
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin'));

-- quick_replies (solo lectura; los suyos propios)
CREATE POLICY "Sub-admins read quick replies"
  ON public.quick_replies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'sub_admin') AND auth.uid() = user_id);

-- ============================================================
-- 4. Storage: lectura de media para sub_admin
-- ============================================================

-- whatsapp-media (para ver adjuntos en el chat)
CREATE POLICY "Sub-admins read whatsapp-media"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.has_role(auth.uid(), 'sub_admin')
  );

-- reportes (para descargar Excel/Word/HTML desde TaggedExport)
CREATE POLICY "Sub-admins read reportes"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reportes'
    AND public.has_role(auth.uid(), 'sub_admin')
  );

-- ============================================================
-- 5. Asignar sub_admin desde el SQL Editor:
--    INSERT INTO public.user_roles (user_id, role)
--    VALUES ('<uuid-del-usuario>', 'sub_admin');
-- ============================================================

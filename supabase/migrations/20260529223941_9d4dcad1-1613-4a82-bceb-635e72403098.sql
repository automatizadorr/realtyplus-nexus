
-- 1. Restrict leads_campana to admins only (remove anon + broad authenticated policies)
DROP POLICY IF EXISTS "Anon can manage leads (n8n)" ON public.leads_campana;
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads_campana;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads_campana;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads_campana;

CREATE POLICY "Admins read leads" ON public.leads_campana
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert leads" ON public.leads_campana
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update leads" ON public.leads_campana
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete leads" ON public.leads_campana
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Restrict mensajes_whatsapp to admins only
DROP POLICY IF EXISTS "Permitir todo a anonimos en mensajes (n8n inbound)" ON public.mensajes_whatsapp;
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.mensajes_whatsapp;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.mensajes_whatsapp;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.mensajes_whatsapp;

CREATE POLICY "Admins read messages" ON public.mensajes_whatsapp
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert messages" ON public.mensajes_whatsapp
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update messages" ON public.mensajes_whatsapp
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete messages" ON public.mensajes_whatsapp
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Remove anon read on whatsapp-media bucket
DROP POLICY IF EXISTS "Anon read whatsapp-media (n8n)" ON storage.objects;

-- 4. Enable RLS on documents (RAG) table - service role only
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM anon, authenticated;
GRANT ALL ON public.documents TO service_role;

-- 5. Restrict knowledge_base to authenticated (remove anon read)
DROP POLICY IF EXISTS "anon_read_kb" ON public.knowledge_base;
REVOKE SELECT ON public.knowledge_base FROM anon;
CREATE POLICY "authenticated_read_kb" ON public.knowledge_base
  FOR SELECT TO authenticated USING (true);

-- 6. Fix mutable search_path on update_modified_column
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

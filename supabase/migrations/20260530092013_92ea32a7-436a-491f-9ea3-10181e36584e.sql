-- Defensive: ensure anon cannot write to mensajes_automatizacion
REVOKE INSERT, UPDATE, DELETE ON public.mensajes_automatizacion FROM anon;
DROP POLICY IF EXISTS "auto_insert" ON public.mensajes_automatizacion;

-- Storage: add UPDATE policy for whatsapp-media (admin-only, mirrors existing pattern)
DROP POLICY IF EXISTS "Admins update whatsapp-media" ON storage.objects;
CREATE POLICY "Admins update whatsapp-media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Realtime: restrict channel subscriptions to admins only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Admins can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
-- 1. Extend leads_campana
ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS archivado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tag_ids uuid[] DEFAULT '{}';

-- 2. Extend mensajes_whatsapp
ALTER TABLE public.mensajes_whatsapp
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- 3. quick_replies
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own quick replies (select)"
  ON public.quick_replies FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage own quick replies (insert)"
  ON public.quick_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage own quick replies (update)"
  ON public.quick_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage own quick replies (delete)"
  ON public.quick_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

-- 4. lead_tags
CREATE TABLE IF NOT EXISTS public.lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#003366',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tags"
  ON public.lead_tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins insert tags"
  ON public.lead_tags FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update tags"
  ON public.lead_tags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tags"
  ON public.lead_tags FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. lead_notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON public.lead_notes(lead_id);
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notes"
  ON public.lead_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert notes"
  ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admins update own notes"
  ON public.lead_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admins delete own notes"
  ON public.lead_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- 6. Storage bucket (private) for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read whatsapp-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload whatsapp-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete whatsapp-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

-- Anon role (n8n) needs to read media to forward to WhatsApp Cloud API
CREATE POLICY "Anon read whatsapp-media (n8n)"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'whatsapp-media');
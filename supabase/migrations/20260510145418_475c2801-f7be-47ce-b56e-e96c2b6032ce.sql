
CREATE POLICY "Authenticated users can view all messages"
ON public.mensajes_whatsapp FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert messages"
ON public.mensajes_whatsapp FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update messages"
ON public.mensajes_whatsapp FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.leads_campana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all leads"
ON public.leads_campana FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert leads"
ON public.leads_campana FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
ON public.leads_campana FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can manage leads (n8n)"
ON public.leads_campana FOR ALL
TO anon USING (true) WITH CHECK (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_campana;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

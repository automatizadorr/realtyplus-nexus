ALTER TABLE public.leads_campana ADD COLUMN IF NOT EXISTS id_contacto text;
CREATE INDEX IF NOT EXISTS idx_leads_campana_id_contacto ON public.leads_campana(id_contacto);
CREATE INDEX IF NOT EXISTS idx_leads_campana_email_lower ON public.leads_campana(lower(email));
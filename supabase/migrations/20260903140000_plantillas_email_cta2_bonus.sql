-- =====================================================================
-- Más posibilidades de edición en el diseño de correo del vendedor:
-- botón secundario (cta2) y línea de regalo/bonus (bonus), igual que ya
-- soporta el compositor buildProEmail/buildPlainEmail (src/lib/emailTemplates.ts).
-- =====================================================================
ALTER TABLE public.plantillas_email
  ADD COLUMN IF NOT EXISTS cta2_text  text,
  ADD COLUMN IF NOT EXISTS cta2_url   text,
  ADD COLUMN IF NOT EXISTS bonus_text text,
  ADD COLUMN IF NOT EXISTS bonus_url  text;

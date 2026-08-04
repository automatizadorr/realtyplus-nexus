-- =====================================================================
-- Rotación de 2 API keys de Resend: saber cuál key envió cada correo.
-- ---------------------------------------------------------------------
-- 0 = RESEND_API_KEY_1 (o fallback RESEND_API_KEY), 1 = RESEND_API_KEY_2.
-- Sirve para auditar fallos por key y distribuir carga entre cuentas.
-- =====================================================================
ALTER TABLE public.correo_envios
  ADD COLUMN IF NOT EXISTS resend_key_index smallint DEFAULT NULL;

COMMENT ON COLUMN public.correo_envios.resend_key_index IS '0=Resend key 1, 1=Resend key 2. Rotación round-robin A-B-A-B por correo.';

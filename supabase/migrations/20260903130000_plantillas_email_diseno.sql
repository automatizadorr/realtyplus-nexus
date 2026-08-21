-- =====================================================================
-- Diseño visual de correo para el vendedor (Mis Plantillas > Email):
-- se reutiliza el mismo compositor de HTML de Correos Personalizados
-- (src/lib/emailTemplates.ts + EmailDesignCard) pero solo para el
-- diseño/HTML, no el resto de esa herramienta (destinatarios, ganchos,
-- secuencias, envío por Resend).
--
-- `cuerpo_html` sigue siendo el HTML final (el que ya usan Bandeja/
-- Pipeline al enviar); `cuerpo_text` pasa a ser el CUERPO fuente que
-- alimenta el compositor (título/botón/color/logo/firma/pie se guardan
-- aparte para poder reabrir el diseño y seguir editándolo).
-- =====================================================================

ALTER TABLE public.plantillas_email
  ADD COLUMN IF NOT EXISTS design_mode text NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS titulo       text,
  ADD COLUMN IF NOT EXISTS cta_text     text,
  ADD COLUMN IF NOT EXISTS cta_url      text,
  ADD COLUMN IF NOT EXISTS brand_color  text NOT NULL DEFAULT '#003DA5',
  ADD COLUMN IF NOT EXISTS logo_url     text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS footer_text  text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plantillas_email_design_mode_check'
  ) THEN
    ALTER TABLE public.plantillas_email
      ADD CONSTRAINT plantillas_email_design_mode_check
      CHECK (design_mode IN ('personal', 'pro', 'texto'));
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- El vendedor puede subir logo/avatar al bucket email-assets (antes solo
-- admin), acotado a su propia carpeta ({user_id}/...) como ya hace
-- EmailDesignCard al armar el path de subida.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "email_assets_vendedor_insert" ON storage.objects;
CREATE POLICY "email_assets_vendedor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'email-assets'
    AND public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "email_assets_vendedor_update" ON storage.objects;
CREATE POLICY "email_assets_vendedor_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'email-assets'
    AND public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "email_assets_vendedor_delete" ON storage.objects;
CREATE POLICY "email_assets_vendedor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- FIX DE SEGURIDAD: cerrar acceso anónimo a leads_campana
-- ---------------------------------------------------------------------
-- Problema: la política "Anon can manage leads (n8n)" daba al rol `anon`
-- (cuya key va PÚBLICA en el bundle del frontend) permiso FOR ALL sobre
-- leads_campana. Cualquiera con la anon key podía leer/editar/borrar
-- TODOS los leads sin autenticarse.
--
-- Por qué es seguro cerrarla:
--   - El frontend logueado usa el rol `authenticated` (otras políticas).
--   - n8n ya escribe en Supabase con SUPABASE_SERVICE_ROLE_KEY
--     (ver n8n/expansion-reporte-jefatura.json), que ignora RLS.
--
-- PRERREQUISITO antes de aplicar: confirmar que el workflow de ingesta
-- de leads en n8n (primer_contacto / crmrp) usa la service_role key,
-- igual que el workflow de expansión. Si usara la anon key, primero
-- cámbialo a service_role.
-- =====================================================================

DROP POLICY IF EXISTS "Anon can manage leads (n8n)" ON public.leads_campana;

-- ROLLBACK de emergencia (solo si la ingesta de n8n dejara de funcionar):
-- CREATE POLICY "Anon can manage leads (n8n)"
--   ON public.leads_campana FOR ALL
--   TO anon USING (true) WITH CHECK (true);

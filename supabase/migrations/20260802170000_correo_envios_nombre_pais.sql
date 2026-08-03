-- =====================================================================
-- Seguimiento de correos: mostrar nombre, empresa y país del destinatario.
-- ---------------------------------------------------------------------
-- La tabla correo_envios solo guardaba email y empresa. Se agregan las
-- columnas nombre y pais para que el panel de Seguimiento de correos
-- muestre también estos campos (además del correo electrónico).
-- Las escrituras las hacen las edge functions (service_role, ignoran RLS).
-- =====================================================================
ALTER TABLE public.correo_envios
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS pais    text;

-- Las secuencias guardan el snapshot del destinatario; casi igual para el
-- envío manual, se resuelven en correo_envios.nombre / .pais.
ALTER TABLE public.secuencia_envios_programados
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS pais    text,
  ADD COLUMN IF NOT EXISTS datos   jsonb;
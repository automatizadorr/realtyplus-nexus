-- =====================================================================
-- AUTO-BATCHING: columna html en secuencia_envios_programados
-- ---------------------------------------------------------------------
-- El envío masivo de Correos Personalizados hoy se corta en tandas
-- manuales (50/100/200) para respetar el límite diario de Resend (100/día
-- en el plan gratis). Con Fase 3 el excedente se programa AUTOMÁTICamente:
-- la edge send-personalized-campaign envía hoy hasta el límite diario y
-- agenda el resto en esta tabla para los próximos días, y el cron existente
-- (cron-secuencias-correo) los envía cuando vencen.
-- Para que esos correos programados conserven el diseño pro/personal de la
-- campaña (no solo el HTML simple del cron), guardamos aquí el snapshot HTML
-- completo con {{variables}}; el cron usa `html` si viene, sino su HTML simple.
-- =====================================================================
ALTER TABLE public.secuencia_envios_programados
  ADD COLUMN IF NOT EXISTS html text;

COMMENT ON COLUMN public.secuencia_envios_programados.html IS
  'Snapshot HTML completo de la campaña (con {{variables}}). Si está presente, el cron lo rellena y envía tal cual en lugar del HTML genérico.';
-- =====================================================================
-- La cola de correos programados recuerda con que cuenta Resend hay que
-- enviarlos (2026-09-06)
-- ---------------------------------------------------------------------
-- Cuando un envio supera el cupo diario, el excedente queda agendado en
-- secuencia_envios_programados y lo manda el cron al dia siguiente. Hasta
-- ahora el cron alternaba las dos cuentas Resend sin mirar lo que habia
-- elegido el vendedor: si habia fijado lexhouse-ai.online, el excedente
-- podia salir igual desde send.lexhouse-ai.com y romper la consistencia
-- del remitente en medio de una misma campana.
--
-- NULL = filas viejas o sin preferencia: el cron alterna como siempre.
-- =====================================================================
ALTER TABLE public.secuencia_envios_programados
  ADD COLUMN IF NOT EXISTS remitente_modo text;

DO $blk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'secuencia_envios_remitente_modo_check') THEN
    ALTER TABLE public.secuencia_envios_programados
      ADD CONSTRAINT secuencia_envios_remitente_modo_check
      CHECK (remitente_modo IS NULL OR remitente_modo IN ('auto','resend1','resend2','particular'));
  END IF;
END;
$blk$;

COMMENT ON COLUMN public.secuencia_envios_programados.remitente_modo IS
  'Cuenta Resend con la que se debe enviar esta fila (auto/resend1/resend2). NULL = alternar, como antes.';

-- ============================================================
-- vista_mensajes_whatsapp: reincorporar estado_envio / wamid (2026-07-06)
--
-- CONTEXTO: la vista se creó (20260626120000) con `SELECT m.*, phone_key` ANTES
-- de que `mensajes_whatsapp` tuviera las columnas `wamid` y `estado_envio` (que
-- se agregaron para los acuses / read receipts de la reactivación). Postgres
-- CONGELA la lista de columnas de una vista al crearla: el `m.*` NO se re-expande
-- solo cuando aparecen columnas nuevas en la tabla base. Por eso el chat del
-- inbox normal no ve `estado_envio`.
--
-- Un CREATE OR REPLACE no basta (las columnas nuevas de `m.*` se insertarían
-- ANTES de `phone_key`, cambiando el orden → error "cannot change name of view
-- column"). Se recrea con DROP + CREATE. Nada depende de esta vista (solo la lee
-- ChatArea), así que el DROP es seguro.
--
-- security_invoker=true → respeta el RLS de mensajes_whatsapp. Idempotente.
-- Aplicar en el SQL Editor.
-- ============================================================

DROP VIEW IF EXISTS public.vista_mensajes_whatsapp;

CREATE VIEW public.vista_mensajes_whatsapp AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_whatsapp m;

ALTER VIEW public.vista_mensajes_whatsapp SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_whatsapp TO anon, authenticated;

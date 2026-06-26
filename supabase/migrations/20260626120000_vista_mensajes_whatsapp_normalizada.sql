-- ============================================================
-- vista_mensajes_whatsapp: mensajes con phone_key normalizado (2026-06-26)
--
-- PROBLEMA: el teléfono se guarda en mensajes_whatsapp en formatos SUCIOS e
-- inconsistentes según la fuente de ingesta: "(+56)958060832", "+56958060832",
-- "56958060832", "56958060832@s.whatsapp.net", etc. El chat (ChatArea) buscaba
-- los mensajes por igualdad de string (telefono.eq / telefono.like '...@%'), así
-- que con un lead "+56958060832" NO enganchaba ninguno → la conversación salía
-- VACÍA aunque sí hubiera mensajes.
--
-- SOLUCIÓN: exponer una columna `phone_key` = solo dígitos (regexp_replace) para
-- que la lectura del chat filtre por `phone_key` y matchee TODOS los formatos,
-- sin tener que limpiar la tabla ni la ingesta. Mismo criterio que
-- vista_inbox_contactos.
--
-- security_invoker=true → respeta las políticas RLS de mensajes_whatsapp del
-- usuario que consulta. Idempotente (CREATE OR REPLACE). Aplicar en el SQL Editor.
-- ============================================================

CREATE OR REPLACE VIEW public.vista_mensajes_whatsapp AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_whatsapp m;

ALTER VIEW public.vista_mensajes_whatsapp SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_whatsapp TO anon, authenticated;

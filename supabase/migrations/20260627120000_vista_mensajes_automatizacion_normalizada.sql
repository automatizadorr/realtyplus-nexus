-- ============================================================
-- vista_mensajes_automatizacion: mensajes con phone_key normalizado (2026-06-27)
--
-- PROBLEMA: el teléfono se guarda en mensajes_automatizacion en formatos
-- inconsistentes según la fuente de ingesta: "971806730", "34971806730",
-- "34971806730@s.whatsapp.net", etc. AutomationChatArea buscaba con
-- .eq("telefono", phone) → comparación exacta → la conversación salía
-- VACÍA aunque sí hubiera mensajes.
--
-- SOLUCIÓN: exponer phone_key = solo dígitos (regexp_replace) igual que
-- vista_mensajes_whatsapp, para que el chat filtre por phone_key y matchee
-- todos los formatos sin alterar la tabla ni la ingesta.
-- ============================================================

CREATE OR REPLACE VIEW public.vista_mensajes_automatizacion AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_automatizacion m;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

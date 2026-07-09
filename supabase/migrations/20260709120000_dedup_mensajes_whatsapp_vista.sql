-- ============================================================
-- Dedup outbound duplicados en vista_mensajes_whatsapp (2026-07-09)
--
-- PROBLEMA: el flujo de Sofía en n8n tiene dos nodos que guardan el
-- mismo outbound en mensajes_whatsapp con ~2s de diferencia:
--   1. Registrar en Supabase1 (tras Send message1) → con WAMID ✅
--   2. Otro nodo posterior                          → sin WAMID ❌
--
-- La vista era SELECT m.* sin dedup, así que ambas filas
-- aparecían en el chat de Reactivación.
--
-- FIX: DISTINCT ON (phone_key, direccion, contenido[200], bucket_30s)
-- ordenando para preferir la fila con WAMID y más antigua.
-- Ventana de 30s es suficiente para el patrón real (~2s entre dupes)
-- sin colapsar mensajes legítimamente repetidos en distintos turnos.
-- ============================================================

DROP VIEW IF EXISTS public.vista_mensajes_whatsapp;

CREATE VIEW public.vista_mensajes_whatsapp AS
SELECT DISTINCT ON (
  regexp_replace(m.telefono, '[^0-9]', '', 'g'),
  m.direccion,
  left(m.contenido, 200),
  (extract(epoch from m.created_at) / 30)::bigint
)
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_whatsapp m
ORDER BY
  regexp_replace(m.telefono, '[^0-9]', '', 'g'),
  m.direccion,
  left(m.contenido, 200),
  (extract(epoch from m.created_at) / 30)::bigint,
  (m.wamid IS NULL) ASC,   -- prioridad: fila con WAMID primero
  m.created_at ASC;

ALTER VIEW public.vista_mensajes_whatsapp SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_whatsapp TO anon, authenticated;

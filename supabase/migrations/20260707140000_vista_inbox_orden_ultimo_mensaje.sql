-- ============================================================
-- vista_inbox_contactos: ordenar por FECHA REAL del último mensaje (2026-07-07)
--
-- PROBLEMA: `last_message_at` era COALESCE(max(created_at de mensajes), leads.updated_at).
-- Tras el re-etiquetado masivo, `updated_at` de miles de leads quedó en AHORA, así que
-- los leads SIN conversación (que caían al fallback updated_at) se subían al tope del
-- inbox, empujando abajo las conversaciones recientes de verdad.
--
-- FIX: `last_message_at` = solo la fecha del último mensaje real (NULL si no hay). El
-- hook ordena DESC con nulls al final → la última conversación va primero y los leads
-- sin mensajes quedan al final (formatInboxTime(null) muestra vacío, ya soportado).
--
-- Mismas columnas/orden → CREATE OR REPLACE seguro. Idempotente. Aplicar en SQL Editor.
-- ============================================================

CREATE OR REPLACE VIEW public.vista_inbox_contactos AS
WITH dedup_leads AS (
  SELECT DISTINCT ON (regexp_replace(leads_campana.telefono, '[^0-9]', '', 'g'))
    leads_campana.id, leads_campana.nombre, leads_campana.telefono, leads_campana.pais,
    leads_campana.estado, leads_campana.bot_activo, leads_campana.archivado,
    leads_campana.tag_ids, leads_campana.updated_at,
    regexp_replace(leads_campana.telefono, '[^0-9]', '', 'g') AS phone_key
  FROM leads_campana
  ORDER BY regexp_replace(leads_campana.telefono, '[^0-9]', '', 'g'),
           leads_campana.updated_at DESC NULLS LAST
), agg AS (
  SELECT regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    max(created_at) AS last_message_at,
    max(created_at) FILTER (WHERE direccion = 'inbound')  AS last_inbound_at,
    max(created_at) FILTER (WHERE direccion = 'outbound') AS last_outbound_at,
    count(*) FILTER (WHERE direccion = 'inbound' AND leido = false) AS unread_count,
    count(*) FILTER (WHERE direccion = 'inbound') AS inbound_count,
    count(*) FILTER (WHERE direccion = 'outbound') AS outbound_count
  FROM mensajes_whatsapp
  GROUP BY regexp_replace(telefono, '[^0-9]', '', 'g')
), last_msg AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    contenido AS last_message_text, direccion AS last_message_dir
  FROM mensajes_whatsapp
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
), first_msg AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    direccion AS first_message_dir, created_at AS first_message_at
  FROM mensajes_whatsapp
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at ASC
), last_out AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    lower(coalesce(estado_envio, '')) AS out_estado
  FROM mensajes_whatsapp
  WHERE direccion = 'outbound'
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
)
SELECT l.id, l.nombre, l.telefono, l.pais, l.estado, l.bot_activo, l.archivado, l.tag_ids,
  a.last_message_at AS last_message_at,   -- FECHA REAL del último mensaje (NULL si no hay)
  COALESCE(a.unread_count, 0)::integer AS unread_count,
  lm.last_message_text, lm.last_message_dir,
  fm.first_message_dir, fm.first_message_at,
  COALESCE(a.inbound_count, 0)::integer AS inbound_count,
  COALESCE(a.outbound_count, 0)::integer AS outbound_count,
  (fm.first_message_dir = 'outbound')::boolean AS is_ai_initiated,
  CASE
    WHEN lo.out_estado IN ('fallido', 'failed', 'error') THEN 'fallido'
    WHEN a.last_inbound_at IS NOT NULL
         AND (a.last_outbound_at IS NULL OR a.last_inbound_at >= a.last_outbound_at)
      THEN 'caliente'
    WHEN lo.out_estado IN ('leido', 'read', 'respondido') THEN 'tibio'
    WHEN lo.out_estado IN ('entregado', 'delivered', 'enviado', 'sent') THEN 'frio'
    ELSE 'sin_datos'
  END AS senal
FROM dedup_leads l
LEFT JOIN agg a ON a.phone_base = l.phone_key
LEFT JOIN last_msg lm ON lm.phone_base = l.phone_key
LEFT JOIN first_msg fm ON fm.phone_base = l.phone_key
LEFT JOIN last_out lo ON lo.phone_base = l.phone_key;

ALTER VIEW public.vista_inbox_contactos SET (security_invoker = true);
GRANT SELECT ON public.vista_inbox_contactos TO anon, authenticated;

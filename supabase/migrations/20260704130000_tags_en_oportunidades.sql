-- ============================================================
-- Etiquetas en el inbox de Oportunidades (2026-07-04)
-- vista_inbox_automatizacion expone tag_ids (join a leads_campana por teléfono
-- normalizado), para que el sidebar de Oportunidades muestre los mismos chips
-- de etiquetas que el inbox normal. Se añade tag_ids AL FINAL (CREATE OR REPLACE ok).
-- ============================================================

CREATE OR REPLACE VIEW public.vista_inbox_automatizacion AS
WITH msgs AS (
  SELECT * FROM public.vista_mensajes_automatizacion
),
agg AS (
  SELECT phone_key,
    max(created_at) AS last_message_at,
    count(*) AS total_mensajes,
    count(*) FILTER (WHERE direccion = 'inbound' AND leido IS DISTINCT FROM true) AS unread_count,
    max(dia_secuencia) AS ultimo_dia
  FROM msgs
  GROUP BY phone_key
),
last_msg AS (
  SELECT DISTINCT ON (phone_key)
    phone_key,
    contenido AS last_message_text,
    direccion AS last_message_dir,
    estado_envio AS ultimo_estado
  FROM msgs
  ORDER BY phone_key, created_at DESC
),
datos AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_key,
    telefono, nombre, pais, campaign_name
  FROM public.mensajes_automatizacion
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
),
tags AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_key,
    tag_ids
  FROM public.leads_campana
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), updated_at DESC NULLS LAST
)
SELECT
  d.telefono,
  d.nombre,
  d.pais,
  d.campaign_name,
  a.last_message_at,
  lm.last_message_text,
  lm.last_message_dir,
  a.unread_count::integer AS unread_count,
  lm.ultimo_estado,
  a.ultimo_dia AS ultimo_dia,
  a.total_mensajes::integer AS total_mensajes,
  t.tag_ids
FROM agg a
JOIN datos d ON d.phone_key = a.phone_key
JOIN last_msg lm ON lm.phone_key = a.phone_key
LEFT JOIN tags t ON t.phone_key = a.phone_key;

ALTER VIEW public.vista_inbox_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_inbox_automatizacion TO anon, authenticated;

-- =====================================================================
-- Mario pidió que el chat de Reactivación (/inbox, mensajes_whatsapp)
-- arranque "vacío" para los leads existentes: esta base se reutiliza para
-- una campaña y una empresa nueva, así que el historial de mensajes de
-- ANTES de hoy ya no debe verse ni en la conversación ni en la vista
-- previa de la lista de contactos.
--
-- Aclarado con Mario: OCULTAR, no borrar. Los mensajes viejos siguen en
-- la tabla mensajes_whatsapp intactos; estas dos vistas (compartidas por
-- /inbox admin y la pestaña Reactivación del vendedor) simplemente dejan
-- de considerarlos. Revertir esto en el futuro es solo sacar el WHERE.
--
-- Corte: 2026-08-21 00:00:00 UTC (inicio del día de hoy según now() de
-- la base). Mensajes desde ese instante en adelante se siguen viendo
-- normal; todo lo anterior queda oculto (no borrado) en ambas vistas.
-- =====================================================================

CREATE OR REPLACE VIEW public.vista_mensajes_whatsapp AS
SELECT DISTINCT ON (
  regexp_replace(m.telefono, '[^0-9]', '', 'g'),
  m.direccion,
  left(m.contenido, 200),
  (extract(epoch from m.created_at) / 30)::bigint
)
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_whatsapp m
WHERE m.created_at >= '2026-08-21 00:00:00+00'::timestamptz
ORDER BY
  regexp_replace(m.telefono, '[^0-9]', '', 'g'),
  m.direccion,
  left(m.contenido, 200),
  (extract(epoch from m.created_at) / 30)::bigint,
  (m.wamid IS NULL) ASC,
  m.created_at ASC;

ALTER VIEW public.vista_mensajes_whatsapp SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_whatsapp TO anon, authenticated;

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
  WHERE created_at >= '2026-08-21 00:00:00+00'::timestamptz
  GROUP BY regexp_replace(telefono, '[^0-9]', '', 'g')
), last_msg AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    contenido AS last_message_text, direccion AS last_message_dir
  FROM mensajes_whatsapp
  WHERE created_at >= '2026-08-21 00:00:00+00'::timestamptz
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
), first_msg AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    direccion AS first_message_dir, created_at AS first_message_at
  FROM mensajes_whatsapp
  WHERE created_at >= '2026-08-21 00:00:00+00'::timestamptz
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at ASC
), last_out AS (
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_base,
    lower(coalesce(estado_envio, '')) AS out_estado
  FROM mensajes_whatsapp
  WHERE direccion = 'outbound' AND created_at >= '2026-08-21 00:00:00+00'::timestamptz
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
)
SELECT l.id, l.nombre, l.telefono, l.pais, l.estado, l.bot_activo, l.archivado, l.tag_ids,
  a.last_message_at AS last_message_at,
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

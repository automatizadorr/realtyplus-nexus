-- ============================================================
-- vista_inbox_contactos: join lead↔mensajes NORMALIZADO por dígitos (2026-06-25)
--
-- Antes el join era `split_part(mensajes.telefono,'@',1) = leads_campana.telefono`
-- (comparación EXACTA). Si el telefono del lead tenía '+', espacios u otro formato,
-- los mensajes NO se enganchaban → el lead aparecía SIN conversación.
--
-- Ahora ambos lados se normalizan a SOLO DÍGITOS con regexp_replace(...,'[^0-9]','').
-- Así un lead con '+59176702008' engancha con mensajes guardados como '59176702008'
-- (wa_id) o '59176702008@s.whatsapp.net'.
--
-- Las columnas de salida son idénticas (mismo orden) → CREATE OR REPLACE es seguro.
-- Idempotente y repetible. Aplicar en el SQL Editor del dashboard.
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
)
SELECT l.id, l.nombre, l.telefono, l.pais, l.estado, l.bot_activo, l.archivado, l.tag_ids,
  COALESCE(a.last_message_at, l.updated_at) AS last_message_at,
  COALESCE(a.unread_count, 0)::integer AS unread_count,
  lm.last_message_text, lm.last_message_dir,
  fm.first_message_dir, fm.first_message_at,
  COALESCE(a.inbound_count, 0)::integer AS inbound_count,
  COALESCE(a.outbound_count, 0)::integer AS outbound_count,
  (fm.first_message_dir = 'outbound')::boolean AS is_ai_initiated
FROM dedup_leads l
LEFT JOIN agg a ON a.phone_base = l.phone_key
LEFT JOIN last_msg lm ON lm.phone_base = l.phone_key
LEFT JOIN first_msg fm ON fm.phone_base = l.phone_key;

ALTER VIEW public.vista_inbox_contactos SET (security_invoker = true);
GRANT SELECT ON public.vista_inbox_contactos TO anon, authenticated;

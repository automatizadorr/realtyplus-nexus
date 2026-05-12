-- 1) Índices para acelerar mensajes por teléfono y unread
CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_tel_norm_created
  ON public.mensajes_whatsapp (split_part(telefono, '@', 1), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_tel_norm_unread
  ON public.mensajes_whatsapp (split_part(telefono, '@', 1))
  WHERE direccion = 'inbound' AND leido = false;

CREATE INDEX IF NOT EXISTS idx_mensajes_whatsapp_telefono
  ON public.mensajes_whatsapp (telefono);

-- 2) Índices para leads_campana (paginación + filtros)
CREATE INDEX IF NOT EXISTS idx_leads_campana_archivado_nombre
  ON public.leads_campana (archivado, nombre);

CREATE INDEX IF NOT EXISTS idx_leads_campana_archivado_updated
  ON public.leads_campana (archivado, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_campana_telefono
  ON public.leads_campana (telefono);

CREATE INDEX IF NOT EXISTS idx_leads_campana_bot_activo
  ON public.leads_campana (bot_activo);

CREATE INDEX IF NOT EXISTS idx_leads_campana_tag_ids
  ON public.leads_campana USING GIN (tag_ids);

-- 3) Vista materializada lógica (no MV) que une leads + agregados de mensajes
DROP VIEW IF EXISTS public.vista_inbox_contactos;
CREATE VIEW public.vista_inbox_contactos
WITH (security_invoker = true)
AS
WITH dedup_leads AS (
  SELECT DISTINCT ON (telefono)
    id, nombre, telefono, pais, estado, bot_activo, archivado, tag_ids, updated_at
  FROM public.leads_campana
  ORDER BY telefono, updated_at DESC NULLS LAST
),
agg AS (
  SELECT
    split_part(telefono, '@', 1) AS phone_base,
    MAX(created_at) AS last_message_at,
    COUNT(*) FILTER (WHERE direccion = 'inbound' AND leido = false) AS unread_count
  FROM public.mensajes_whatsapp
  GROUP BY split_part(telefono, '@', 1)
),
last_msg AS (
  SELECT DISTINCT ON (split_part(telefono, '@', 1))
    split_part(telefono, '@', 1) AS phone_base,
    contenido AS last_message_text,
    direccion AS last_message_dir
  FROM public.mensajes_whatsapp
  ORDER BY split_part(telefono, '@', 1), created_at DESC
)
SELECT
  l.id,
  l.nombre,
  l.telefono,
  l.pais,
  l.estado,
  l.bot_activo,
  l.archivado,
  l.tag_ids,
  COALESCE(a.last_message_at, l.updated_at) AS last_message_at,
  COALESCE(a.unread_count, 0)::int AS unread_count,
  lm.last_message_text,
  lm.last_message_dir
FROM dedup_leads l
LEFT JOIN agg a ON a.phone_base = l.telefono
LEFT JOIN last_msg lm ON lm.phone_base = l.telefono;

GRANT SELECT ON public.vista_inbox_contactos TO authenticated, anon;
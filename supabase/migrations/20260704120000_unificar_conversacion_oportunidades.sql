-- ============================================================
-- Unificar conversación en Oportunidades (2026-07-04)
--
-- iSabel (flujo n8n) escribe cada mensaje en DOS tablas: mensajes_automatizacion
-- y mensajes_whatsapp. Eso hacía que el mismo mensaje apareciera en Oportunidades
-- Y en el Inbox normal, y que Oportunidades mostrara conversaciones incompletas.
--
-- SOLUCIÓN (sin tocar n8n): las vistas de Oportunidades unen ambas tablas y
-- DE-DUPLICAN (mismo phone_key + direccion + contenido dentro de 15s = 1 solo).
-- SCOPE: solo se traen mensajes de mensajes_whatsapp para teléfonos que YA existen
-- en mensajes_automatizacion (contactos que ya son "oportunidad"), para NO meter
-- contactos de puras campañas.
-- ============================================================

DROP VIEW IF EXISTS public.vista_inbox_automatizacion;
DROP VIEW IF EXISTS public.vista_mensajes_automatizacion;

-- 1) Hilo de mensajes unificado + de-duplicado --------------------------------
CREATE VIEW public.vista_mensajes_automatizacion AS
WITH oportunidad_phones AS (
  SELECT DISTINCT regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_key
  FROM public.mensajes_automatizacion
),
union_msgs AS (
  SELECT
    a.id::text AS id,
    a.telefono,
    regexp_replace(a.telefono, '[^0-9]', '', 'g') AS phone_key,
    a.contenido,
    a.direccion,
    a.created_at,
    a.leido,
    a.campaign_name,
    a.dia_secuencia,
    a.estado_envio,
    NULL::text AS media_url,
    NULL::text AS media_type,
    'automatizacion'::text AS fuente
  FROM public.mensajes_automatizacion a
  UNION ALL
  SELECT
    w.id::text AS id,
    w.telefono,
    regexp_replace(w.telefono, '[^0-9]', '', 'g') AS phone_key,
    w.contenido,
    w.direccion,
    w.created_at,
    w.leido,
    NULL::text AS campaign_name,
    NULL::integer AS dia_secuencia,
    NULL::text AS estado_envio,
    w.media_url,
    w.media_type,
    'whatsapp'::text AS fuente
  FROM public.mensajes_whatsapp w
  WHERE regexp_replace(w.telefono, '[^0-9]', '', 'g') IN (SELECT phone_key FROM oportunidad_phones)
),
marcado AS (
  SELECT *,
    LAG(created_at) OVER (
      PARTITION BY phone_key, direccion, contenido
      ORDER BY created_at, fuente
    ) AS prev_at
  FROM union_msgs
)
SELECT id, telefono, phone_key, contenido, direccion, created_at, leido,
       campaign_name, dia_secuencia, estado_envio, media_url, media_type
FROM marcado
WHERE prev_at IS NULL OR (created_at - prev_at) > interval '15 seconds';

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

-- 2) Lista del inbox (una fila por teléfono) ----------------------------------
CREATE VIEW public.vista_inbox_automatizacion AS
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
datos AS (  -- nombre/pais/campaign/telefono desde mensajes_automatizacion (whatsapp no los tiene)
  SELECT DISTINCT ON (regexp_replace(telefono, '[^0-9]', '', 'g'))
    regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_key,
    telefono, nombre, pais, campaign_name
  FROM public.mensajes_automatizacion
  ORDER BY regexp_replace(telefono, '[^0-9]', '', 'g'), created_at DESC
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
  a.total_mensajes::integer AS total_mensajes
FROM agg a
JOIN datos d ON d.phone_key = a.phone_key
JOIN last_msg lm ON lm.phone_key = a.phone_key;

ALTER VIEW public.vista_inbox_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_inbox_automatizacion TO anon, authenticated;

-- 3) Marcar leído en AMBAS tablas por phone_key -------------------------------
-- (la conversación ahora vive en las dos; hay que marcar leído en ambas)
CREATE OR REPLACE FUNCTION public.marcar_leidos_conversacion(p_phone_key text)
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  WITH a AS (
    UPDATE public.mensajes_automatizacion SET leido = true
    WHERE regexp_replace(telefono, '[^0-9]', '', 'g') = p_phone_key
      AND direccion = 'inbound' AND leido IS DISTINCT FROM true
    RETURNING 1
  ), w AS (
    UPDATE public.mensajes_whatsapp SET leido = true
    WHERE regexp_replace(telefono, '[^0-9]', '', 'g') = p_phone_key
      AND direccion = 'inbound' AND leido IS DISTINCT FROM true
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM a) + (SELECT count(*) FROM w);
$$;

GRANT EXECUTE ON FUNCTION public.marcar_leidos_conversacion(text) TO anon, authenticated;

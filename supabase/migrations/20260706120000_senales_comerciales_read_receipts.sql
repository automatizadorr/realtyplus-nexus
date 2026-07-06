-- ============================================================
-- Señales comerciales por acuses de WhatsApp (Read Receipts — Capa 3)
-- 2026-07-06
--
-- WhatsApp Cloud API entrega el estado de cada mensaje saliente
-- (sent → delivered → read → failed). La Capa 2 (n8n, flujo Sofía)
-- persiste ese estado en mensajes_automatizacion.estado_envio.
-- Esta capa lo convierte en una SEÑAL COMERCIAL por lead para que
-- el equipo trabaje por temperatura y no al azar:
--
--   🟢 caliente  → el lead RESPONDIÓ (su último mensaje es posterior
--                  al nuestro): la pelota está en nuestro lado, llamar.
--   🟡 tibio     → leyó el último mensaje pero NO respondió: insistir.
--   ⚪ frio      → entregado/enviado pero aún no leído: dejar en automático.
--   🔴 fallido   → el último envío falló: número malo / bloqueado.
--   (sin_datos)  → no hay saliente con estado conocido.
--
-- Se añade la columna `senal` a vista_inbox_automatizacion. El estado
-- se normaliza para aceptar tanto los valores en español ya usados
-- (enviado/respondido/fallido) como los de WhatsApp (sent/delivered/
-- read/failed) que llegan por la Capa 2 — forward-compatible.
-- ============================================================

DROP VIEW IF EXISTS public.vista_inbox_automatizacion;

CREATE VIEW public.vista_inbox_automatizacion AS
WITH msgs AS (
  SELECT * FROM public.vista_mensajes_automatizacion
),
agg AS (
  SELECT phone_key,
    max(created_at) AS last_message_at,
    max(created_at) FILTER (WHERE direccion = 'inbound')  AS last_inbound_at,
    max(created_at) FILTER (WHERE direccion = 'outbound') AS last_outbound_at,
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
last_out AS (  -- estado del ÚLTIMO mensaje saliente (para la señal)
  SELECT DISTINCT ON (phone_key)
    phone_key,
    lower(coalesce(estado_envio, '')) AS out_estado
  FROM msgs
  WHERE direccion = 'outbound'
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
  a.total_mensajes::integer AS total_mensajes,
  -- Señal comercial (semáforo)
  CASE
    WHEN lo.out_estado IN ('fallido', 'failed', 'error') THEN 'fallido'
    WHEN a.last_inbound_at IS NOT NULL
         AND (a.last_outbound_at IS NULL OR a.last_inbound_at >= a.last_outbound_at)
      THEN 'caliente'
    WHEN lo.out_estado IN ('leido', 'read', 'respondido') THEN 'tibio'
    WHEN lo.out_estado IN ('entregado', 'delivered', 'enviado', 'sent') THEN 'frio'
    ELSE 'sin_datos'
  END AS senal
FROM agg a
JOIN datos d ON d.phone_key = a.phone_key
JOIN last_msg lm ON lm.phone_key = a.phone_key
LEFT JOIN last_out lo ON lo.phone_key = a.phone_key;

ALTER VIEW public.vista_inbox_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_inbox_automatizacion TO anon, authenticated;

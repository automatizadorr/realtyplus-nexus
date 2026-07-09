-- ============================================================
-- Oportunidades: incluir inbound de mensajes_whatsapp (2026-07-08)
--
-- PROBLEMA: cuando un lead de Oportunidades responde por WhatsApp,
-- el flujo de Sofía guarda el inbound en mensajes_whatsapp (tabla de
-- Reactivación), no en mensajes_automatizacion. La vista solo leía
-- mensajes_automatizacion → esos leads aparecían sin respuesta.
--
-- FIX: la vista hace UNION con los inbound de mensajes_whatsapp
-- cuyo phone_key ya existe en mensajes_automatizacion (= son
-- contactos de Oportunidades). Se deduplica por contenido+tiempo.
--
-- ORDENAMIENTO: en lugar de `seq` (índice de tabla independiente
-- por tabla, no comparable entre las dos), la vista expone `sort_ts`
-- (timestamptz). Para inbound: MIN(outbound del cluster) - 1μs →
-- el lead siempre aparece antes de la respuesta del bot.
-- El frontend ordena por sort_ts en vez de seq.
-- ============================================================

CREATE OR REPLACE VIEW public.vista_mensajes_automatizacion AS
WITH oportunidad_phones AS (
  SELECT DISTINCT regexp_replace(telefono, '[^0-9]', '', 'g') AS phone_key
  FROM public.mensajes_automatizacion
),
all_msgs AS (
  -- Todos los mensajes de mensajes_automatizacion
  SELECT
    a.id::text                                             AS id,
    a.telefono,
    regexp_replace(a.telefono, '[^0-9]', '', 'g')         AS phone_key,
    a.contenido,
    a.direccion,
    a.created_at,
    a.leido,
    a.campaign_name,
    a.dia_secuencia,
    a.estado_envio,
    NULL::text                                             AS media_url,
    NULL::text                                             AS media_type,
    a.seq
  FROM public.mensajes_automatizacion a

  UNION ALL

  -- Inbound de mensajes_whatsapp para contactos de Oportunidades
  -- que no están ya duplicados en mensajes_automatizacion
  SELECT
    w.id::text,
    w.telefono,
    regexp_replace(w.telefono, '[^0-9]', '', 'g'),
    w.contenido,
    w.direccion,
    w.created_at,
    w.leido,
    NULL::text, NULL::integer, NULL::text,
    w.media_url,
    w.media_type,
    NULL::bigint
  FROM public.mensajes_whatsapp w
  WHERE w.direccion = 'inbound'
    AND regexp_replace(w.telefono, '[^0-9]', '', 'g')
          IN (SELECT phone_key FROM oportunidad_phones)
    -- Dedup: evitar duplicar si ya existe el mismo contenido en auto
    AND NOT EXISTS (
      SELECT 1 FROM public.mensajes_automatizacion a2
      WHERE regexp_replace(a2.telefono, '[^0-9]', '', 'g')
              = regexp_replace(w.telefono, '[^0-9]', '', 'g')
        AND a2.contenido = w.contenido
        AND a2.direccion = 'inbound'
        AND abs(extract(epoch from (a2.created_at - w.created_at))) < 30
    )
)
SELECT
  id,
  telefono,
  phone_key,
  contenido,
  direccion,
  created_at,
  leido,
  campaign_name,
  dia_secuencia,
  estado_envio,
  media_url,
  media_type,
  seq,
  -- sort_ts: timestamp de ordenamiento correcto para el chat.
  -- Inbound → MIN(outbound del mismo cluster sin inbound intermedio) - 1μs
  -- Outbound → created_at sin cambios
  CASE
    WHEN direccion = 'inbound' THEN
      COALESCE(
        (
          SELECT MIN(o.created_at) - interval '1 microsecond'
          FROM public.mensajes_automatizacion o
          WHERE regexp_replace(o.telefono, '[^0-9]', '', 'g') = all_msgs.phone_key
            AND o.direccion = 'outbound'
            AND o.created_at < all_msgs.created_at
            AND (all_msgs.created_at - o.created_at) <= interval '120 seconds'
            -- Sin inbound de automatizacion entre el outbound y el nuestro
            AND NOT EXISTS (
              SELECT 1 FROM public.mensajes_automatizacion i2
              WHERE regexp_replace(i2.telefono, '[^0-9]', '', 'g') = all_msgs.phone_key
                AND i2.direccion = 'inbound'
                AND i2.created_at > o.created_at
                AND i2.created_at < all_msgs.created_at
            )
            -- Sin inbound de whatsapp entre el outbound y el nuestro
            AND NOT EXISTS (
              SELECT 1 FROM public.mensajes_whatsapp iw
              WHERE regexp_replace(iw.telefono, '[^0-9]', '', 'g') = all_msgs.phone_key
                AND iw.direccion = 'inbound'
                AND iw.created_at > o.created_at
                AND iw.created_at < all_msgs.created_at
            )
        ),
        all_msgs.created_at
      )
    ELSE all_msgs.created_at
  END AS sort_ts

FROM all_msgs;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

-- vista_inbox_automatizacion lee de vista_mensajes_automatizacion via CTE
-- → se actualiza automáticamente con los nuevos inbound visibles.
-- No necesita recrearse.

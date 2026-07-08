-- ============================================================
-- Fix de orden conversacional v2 (2026-07-08)
--
-- PROBLEMA DEL FIX ANTERIOR (20260708240000):
-- Usaba el outbound MÁS RECIENTE (MAX) como ancla del inbound.
-- Cuando el bot manda 3 mensajes seguidos antes de que el inbound
-- quede guardado, el inbound quedaba en MEDIO del cluster:
--   Bot1, Bot2, Juan, Bot3  ← incorrecto
--
-- FIX MEJORADO: usar el outbound MÁS ANTIGUO (MIN) del cluster,
-- donde "cluster" = outbounds consecutivos sin ningún inbound
-- intermedio (es decir, todos pertenecen al mismo turno del bot).
--
-- Resultado correcto:
--   Juan, Bot1, Bot2, Bot3  ← el lead siempre precede la respuesta
--
-- La condición NOT EXISTS excluye outbounds de turnos anteriores
-- (cuando hay otro inbound entre ese outbound y el nuestro).
-- ============================================================

-- mensajes_whatsapp (Reactivación / Sofía)
WITH effective AS (
  SELECT
    m.id,
    CASE
      WHEN m.direccion = 'inbound' THEN
        COALESCE(
          (
            SELECT MIN(o.created_at) - interval '1 microsecond'
            FROM public.mensajes_whatsapp o
            WHERE regexp_replace(o.telefono, '[^0-9]', '', 'g')
                = regexp_replace(m.telefono, '[^0-9]', '', 'g')
              AND o.direccion = 'outbound'
              AND o.created_at < m.created_at
              AND (m.created_at - o.created_at) <= interval '120 seconds'
              -- Solo outbounds sin ningún inbound entre ellos y el nuestro
              -- (pertenecen al mismo cluster de respuesta del bot)
              AND NOT EXISTS (
                SELECT 1
                FROM public.mensajes_whatsapp i2
                WHERE regexp_replace(i2.telefono, '[^0-9]', '', 'g')
                    = regexp_replace(m.telefono, '[^0-9]', '', 'g')
                  AND i2.direccion = 'inbound'
                  AND i2.id <> m.id
                  AND i2.created_at > o.created_at
                  AND i2.created_at < m.created_at
              )
          ),
          m.created_at
        )
      ELSE m.created_at
    END AS effective_at
  FROM public.mensajes_whatsapp m
),
ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY effective_at ASC, id ASC) AS new_seq
  FROM effective
)
UPDATE public.mensajes_whatsapp m
SET seq = r.new_seq
FROM ranked r
WHERE m.id = r.id;

-- mensajes_automatizacion (Oportunidades / iSabel)
WITH effective AS (
  SELECT
    m.id,
    CASE
      WHEN m.direccion = 'inbound' THEN
        COALESCE(
          (
            SELECT MIN(o.created_at) - interval '1 microsecond'
            FROM public.mensajes_automatizacion o
            WHERE regexp_replace(o.telefono, '[^0-9]', '', 'g')
                = regexp_replace(m.telefono, '[^0-9]', '', 'g')
              AND o.direccion = 'outbound'
              AND o.created_at < m.created_at
              AND (m.created_at - o.created_at) <= interval '120 seconds'
              AND NOT EXISTS (
                SELECT 1
                FROM public.mensajes_automatizacion i2
                WHERE regexp_replace(i2.telefono, '[^0-9]', '', 'g')
                    = regexp_replace(m.telefono, '[^0-9]', '', 'g')
                  AND i2.direccion = 'inbound'
                  AND i2.id <> m.id
                  AND i2.created_at > o.created_at
                  AND i2.created_at < m.created_at
              )
          ),
          m.created_at
        )
      ELSE m.created_at
    END AS effective_at
  FROM public.mensajes_automatizacion m
),
ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY effective_at ASC, id ASC) AS new_seq
  FROM effective
)
UPDATE public.mensajes_automatizacion m
SET seq = r.new_seq
FROM ranked r
WHERE m.id = r.id;

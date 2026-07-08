-- ============================================================
-- Fix de orden conversacional (2026-07-08)
--
-- PROBLEMA RAÍZ: el flujo n8n de Sofía guarda el mensaje OUTBOUND
-- (respuesta del bot) con NOW() ANTES de guardar el mensaje INBOUND
-- (pregunta del lead). Resultado: outbound.created_at < inbound.created_at
-- aunque el lead preguntó primero.
--
-- Ejemplo real (José Emilio Guzmán):
--   16:54:52 outbound — "Claro, José Emilio. Tenemos 3 modelos..."
--   16:54:55 inbound  — "Hola, quisiera saber cuánto sería la inversión"
--
-- ORDER BY created_at pone el outbound primero → conversación invertida.
--
-- FIX: re-numerar seq asignando a cada inbound un "effective_at" =
-- outbound.created_at - 1μs cuando hay un outbound previo dentro de
-- 120 segundos en la misma conversación. Así el inbound (la pregunta)
-- aparece siempre antes que la respuesta del bot.
-- ============================================================

-- mensajes_whatsapp (Reactivación / Sofía)
WITH effective AS (
  SELECT
    m.id,
    CASE
      WHEN m.direccion = 'inbound' THEN
        COALESCE(
          (
            SELECT o.created_at - interval '1 microsecond'
            FROM public.mensajes_whatsapp o
            WHERE regexp_replace(o.telefono, '[^0-9]', '', 'g')
                = regexp_replace(m.telefono, '[^0-9]', '', 'g')
              AND o.direccion = 'outbound'
              AND o.created_at < m.created_at
              AND (m.created_at - o.created_at) <= interval '120 seconds'
            ORDER BY o.created_at DESC
            LIMIT 1
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
            SELECT o.created_at - interval '1 microsecond'
            FROM public.mensajes_automatizacion o
            WHERE regexp_replace(o.telefono, '[^0-9]', '', 'g')
                = regexp_replace(m.telefono, '[^0-9]', '', 'g')
              AND o.direccion = 'outbound'
              AND o.created_at < m.created_at
              AND (m.created_at - o.created_at) <= interval '120 seconds'
            ORDER BY o.created_at DESC
            LIMIT 1
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

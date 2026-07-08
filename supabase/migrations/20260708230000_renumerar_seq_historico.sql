-- ============================================================
-- Re-numeración de seq para datos históricos (2026-07-08)
--
-- PROBLEMA: El BIGSERIAL asignó seq en orden de almacenamiento
-- físico (ctid), que difiere del orden de inserción real cuando
-- hubo updates (ej. leido=true mueve filas en el heap).
-- Además, n8n guarda el timestamp de WhatsApp (segundos Unix)
-- como created_at de los mensajes inbound → varios mensajes
-- del mismo segundo sin tiebreaker confiable.
--
-- FIX: re-asignar seq con ROW_NUMBER usando la mejor heurística:
--   1. created_at ASC   → mensajes de distintos segundos: correcto
--   2. direccion ASC    → 'inbound' < 'outbound': el lead habla
--                         primero, el bot responde después
--   3. id ASC           → desempate determinístico (UUID, no
--                         cronológico, pero al menos estable)
--
-- Esto corrige el orden de conversaciones existentes lo mejor
-- posible sin información adicional de inserción.
-- ============================================================

-- mensajes_whatsapp (Reactivación)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY created_at ASC,
               direccion ASC,   -- inbound < outbound
               id        ASC
    ) AS new_seq
  FROM public.mensajes_whatsapp
)
UPDATE public.mensajes_whatsapp m
SET seq = r.new_seq
FROM ranked r
WHERE m.id = r.id;

-- mensajes_automatizacion (Oportunidades)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY created_at ASC,
               direccion ASC,
               id        ASC
    ) AS new_seq
  FROM public.mensajes_automatizacion
)
UPDATE public.mensajes_automatizacion m
SET seq = r.new_seq
FROM ranked r
WHERE m.id = r.id;

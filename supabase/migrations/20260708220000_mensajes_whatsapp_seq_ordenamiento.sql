-- ============================================================
-- Fix de ordenamiento de mensajes_whatsapp (2026-07-08)
--
-- Mismo problema que mensajes_automatizacion: created_at tiene
-- precisión de segundos, id es UUID v4 (random) → sin tiebreaker
-- monotónico el orden dentro del mismo segundo es arbitrario.
--
-- FIX: seq BIGSERIAL en mensajes_whatsapp + recrear
-- vista_mensajes_whatsapp para exponer la columna nueva.
-- (SELECT m.* en la vista congela las columnas al crearse;
-- hay que DROP+CREATE para que incluya seq.)
-- ============================================================

-- 1. Columna de secuencia
ALTER TABLE public.mensajes_whatsapp
  ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

-- 2. Recrear la vista con las columnas actualizadas
DROP VIEW IF EXISTS public.vista_mensajes_whatsapp;

CREATE VIEW public.vista_mensajes_whatsapp AS
SELECT
  m.*,
  regexp_replace(m.telefono, '[^0-9]', '', 'g') AS phone_key
FROM public.mensajes_whatsapp m;

ALTER VIEW public.vista_mensajes_whatsapp SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_whatsapp TO anon, authenticated;

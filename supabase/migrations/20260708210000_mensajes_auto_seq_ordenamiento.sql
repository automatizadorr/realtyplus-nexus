-- ============================================================
-- Fix de ordenamiento de mensajes_automatizacion (2026-07-08)
--
-- PROBLEMA: created_at tiene precisión de segundos. n8n puede
-- insertar varios mensajes dentro del mismo segundo, y sin un
-- tiebreaker monotónico el orden es arbitrario → mensajes del
-- mismo minuto aparecen desordenados en el chat de Oportunidades.
--
-- FIX: añadir seq BIGSERIAL (auto-increment, sin tocar n8n).
-- PostgreSQL asigna valores en orden de inserción física para
-- las filas existentes y en orden estricto para las nuevas.
-- Se expone en vista_mensajes_automatizacion y se usa en el
-- frontend como segundo criterio de ordenamiento.
-- ============================================================

-- 1. Columna de secuencia
ALTER TABLE public.mensajes_automatizacion
  ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

-- 2. Recrear la vista exponiendo seq
CREATE OR REPLACE VIEW public.vista_mensajes_automatizacion AS
SELECT
  a.id::text                                               AS id,
  a.telefono,
  regexp_replace(a.telefono, '[^0-9]', '', 'g')           AS phone_key,
  a.contenido,
  a.direccion,
  a.created_at,
  a.leido,
  a.campaign_name,
  a.dia_secuencia,
  a.estado_envio,
  NULL::text                                               AS media_url,
  NULL::text                                               AS media_type,
  a.seq                                                    AS seq
FROM public.mensajes_automatizacion a;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

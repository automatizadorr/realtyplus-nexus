-- ============================================================
-- Etiqueta de respaldo "Sin respuesta clara" (2026-06-24)
-- Objetivo: estado de ciclo de vida para leads que etiquetar-ia
-- procesó pero a los que DeepSeek NO encontró señal suficiente para
-- clasificar. En vez de quedar SIN etiqueta, se les asigna ésta para
-- que TODOS los leads queden etiquetados.
--
-- A diferencia de "Sigue en campaña", SÍ se envía a expansión
-- (no está en la lista de exclusión del cron) → jefatura los revisa
-- manualmente. Es parte del grupo exclusivo estado_lead en tag-lead,
-- así que se reemplaza en cuanto el lead dé una señal real.
--
-- Idempotente: nombre es UNIQUE, el upsert es seguro y repetible.
-- ============================================================

INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('Sin respuesta clara', '#f59e0b', true)
ON CONFLICT (nombre)
  DO UPDATE SET color = EXCLUDED.color, es_permanente = true;

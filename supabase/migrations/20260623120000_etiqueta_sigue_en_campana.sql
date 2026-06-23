-- ============================================================
-- Etiqueta permanente "Sigue en campaña" (2026-06-23)
-- Objetivo: estado de ciclo de vida para leads que AÚN NO han
-- contestado. Mientras el lead la tenga, sigue en campaña y NO se
-- envía a expansión. Cuando conteste, etiquetar-ia (grupo exclusivo
-- estado_lead) la reemplaza por el estado real → se envía a expansión.
--
-- Distinta de "No interesa", que recupera su sentido literal:
-- el lead RECHAZÓ / pidió no ser contactado.
--
-- Idempotente: nombre es UNIQUE, el upsert es seguro y repetible.
-- ============================================================

INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('Sigue en campaña', '#64748b', true)
ON CONFLICT (nombre)
  DO UPDATE SET color = EXCLUDED.color, es_permanente = true;

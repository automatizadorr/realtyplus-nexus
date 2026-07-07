-- =====================================================================
-- 6 ETIQUETAS PERMANENTES de situación del lead (2026-07-07)
-- Fuente: documento "TRATAMIENTO DE LEADS EN CHAT IA".
-- ---------------------------------------------------------------------
-- Reemplazan a los 9 segmentos de clasificación IA. Las 9 viejas NO se borran
-- (quedan inactivas: el clasificador deja de asignarlas). Los acuses/semáforo NO
-- se tocan.
--
-- Las 6 situaciones (grupo `situacion_lead`, mutuamente excluyentes):
--   1. Quiere info, no concreta cita      → apartado Gestionado
--   2. Cita agendada        (se reutiliza)→ apartado Gestionado
--   3. Pide info, conversación inacabada  → apartado Gestionado
--   4. Pide info, no es el momento        → apartado Gestionado
--   5. No interesa          (se reutiliza)→ apartado Gestionado   [ROJO]
--   6. Sigue en campaña     (se reutiliza)→ sigue EN CAMPAÑA (chat IA activo)
--
-- "Gestionado" es una etiqueta companion que el clasificador añade a las
-- situaciones 1–5 (la 6 conserva "Sigue en campaña"). Reutilizamos
-- Cita agendada / No interesa / Sigue en campaña (ya viven en estado_lead) para
-- no duplicar conceptos del ciclo de vida.
--
-- Idempotente: `nombre` es UNIQUE. Aplicar en el SQL Editor.
-- =====================================================================

-- Etiquetas NUEVAS (situaciones 1,3,4 + companion Gestionado)
INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('Quiere info, no concreta cita',      '#0ea5e9', true),
  ('Pide info, conversación inacabada',  '#f59e0b', true),
  ('Pide info, no es el momento',        '#f97316', true),
  ('Gestionado',                         '#6366f1', true)
ON CONFLICT (nombre) DO NOTHING;

-- Situaciones que se REUTILIZAN (por si no existieran en algún entorno)
INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('Cita agendada',    '#8b5cf6', true),
  ('No interesa',      '#ef4444', true),
  ('Sigue en campaña', '#94a3b8', true)
ON CONFLICT (nombre) DO NOTHING;

-- Situación 5: "No interesa" debe ir en ROJO.
UPDATE public.lead_tags SET color = '#ef4444' WHERE nombre = 'No interesa';

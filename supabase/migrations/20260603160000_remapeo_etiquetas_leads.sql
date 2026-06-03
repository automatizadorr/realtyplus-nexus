-- ============================================================
-- Remapeo de etiquetas de leads según Excel exportado (2026-06-03)
-- Matching por teléfono normalizado (solo dígitos).
-- SET tag_ids reemplaza completamente las etiquetas previas del lead.
-- Idempotente: re-ejecutar produce el mismo resultado.
-- ============================================================

-- 1. Asegurar que las 6 etiquetas existen (idempotente por nombre)
INSERT INTO lead_tags (nombre, color)
SELECT v.nombre, v.color FROM (VALUES
  ('Seguimiento','#7c3aed'),
  ('Reunion Agendada Agente IA','#0d9488'),
  ('Agente Asignado','#cc0000'),
  ('a la espera de agendamiento (interesado)','#ea580c'),
  ('No volver a Contactar','#dc2626'),
  ('Solo interesado en propiedades','#2563eb')
) AS v(nombre, color)
WHERE NOT EXISTS (SELECT 1 FROM lead_tags lt WHERE lt.nombre = v.nombre);

-- 2. Remapear tag_ids por teléfono normalizado
WITH mapping(tel, etiquetas) AS (
  VALUES
    ('51949548249',  ARRAY['Seguimiento']),
    ('213557433909', ARRAY['Seguimiento']),
    ('212661353561', ARRAY['Seguimiento']),
    ('213696053834', ARRAY['Seguimiento']),
    ('59170673952',  ARRAY['No volver a Contactar']),
    ('59167467395',  ARRAY['No volver a Contactar']),
    ('59171155854',  ARRAY['No volver a Contactar']),
    ('59172061734',  ARRAY['No volver a Contactar']),
    ('59176400655',  ARRAY['No volver a Contactar']),
    ('212677158718', ARRAY['Seguimiento']),
    ('213778294909', ARRAY['Seguimiento']),
    ('593983011285', ARRAY['Seguimiento']),
    ('59174959929',  ARRAY['No volver a Contactar']),
    ('59172271147',  ARRAY['No volver a Contactar']),
    ('56971806730',  ARRAY['Reunion Agendada Agente IA']),
    ('59176606339',  ARRAY['No volver a Contactar']),
    ('59174609343',  ARRAY['No volver a Contactar']),
    ('59176004931',  ARRAY['Reunion Agendada Agente IA']),
    ('218927098698', ARRAY['a la espera de agendamiento (interesado)']),
    ('59178104770',  ARRAY['Reunion Agendada Agente IA']),
    ('13213487624',  ARRAY['Seguimiento']),
    ('41681298',     ARRAY['Seguimiento']),
    ('688619391',    ARRAY['Seguimiento']),
    ('635542074',    ARRAY['Seguimiento']),
    ('627082760',    ARRAY['Seguimiento']),
    ('666675578',    ARRAY['Seguimiento']),
    ('5544227389',   ARRAY['Seguimiento']),
    ('212642532964', ARRAY['No volver a Contactar']),
    ('213541692247', ARRAY['Seguimiento']),
    ('21652892164',  ARRAY['No volver a Contactar']),
    ('59160010997',  ARRAY['Agente Asignado','No volver a Contactar']),
    ('525613559003', ARRAY['Seguimiento']),
    ('212662117933', ARRAY['Seguimiento']),
    ('51949922176',  ARRAY['Seguimiento']),
    ('213770171163', ARRAY['Seguimiento']),
    ('201029999925', ARRAY['Seguimiento']),
    ('201212099632', ARRAY['Seguimiento']),
    ('21654161310',  ARRAY['Seguimiento']),
    ('919007200',    ARRAY['Seguimiento']),
    ('213663521008', ARRAY['Seguimiento']),
    ('59161558261',  ARRAY['Solo interesado en propiedades']),
    ('59163037644',  ARRAY['Reunion Agendada Agente IA','Solo interesado en propiedades']),
    ('59170028882',  ARRAY['Agente Asignado','No volver a Contactar']),
    ('59164194833',  ARRAY['Reunion Agendada Agente IA']),
    ('59170111530',  ARRAY['No volver a Contactar']),
    ('59162330687',  ARRAY['No volver a Contactar']),
    ('59169750857',  ARRAY['Agente Asignado','No volver a Contactar']),
    ('59167948591',  ARRAY['No volver a Contactar']),
    ('59165592293',  ARRAY['No volver a Contactar']),
    ('59168719417',  ARRAY['No volver a Contactar']),
    ('59162957753',  ARRAY['Reunion Agendada Agente IA','No volver a Contactar'])
),
resolved AS (
  SELECT regexp_replace(m.tel, '\D', '', 'g') AS tel_norm,
         array_agg(lt.id) AS tag_ids
  FROM mapping m
  CROSS JOIN LATERAL unnest(m.etiquetas) AS e(nombre)
  JOIN lead_tags lt ON lt.nombre = e.nombre
  GROUP BY 1
)
UPDATE leads_campana lc
SET tag_ids = r.tag_ids
FROM resolved r
WHERE regexp_replace(lc.telefono, '\D', '', 'g') = r.tel_norm;

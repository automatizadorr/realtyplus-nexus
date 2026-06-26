-- =====================================================================
-- Etiquetas de CLASIFICACIÓN IA - WhatsApp Segmentado (2026-06-25)
-- ---------------------------------------------------------------------
-- Set NUEVO de etiquetas, INDEPENDIENTE del grupo `estado_lead`. Lo usa el
-- clasificador `clasificar-whatsapp-ia` (grupo exclusivo `segmento_clasificacion`)
-- para enrutar cada lead al flujo n8n "Clasificacion IA - WhatsApp Segmentado"
-- (webhook /etiquetas-leads-nuevos), que manda un WhatsApp distinto por segmento.
--
-- Son 9 segmentos mutuamente excluyentes (un lead está en UNO a la vez):
--   Lead Caliente, Cita agendada, Interesado en Financiamiento, Listo para Cerrar,
--   Solo Consultando, Requiere Seguimiento IA, Conversación Activa,
--   Sin Respuesta al Bot, No interesa.
--
-- NOTA sobre solapes: "Cita agendada" y "No interesa" YA existen como `estado_lead`.
-- Son el MISMO concepto, así que se comparten (misma fila): el clasificador los
-- enruta por el grupo `estado_lead` y los 7 restantes por `segmento_clasificacion`
-- (ver clasificar-whatsapp-ia / tag-lead). Por eso el upsert es DO NOTHING: NUNCA
-- pisa el color/permanencia de etiquetas que ya existan.
--
-- "Sin Respuesta al Bot" es la etiqueta para cuando el bot/agente escribió pero el
-- LEAD nunca respondió: NO se envía al webhook (sigue en campaña, pendiente de que
-- el lead conteste), igual que "Sigue en campaña" en la expansión.
--
-- Idempotente: `nombre` es UNIQUE; ON CONFLICT DO NOTHING es seguro y repetible.
-- =====================================================================

INSERT INTO public.lead_tags (nombre, color, es_permanente) VALUES
  ('Lead Caliente',                 '#ef4444', true),
  ('Cita agendada',                 '#8b5cf6', true),
  ('Interesado en Financiamiento',  '#10b981', true),
  ('Listo para Cerrar',             '#f97316', true),
  ('Solo Consultando',              '#3b82f6', true),
  ('Requiere Seguimiento IA',       '#eab308', true),
  ('Conversación Activa',           '#06b6d4', true),
  ('Sin Respuesta al Bot',          '#94a3b8', true),
  ('No interesa',                   '#6b7280', true)
ON CONFLICT (nombre) DO NOTHING;

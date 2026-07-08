-- ============================================================
-- Separar limpiamente Reactivación y Oportunidades (2026-07-08)
--
-- PROBLEMA: vista_mensajes_automatizacion hacía UNION de mensajes_automatizacion
-- + mensajes_whatsapp (para phones que existen en automatizacion). Eso causaba:
--   1. Inbox Oportunidades mostraba mensajes de reactivación mezclados.
--   2. Inbox Reactivación no mostraba los mensajes entrantes del lead (iban a
--      mensajes_automatizacion por el flujo n8n, y no aparecían en whatsapp).
--
-- FIX: vista_mensajes_automatizacion muestra SOLO mensajes_automatizacion.
-- Cada inbox ve únicamente su propia tabla.
--   - Reactivación  → mensajes_whatsapp     → vista_inbox_contactos
--   - Oportunidades → mensajes_automatizacion → vista_inbox_automatizacion
--
-- vista_inbox_automatizacion (con senal, migración 20260706120000) NO se toca:
-- lee de vista_mensajes_automatizacion vía WITH, así que hereda este cambio.
--
-- PENDIENTE n8n (fix paralelo): en el flujo Sofía, los mensajes INBOUND de leads
-- de reactivación deben guardarse en mensajes_whatsapp (no en mensajes_automatizacion).
-- Ver instrucciones en la memoria del proyecto.
-- ============================================================

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
  -- media_url / media_type: columnas añadidas por migración 20260703120000
  -- Si aún no se aplicó, llegan NULL (el chat lo degrada sin error).
  NULL::text                                               AS media_url,
  NULL::text                                               AS media_type
FROM public.mensajes_automatizacion a;

ALTER VIEW public.vista_mensajes_automatizacion SET (security_invoker = true);
GRANT SELECT ON public.vista_mensajes_automatizacion TO anon, authenticated;

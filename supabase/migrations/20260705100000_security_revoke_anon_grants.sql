-- ============================================================
-- Seguridad: revocar accesos innecesarios al rol anon (2026-07-05)
--
-- Las funciones y vistas de inbox/oportunidades solo las usa el frontend
-- con un usuario autenticado. Otorgar acceso a anon amplía la superficie
-- de ataque innecesariamente (datos PII: nombres, teléfonos, mensajes).
--
-- Cambios:
--   1) marcar_leidos_conversacion(text) — solo authenticated (antes: anon + authenticated)
--   2) opciones_inbox_automatizacion() — solo authenticated (antes: anon + authenticated)
--   3) vista_inbox_automatizacion      — solo authenticated (antes: anon + authenticated)
--   4) vista_mensajes_automatizacion   — solo authenticated (antes: anon + authenticated)
-- ============================================================

-- 1. RPC marcar_leidos_conversacion
REVOKE EXECUTE ON FUNCTION public.marcar_leidos_conversacion(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.marcar_leidos_conversacion(text) TO authenticated;

-- 2. RPC opciones_inbox_automatizacion
REVOKE EXECUTE ON FUNCTION public.opciones_inbox_automatizacion() FROM anon;
GRANT  EXECUTE ON FUNCTION public.opciones_inbox_automatizacion() TO authenticated;

-- 3. Vista inbox (lista de conversaciones de oportunidades)
REVOKE SELECT ON public.vista_inbox_automatizacion FROM anon;
GRANT  SELECT ON public.vista_inbox_automatizacion TO authenticated;

-- 4. Vista mensajes (hilo de mensajes de oportunidades)
REVOKE SELECT ON public.vista_mensajes_automatizacion FROM anon;
GRANT  SELECT ON public.vista_mensajes_automatizacion TO authenticated;

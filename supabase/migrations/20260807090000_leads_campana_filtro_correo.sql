-- =====================================================================
-- Filtros de correo para leads de campaña (pestaña Reactivación)
-- ---------------------------------------------------------------------
-- Los filtros "Solo con correo enviado" / "Solo con correo NO enviado"
-- se resolvían antes trayendo todos los emails de correo_envios al
-- cliente y mandándolos de vuelta en la URL del GET (IN/NOT IN). Con
-- miles de filas la URL revienta (error 414 / objeto de error crudo).
-- Estas vistas resuelven el filtro en la base, con count exacto.
-- security_invoker: respeta RLS de leads_campana bajo el rol del llamante.
-- =====================================================================

CREATE OR REPLACE VIEW public.leads_campana_con_correo
WITH (security_invoker = on)
AS
  SELECT DISTINCT ON (l.id) l.*
  FROM public.leads_campana l
  JOIN public.correo_envios c ON lower(trim(c.email)) = lower(trim(l.email))
  WHERE c.estado <> 'fallido'
  ORDER BY l.id;

CREATE OR REPLACE VIEW public.leads_campana_sin_correo
WITH (security_invoker = on)
AS
  SELECT l.*
  FROM public.leads_campana l
  WHERE l.email IS NOT NULL AND l.email <> ''
    AND NOT EXISTS (
    SELECT 1
    FROM public.correo_envios c
    WHERE c.estado <> 'fallido'
      AND lower(trim(c.email)) = lower(trim(l.email))
  );

REVOKE SELECT ON public.leads_campana_con_correo          FROM anon, PUBLIC;
REVOKE SELECT ON public.leads_campana_sin_correo          FROM anon, PUBLIC;
GRANT  SELECT ON public.leads_campana_con_correo          TO authenticated, service_role;
GRANT  SELECT ON public.leads_campana_sin_correo          TO authenticated, service_role;
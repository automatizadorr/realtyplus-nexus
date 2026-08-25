-- =====================================================================
-- Panel de KPIs de vendedores para el admin.
--
-- Hasta ahora el admin podia agregar vendedores y repartirles leads, pero
-- no tenia forma de ver que hacian con ellos: cuantos tienen, en que
-- etapa estan parados, si estan prospectando, y si de verdad aprietan los
-- botones de contacto o solo miran la lista.
--
-- Tres funciones, todas solo-admin:
--   admin_kpis_vendedores()            -> una fila por vendedor
--   admin_busquedas_vendedor(uuid)     -> su historial de Buscar Leads
--   admin_contactos_vendedor(uuid,int) -> los CTA que apreto, uno a uno
--
-- Se hace con RPC y no leyendo las tablas desde el cliente porque el
-- admin necesita cruzar leads_campana, contactos_log y prospeccion_*, y
-- hacerlo en el navegador serian cuatro consultas por vendedor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_kpis_vendedores()
RETURNS TABLE (
  user_id          uuid,
  nombre_display   text,
  rol_venta        text,
  activo           boolean,
  recibe_traspasos boolean,
  leads_total      bigint,
  en_bandeja       bigint,
  contactado       bigint,
  interesado       bigint,
  demo             bigint,
  ganado           bigint,
  perdido          bigint,
  archivados       bigint,
  captados_ia      bigint,
  vencidos         bigint,
  traspaso_dados   bigint,
  traspaso_recibidos bigint,
  cta_whatsapp     bigint,
  cta_email        bigint,
  cta_instagram    bigint,
  cta_facebook     bigint,
  cta_llamada      bigint,
  busquedas        bigint,
  prospectos       bigint,
  ultima_actividad timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.user_id,
    v.nombre_display,
    v.rol_venta,
    v.activo,
    v.recibe_traspasos,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false))                                            AS leads_total,
    -- La Bandeja es "asignado pero sin primer contacto"; el Pipeline es el resto.
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.primer_contacto_at IS NULL)           AS en_bandeja,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.primer_contacto_at IS NOT NULL AND l.etapa_venta = 'contactado') AS contactado,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.primer_contacto_at IS NOT NULL AND l.etapa_venta = 'interesado') AS interesado,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.primer_contacto_at IS NOT NULL AND l.etapa_venta = 'demo')       AS demo,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.etapa_venta = 'ganado')               AS ganado,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.etapa_venta = 'perdido')              AS perdido,
    count(l.id) FILTER (WHERE COALESCE(l.archivado, false))                                                AS archivados,
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.escalado_ia_at IS NOT NULL)           AS captados_ia,
    -- Seguimiento vencido: prometio contactar y la fecha ya paso.
    count(l.id) FILTER (WHERE NOT COALESCE(l.archivado, false) AND l.fecha_proximo_contacto IS NOT NULL AND l.fecha_proximo_contacto < now()) AS vencidos,
    (SELECT count(*) FROM public.leads_campana t WHERE t.setter_id = v.user_id AND t.vendedor_id IS DISTINCT FROM v.user_id) AS traspaso_dados,
    (SELECT count(*) FROM public.leads_campana t WHERE t.vendedor_id = v.user_id AND t.setter_id IS NOT NULL)                AS traspaso_recibidos,
    (SELECT count(*) FROM public.contactos_log c WHERE c.user_id = v.user_id AND c.canal = 'whatsapp')  AS cta_whatsapp,
    (SELECT count(*) FROM public.contactos_log c WHERE c.user_id = v.user_id AND c.canal = 'email')     AS cta_email,
    (SELECT count(*) FROM public.contactos_log c WHERE c.user_id = v.user_id AND c.canal = 'instagram') AS cta_instagram,
    (SELECT count(*) FROM public.contactos_log c WHERE c.user_id = v.user_id AND c.canal = 'facebook')  AS cta_facebook,
    (SELECT count(*) FROM public.contactos_log c WHERE c.user_id = v.user_id AND c.canal = 'llamada')   AS cta_llamada,
    (SELECT count(*) FROM public.prospeccion_busquedas b WHERE b.creado_por = v.user_id)                AS busquedas,
    (SELECT count(*) FROM public.prospeccion_leads   p WHERE p.creado_por = v.user_id)                  AS prospectos,
    -- Ultima señal de vida: el CTA mas reciente, no la ultima vez que entro.
    (SELECT max(c.created_at) FROM public.contactos_log c WHERE c.user_id = v.user_id)                  AS ultima_actividad
  FROM public.vendedores v
  LEFT JOIN public.leads_campana l ON l.vendedor_id = v.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY v.user_id, v.nombre_display, v.rol_venta, v.activo, v.recibe_traspasos
  ORDER BY v.activo DESC, count(l.id) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_kpis_vendedores() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_kpis_vendedores() TO authenticated;

-- ---------------------------------------------------------------------
-- Historial de Buscar Leads de un vendedor. Es prospeccion_historial()
-- pero mirando la cuenta de otra persona, cosa que esa funcion no permite
-- (se acota a auth.uid()).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_busquedas_vendedor(_user_id uuid)
RETURNS TABLE (
  id                  uuid,
  nicho               text,
  ciudad              text,
  created_at          timestamptz,
  cantidad_encontrada int,
  nuevos              int,
  total_leads         bigint,
  contactados         bigint,
  en_crm              bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id, b.nicho, b.ciudad, b.created_at, b.cantidad_encontrada, b.nuevos,
    count(l.id)                                                    AS total_leads,
    count(l.id) FILTER (WHERE l.estado_gestion = 'contactado')     AS contactados,
    count(l.id) FILTER (WHERE l.lead_campana_id IS NOT NULL)       AS en_crm
  FROM public.prospeccion_busquedas b
  LEFT JOIN public.prospeccion_leads l ON l.busqueda_id = b.id
  WHERE public.has_role(auth.uid(), 'admin')
    AND b.creado_por = _user_id
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_busquedas_vendedor(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_busquedas_vendedor(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Los CTA que apreto el vendedor, uno a uno y con el lead al lado, para
-- poder auditar "¿de verdad esta contactando?" y por que canal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_contactos_vendedor(_user_id uuid, _limite int DEFAULT 30)
RETURNS TABLE (
  created_at   timestamptz,
  canal        text,
  resultado    text,
  lead_nombre  text,
  lead_telefono text,
  mensaje      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.created_at,
    c.canal,
    c.resultado,
    l.nombre,
    CASE WHEN l.telefono LIKE 'sin-tel-%' THEN NULL ELSE l.telefono END,
    left(coalesce(c.mensaje_final, ''), 240)
  FROM public.contactos_log c
  LEFT JOIN public.leads_campana l ON l.id = c.lead_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND c.user_id = _user_id
  ORDER BY c.created_at DESC
  LIMIT LEAST(COALESCE(_limite, 30), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_contactos_vendedor(uuid, int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_contactos_vendedor(uuid, int) TO authenticated;

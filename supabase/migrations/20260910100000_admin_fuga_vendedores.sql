-- =====================================================================
-- Admin -> Vendedores: las dos metricas de fuga.
--
-- El panel ya mostraba el embudo y los vencidos, pero no las dos formas
-- en que un lead se pierde de verdad:
--
--   sin_plan      -- lo contactaron una vez y quedo sin proximo paso.
--                    Nadie lo va a volver a mirar nunca. Es el "lead
--                    podrido" que la cola de Hoy ahora rescata, y aca se
--                    ve quien los esta dejando atras.
--   sin_atender   -- el lead respondio (o la IA escalo) y todavia nadie
--                    le contesto. La ventana de respuesta se enfria en
--                    horas, asi que este numero deberia ser casi siempre 0.
--
-- Misma definicion que usa vendedor_cola_calc, para que el vendedor y el
-- admin esten mirando el mismo numero.
-- =====================================================================

-- Cambia el tipo de retorno: CREATE OR REPLACE no alcanza.
DROP FUNCTION IF EXISTS public.admin_kpis_vendedores();

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
  sin_plan         bigint,
  sin_atender      bigint,
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
AS $fn$
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
    -- Lead vivo, ya contactado, sin proximo paso hace 3 dias o mas.
    count(l.id) FILTER (
      WHERE NOT COALESCE(l.archivado, false)
        AND l.etapa_venta NOT IN ('ganado', 'perdido')
        AND l.primer_contacto_at IS NOT NULL
        AND l.fecha_proximo_contacto IS NULL
        AND COALESCE(l.ultimo_contacto_at, l.primer_contacto_at) < now() - interval '3 days'
    ) AS sin_plan,
    -- Respondio (o la IA escalo) y nadie le contesto todavia.
    count(l.id) FILTER (
      WHERE NOT COALESCE(l.archivado, false)
        AND l.etapa_venta NOT IN ('ganado', 'perdido')
        AND (
          (l.ha_respondido IS TRUE
             AND (l.ultimo_contacto_at IS NULL
                  OR COALESCE(l.fecha_respuesta, l.escalado_ia_at, l.ultimo_contacto_at) > l.ultimo_contacto_at))
          OR (l.escalado_ia_at IS NOT NULL
             AND (l.ultimo_contacto_at IS NULL OR l.escalado_ia_at > l.ultimo_contacto_at))
        )
    ) AS sin_atender,
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
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_kpis_vendedores() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_kpis_vendedores() TO authenticated;

COMMENT ON FUNCTION public.admin_kpis_vendedores() IS
  'KPIs por vendedor para Admin -> Vendedores, incluyendo las dos metricas de fuga: sin_plan (contactado y sin proximo paso) y sin_atender (respondio y nadie contesto).';

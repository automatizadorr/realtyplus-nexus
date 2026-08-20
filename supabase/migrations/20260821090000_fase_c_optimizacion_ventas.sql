-- =====================================================================
-- Fase C: SLA de primer contacto, recordatorio de seguimiento, A/B de
-- plantillas por tasa de respuesta, ranking del vendedor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RPC: el vendedor programa/actualiza el proximo contacto de un lead
--    suyo (leads_campana.fecha_proximo_contacto ya existia, sin uso).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_set_proximo_contacto(
  _lead_id uuid,
  _fecha   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.leads_campana
  SET fecha_proximo_contacto = _fecha
  WHERE id = _lead_id AND vendedor_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_set_proximo_contacto(uuid, timestamptz) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_set_proximo_contacto(uuid, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------
-- 2) RPC: estadisticas de uso/respuesta por plantilla (agregado global,
--    sin exponer datos de leads individuales). Cualquier vendedor o
--    admin puede verla, para elegir la plantilla que mejor convierte.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plantilla_stats()
RETURNS TABLE (
  plantilla_id  uuid,
  canal         text,
  usos          bigint,
  respondieron  bigint,
  tasa_pct      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      cl.plantilla_id,
      cl.canal,
      cl.lead_id,
      cl.origen,
      CASE
        WHEN cl.origen = 'leads_campana' THEN
          (SELECT lc.ha_respondido FROM public.leads_campana lc WHERE lc.id = cl.lead_id)
        ELSE
          (SELECT pl.estado_gestion NOT IN ('nuevo') FROM public.prospeccion_leads pl WHERE pl.id = cl.lead_id)
      END AS respondio
    FROM public.contactos_log cl
    WHERE cl.plantilla_id IS NOT NULL
  )
  SELECT
    plantilla_id,
    canal,
    count(*) AS usos,
    count(*) FILTER (WHERE respondio) AS respondieron,
    round(100.0 * count(*) FILTER (WHERE respondio) / NULLIF(count(*), 0), 1) AS tasa_pct
  FROM base
  GROUP BY plantilla_id, canal;
$$;

REVOKE EXECUTE ON FUNCTION public.plantilla_stats() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.plantilla_stats() TO authenticated;

-- ---------------------------------------------------------------------
-- 3) RPC: puesto del vendedor autenticado entre sus pares activos, por
--    leads ganados. Solo devuelve SU puesto y el total (no expone la
--    identidad ni las cifras de los demas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_ranking()
RETURNS TABLE (
  mi_puesto        bigint,
  total_vendedores bigint,
  mis_ganados      bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH conteos AS (
    SELECT
      v.user_id,
      count(lc.id) FILTER (WHERE lc.etapa_venta = 'ganado') AS ganados
    FROM public.vendedores v
    LEFT JOIN public.leads_campana lc ON lc.vendedor_id = v.user_id
    WHERE v.activo = true
    GROUP BY v.user_id
  ),
  rankeados AS (
    SELECT user_id, ganados, RANK() OVER (ORDER BY ganados DESC) AS puesto
    FROM conteos
  )
  SELECT r.puesto, (SELECT count(*) FROM conteos), r.ganados
  FROM rankeados r
  WHERE r.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_ranking() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_ranking() TO authenticated;

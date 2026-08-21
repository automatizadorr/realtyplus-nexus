-- =====================================================================
-- Bandeja de primer contacto: antes de aparecer en el Pipeline, un lead
-- recién asignado espera en una "bandeja" hasta que el vendedor elige
-- plantillas de WhatsApp/email y lo libera. Evita que el Pipeline se
-- llene de golpe cuando se asignan lotes grandes (Fase 7).
--
-- primer_contacto_at IS NULL  -> en bandeja (no aparece en el Pipeline)
-- primer_contacto_at NOT NULL -> liberado, aparece en el Pipeline normal
-- =====================================================================
ALTER TABLE public.leads_campana ADD COLUMN IF NOT EXISTS primer_contacto_at timestamptz;

COMMENT ON COLUMN public.leads_campana.primer_contacto_at IS
  'Cuándo el vendedor liberó el lead de la bandeja hacia el Pipeline (NULL = todavía en bandeja).';

-- Backfill: los leads ya asignados HOY se consideran ya liberados (no deben
-- desaparecer del Pipeline de golpe al desplegar esta migración).
UPDATE public.leads_campana
SET primer_contacto_at = COALESCE(primer_contacto_at, fecha_asignacion, now())
WHERE vendedor_id IS NOT NULL AND primer_contacto_at IS NULL;

-- ---------------------------------------------------------------------
-- admin_asignar_leads: al (re)asignar, el lead vuelve a la bandeja
-- (primer_contacto_at = NULL) aunque ya hubiera sido liberado antes con
-- otro vendedor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_asignar_leads(
  _vendedor_id       uuid,
  _cantidad          int DEFAULT NULL,
  _pais              text DEFAULT NULL,
  _solo_sin_asignar  boolean DEFAULT true,
  _busqueda          text DEFAULT NULL
)
RETURNS TABLE (asignados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendedores WHERE user_id = _vendedor_id AND activo = true) THEN
    RAISE EXCEPTION 'Vendedor no válido o inactivo';
  END IF;

  WITH candidatos AS (
    SELECT id FROM public.leads_campana
    WHERE (_solo_sin_asignar = false OR vendedor_id IS NULL)
      AND (_pais IS NULL OR _pais = 'all' OR pais = _pais)
      AND (
        _busqueda IS NULL OR btrim(_busqueda) = '' OR
        nombre ILIKE '%' || _busqueda || '%' OR
        email  ILIKE '%' || _busqueda || '%' OR
        telefono ILIKE '%' || _busqueda || '%'
      )
    ORDER BY dias_reales DESC NULLS LAST
    LIMIT COALESCE(_cantidad, 2147483647)
  ),
  actualizados AS (
    UPDATE public.leads_campana lc
    SET vendedor_id = _vendedor_id, fecha_asignacion = now(), etapa_venta = 'nuevo', primer_contacto_at = NULL
    FROM candidatos c
    WHERE lc.id = c.id
    RETURNING lc.id
  )
  SELECT count(*) INTO _n FROM actualizados;

  RETURN QUERY SELECT _n;
END;
$$;

-- ---------------------------------------------------------------------
-- vendedor_liberar_a_pipeline: el vendedor libera de la bandeja hacia el
-- Pipeline los leads que ya contactó (WhatsApp/email). Solo sus propios
-- leads, solo los que siguen en bandeja.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_liberar_a_pipeline(_lead_ids uuid[])
RETURNS TABLE (liberados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  WITH actualizados AS (
    UPDATE public.leads_campana
    SET primer_contacto_at = now()
    WHERE id = ANY(_lead_ids)
      AND vendedor_id = auth.uid()
      AND primer_contacto_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO _n FROM actualizados;

  RETURN QUERY SELECT _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_liberar_a_pipeline(uuid[]) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_liberar_a_pipeline(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------
-- vendedor_kpis: "asignados" ahora cuenta solo los liberados (los que ya
-- están realmente en el Pipeline), para no mezclar con la bandeja.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_kpis()
RETURNS TABLE (
  asignados          bigint,
  contactados        bigint,
  interesados        bigint,
  demos              bigint,
  ganados            bigint,
  perdidos           bigint,
  tasa_respuesta_pct numeric,
  dias_promedio_cierre numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) AS asignados,
    count(*) FILTER (WHERE etapa_venta = 'contactado')  AS contactados,
    count(*) FILTER (WHERE etapa_venta = 'interesado')  AS interesados,
    count(*) FILTER (WHERE etapa_venta = 'demo')        AS demos,
    count(*) FILTER (WHERE etapa_venta = 'ganado')      AS ganados,
    count(*) FILTER (WHERE etapa_venta = 'perdido')     AS perdidos,
    CASE WHEN count(*) FILTER (WHERE etapa_venta <> 'nuevo') > 0
      THEN round(100.0 * count(*) FILTER (WHERE ha_respondido) / NULLIF(count(*) FILTER (WHERE etapa_venta <> 'nuevo'), 0), 1)
      ELSE 0
    END AS tasa_respuesta_pct,
    round(
      avg(EXTRACT(EPOCH FROM (fecha_cierre - fecha_asignacion)) / 86400.0)
        FILTER (WHERE etapa_venta = 'ganado' AND fecha_cierre IS NOT NULL AND fecha_asignacion IS NOT NULL),
      1
    ) AS dias_promedio_cierre
  FROM public.leads_campana
  WHERE vendedor_id = auth.uid()
    AND primer_contacto_at IS NOT NULL;
$$;

-- ---------------------------------------------------------------------
-- vendedor_bandeja_count: cuántos leads del vendedor siguen en bandeja
-- (badge del sidebar/tab, sin traer las filas completas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_bandeja_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.leads_campana
  WHERE vendedor_id = auth.uid() AND primer_contacto_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_bandeja_count() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_bandeja_count() TO authenticated;

-- =====================================================================
-- 1) Ganancias (leads_campana.etapa_venta='ganado') por semana, últimas
--    N semanas — para el gráfico de barras nuevo en Estadísticas.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.vendedor_ganados_por_semana(_semanas int DEFAULT 8)
RETURNS TABLE (semana date, ganados bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH semanas AS (
    SELECT generate_series(
      date_trunc('week', now() - ((greatest(_semanas, 1) - 1) || ' weeks')::interval)::date,
      date_trunc('week', now())::date,
      interval '1 week'
    )::date AS semana
  )
  SELECT s.semana, count(lc.id) AS ganados
  FROM semanas s
  LEFT JOIN public.leads_campana lc
    ON lc.vendedor_id = auth.uid()
    AND lc.etapa_venta = 'ganado'
    AND date_trunc('week', lc.fecha_cierre)::date = s.semana
  GROUP BY s.semana
  ORDER BY s.semana;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_ganados_por_semana(int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_ganados_por_semana(int) TO authenticated;

-- =====================================================================
-- 2) vendedor_plantillas_usadas: top POR CANAL (antes era un solo top 8
--    mezclando WhatsApp y email, sesgado hacia el canal más usado). Ahora
--    da hasta 6 de cada canal, para poder graficarlos por separado.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.vendedor_plantillas_usadas()
RETURNS TABLE (
  plantilla_id uuid,
  canal        text,
  nombre       text,
  usos         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH usos AS (
    SELECT
      cl.plantilla_id,
      cl.canal,
      CASE cl.canal
        WHEN 'whatsapp' THEN (SELECT pw.nombre FROM public.plantillas_whatsapp pw WHERE pw.id = cl.plantilla_id)
        WHEN 'email'    THEN (SELECT pe.nombre FROM public.plantillas_email pe WHERE pe.id = cl.plantilla_id)
      END AS nombre,
      count(*) AS usos
    FROM public.contactos_log cl
    WHERE cl.user_id = auth.uid() AND cl.plantilla_id IS NOT NULL
    GROUP BY cl.plantilla_id, cl.canal
  ),
  ranked AS (
    SELECT *, row_number() OVER (PARTITION BY canal ORDER BY usos DESC) AS rn
    FROM usos
  )
  SELECT plantilla_id, canal, nombre, usos
  FROM ranked
  WHERE rn <= 6
  ORDER BY canal, usos DESC;
$$;

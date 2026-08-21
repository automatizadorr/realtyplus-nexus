-- =====================================================================
-- 1) Favoritos de plantillas (personales por vendedor). No hay FK dura a
--    plantillas_whatsapp/plantillas_email porque plantilla_id apunta a
--    una u otra según `canal` (mismo criterio ya usado en contactos_log).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.plantilla_favoritos (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal        text NOT NULL CHECK (canal IN ('whatsapp','email')),
  plantilla_id uuid NOT NULL,
  creado_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, canal, plantilla_id)
);

ALTER TABLE public.plantilla_favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario ve sus favoritos" ON public.plantilla_favoritos;
CREATE POLICY "Usuario ve sus favoritos"
  ON public.plantilla_favoritos FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario marca sus favoritos" ON public.plantilla_favoritos;
CREATE POLICY "Usuario marca sus favoritos"
  ON public.plantilla_favoritos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario desmarca sus favoritos" ON public.plantilla_favoritos;
CREATE POLICY "Usuario desmarca sus favoritos"
  ON public.plantilla_favoritos FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================================
-- 2) vendedor_liberar_a_pipeline: al liberar de la bandeja, el lead ya fue
--    contactado (WhatsApp/email elegido ahí), así que entra al Pipeline
--    directo en "contactado" — la columna "Nuevo" deja de existir en el
--    kanban, ese paso ahora lo cubre la Bandeja. Se deja logueado el
--    cambio de etapa igual que hace vendedor_mover_etapa.
-- =====================================================================
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
    SET primer_contacto_at = now(),
        etapa_venta = CASE WHEN etapa_venta = 'nuevo' THEN 'contactado' ELSE etapa_venta END
    WHERE id = ANY(_lead_ids)
      AND vendedor_id = auth.uid()
      AND primer_contacto_at IS NULL
    RETURNING id
  ),
  log AS (
    INSERT INTO public.leads_campana_etapa_log (lead_id, user_id, etapa_anterior, etapa_nueva)
    SELECT id, auth.uid(), 'nuevo', 'contactado' FROM actualizados
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM actualizados;

  RETURN QUERY SELECT _n;
END;
$$;

-- =====================================================================
-- 3) vendedor_plantillas_usadas: top plantillas por uso PROPIO del
--    vendedor (a diferencia de plantilla_stats(), que es global), para el
--    nuevo gráfico en la pestaña Estadísticas.
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
  ORDER BY usos DESC
  LIMIT 8;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_plantillas_usadas() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_plantillas_usadas() TO authenticated;

-- =====================================================================
-- Fase A: pipeline de ventas del vendedor sobre leads_campana
-- ---------------------------------------------------------------------
-- Hasta ahora el rol vendedor solo veia prospeccion_leads (Buscar Leads).
-- Esta migracion conecta tambien leads_campana (la tabla real detras de
-- "Leads de campana" / Reactivacion), que es donde vive el volumen real
-- y donde eventualmente entregara leads el bot Camil-AI (n8n).
--
--   leads_campana +vendedor_id/etapa_venta/fecha_asignacion/fecha_cierre
--   leads_campana_etapa_log   -> historial de cambios de etapa (KPIs de tiempo)
--   RPC vendedor_mover_etapa  -> el vendedor solo puede mover SUS leads,
--                                pide motivo_cierre al marcar "perdido"
--   RPC vendedor_kpis         -> agregados para el panel de Mis Leads
--   contactos_log             -> deja de estar atado solo a prospeccion_leads
--   plantillas_whatsapp/email -> el vendedor puede crear y gestionar las suyas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) leads_campana: dueno + etapa de venta (separada del `estado` que
--    usa el bot, para no pisarle la maquina de estados interna)
-- ---------------------------------------------------------------------
ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS vendedor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS etapa_venta      text NOT NULL DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS fecha_asignacion timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_cierre     timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_campana_etapa_venta_check'
  ) THEN
    ALTER TABLE public.leads_campana
      ADD CONSTRAINT leads_campana_etapa_venta_check
      CHECK (etapa_venta IN ('nuevo','contactado','interesado','demo','ganado','perdido'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_leads_campana_vendedor_id  ON public.leads_campana (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_campana_etapa_venta  ON public.leads_campana (etapa_venta);

COMMENT ON COLUMN public.leads_campana.etapa_venta IS
  'Pipeline del vendedor: nuevo -> contactado -> interesado -> demo -> ganado/perdido. Independiente del `estado` que maneja el bot.';

-- ---------------------------------------------------------------------
-- 2) Historial de etapas (tiempo por etapa, tiempo de cierre)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads_campana_etapa_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.leads_campana(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_anterior  text,
  etapa_nueva     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lc_etapa_log_lead ON public.leads_campana_etapa_log (lead_id);
CREATE INDEX IF NOT EXISTS idx_lc_etapa_log_created ON public.leads_campana_etapa_log (created_at);

ALTER TABLE public.leads_campana_etapa_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read leads_campana_etapa_log" ON public.leads_campana_etapa_log;
CREATE POLICY "Admins read leads_campana_etapa_log"
  ON public.leads_campana_etapa_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee su etapa_log" ON public.leads_campana_etapa_log;
CREATE POLICY "Vendedor lee su etapa_log"
  ON public.leads_campana_etapa_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads_campana l
      WHERE l.id = leads_campana_etapa_log.lead_id AND l.vendedor_id = auth.uid()
    )
  );
-- (Sin politica de INSERT: solo lo escribe la RPC vendedor_mover_etapa, SECURITY DEFINER.)

-- ---------------------------------------------------------------------
-- 3) RLS: el vendedor ve SOLO los leads_campana que le asignaron
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedores read sus leads_campana" ON public.leads_campana;
CREATE POLICY "Vendedores read sus leads_campana"
  ON public.leads_campana FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND vendedor_id = auth.uid()
  );

-- ---------------------------------------------------------------------
-- 4) RPC: el vendedor mueve la etapa de UNO de sus leads. No es UPDATE
--    directo: asi no puede tocar `estado`/`bot_activo`/`fase_secuencia`
--    (columnas que maneja el bot) ni leads de otro vendedor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_mover_etapa(
  _lead_id       uuid,
  _etapa         text,
  _motivo_cierre text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _etapa_anterior text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _etapa NOT IN ('nuevo','contactado','interesado','demo','ganado','perdido') THEN
    RAISE EXCEPTION 'Etapa invalida: %', _etapa;
  END IF;

  IF _etapa = 'perdido' AND coalesce(btrim(_motivo_cierre), '') = '' THEN
    RAISE EXCEPTION 'Falta el motivo de cierre';
  END IF;

  SELECT etapa_venta INTO _etapa_anterior
  FROM public.leads_campana
  WHERE id = _lead_id AND vendedor_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  UPDATE public.leads_campana
  SET etapa_venta  = _etapa,
      motivo_cierre = CASE WHEN _etapa = 'perdido' THEN _motivo_cierre ELSE motivo_cierre END,
      fecha_cierre  = CASE WHEN _etapa IN ('ganado','perdido') THEN now() ELSE fecha_cierre END
  WHERE id = _lead_id;

  INSERT INTO public.leads_campana_etapa_log (lead_id, user_id, etapa_anterior, etapa_nueva)
  VALUES (_lead_id, auth.uid(), _etapa_anterior, _etapa);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) RPC: KPIs del vendedor autenticado (panel de Mis Leads)
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
      THEN round(
        100.0 * count(*) FILTER (WHERE ha_respondido) / NULLIF(count(*) FILTER (WHERE etapa_venta <> 'nuevo'), 0),
        1
      )
      ELSE 0
    END AS tasa_respuesta_pct,
    round(
      avg(EXTRACT(EPOCH FROM (fecha_cierre - fecha_asignacion)) / 86400.0)
        FILTER (WHERE etapa_venta = 'ganado' AND fecha_cierre IS NOT NULL AND fecha_asignacion IS NOT NULL),
      1
    ) AS dias_promedio_cierre
  FROM public.leads_campana
  WHERE vendedor_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_kpis() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_kpis() TO authenticated;

-- ---------------------------------------------------------------------
-- 6) contactos_log: ya no es exclusivo de prospeccion_leads
-- ---------------------------------------------------------------------
ALTER TABLE public.contactos_log DROP CONSTRAINT IF EXISTS contactos_log_lead_id_fkey;
ALTER TABLE public.contactos_log ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'prospeccion';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contactos_log_origen_check'
  ) THEN
    ALTER TABLE public.contactos_log
      ADD CONSTRAINT contactos_log_origen_check CHECK (origen IN ('prospeccion','leads_campana'));
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Vendedor inserta contactos_log propio" ON public.contactos_log;
CREATE POLICY "Vendedor inserta contactos_log propio"
  ON public.contactos_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND (
      (origen = 'prospeccion' AND public.vendedor_ve_lead(auth.uid(), lead_id))
      OR (origen = 'leads_campana' AND EXISTS (
            SELECT 1 FROM public.leads_campana lc WHERE lc.id = lead_id AND lc.vendedor_id = auth.uid()
          ))
    )
  );

-- ---------------------------------------------------------------------
-- 7) Plantillas propias del vendedor (ademas de leer las compartidas
--    por el admin, ahora puede crear/editar/borrar las suyas)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedor lee plantillas_whatsapp activas" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor lee plantillas_whatsapp"
  ON public.plantillas_whatsapp FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (
      creado_por = auth.uid()
      OR (activa = true AND (creado_por IS NULL OR public.has_role(creado_por, 'admin')))
    )
  );

DROP POLICY IF EXISTS "Vendedor crea sus plantillas_whatsapp" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor crea sus plantillas_whatsapp"
  ON public.plantillas_whatsapp FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid()) AND creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Vendedor edita sus plantillas_whatsapp" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor edita sus plantillas_whatsapp"
  ON public.plantillas_whatsapp FOR UPDATE TO authenticated
  USING (creado_por = auth.uid() AND public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (creado_por = auth.uid());

DROP POLICY IF EXISTS "Vendedor borra sus plantillas_whatsapp" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor borra sus plantillas_whatsapp"
  ON public.plantillas_whatsapp FOR DELETE TO authenticated
  USING (creado_por = auth.uid() AND public.has_role(auth.uid(), 'vendedor'));

DROP POLICY IF EXISTS "Vendedor lee plantillas_email activas" ON public.plantillas_email;
CREATE POLICY "Vendedor lee plantillas_email"
  ON public.plantillas_email FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (
      creado_por = auth.uid()
      OR (activa = true AND (creado_por IS NULL OR public.has_role(creado_por, 'admin')))
    )
  );

DROP POLICY IF EXISTS "Vendedor crea sus plantillas_email" ON public.plantillas_email;
CREATE POLICY "Vendedor crea sus plantillas_email"
  ON public.plantillas_email FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid()) AND creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Vendedor edita sus plantillas_email" ON public.plantillas_email;
CREATE POLICY "Vendedor edita sus plantillas_email"
  ON public.plantillas_email FOR UPDATE TO authenticated
  USING (creado_por = auth.uid() AND public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (creado_por = auth.uid());

DROP POLICY IF EXISTS "Vendedor borra sus plantillas_email" ON public.plantillas_email;
CREATE POLICY "Vendedor borra sus plantillas_email"
  ON public.plantillas_email FOR DELETE TO authenticated
  USING (creado_por = auth.uid() AND public.has_role(auth.uid(), 'vendedor'));

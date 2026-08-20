-- =====================================================================
-- Equipos de venta (setter + closer) trabajando en pool compartido
-- ---------------------------------------------------------------------
-- Hasta ahora un lead de leads_campana pertenecia a UN vendedor
-- (vendedor_id). Este cambio introduce equipos: un lead pertenece a un
-- EQUIPO, y cualquier miembro del equipo lo puede ver. Dentro del
-- equipo, el rol determina que puede hacer:
--   setter  -> nuevo -> contactado -> interesado (o perdido si descarta)
--   closer  -> interesado -> demo -> ganado / perdido
--
-- prospeccion_leads / vendedor_paises (pestaña "Prospeccion") NO cambian:
-- siguen siendo por individuo. Esto solo afecta leads_campana ("Pipeline").
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Equipos y miembros
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipos_venta (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipo_miembros (
  equipo_id   uuid NOT NULL REFERENCES public.equipos_venta(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_equipo  text NOT NULL CHECK (rol_equipo IN ('setter', 'closer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (equipo_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.equipo_paises (
  equipo_id   uuid NOT NULL REFERENCES public.equipos_venta(id) ON DELETE CASCADE,
  pais        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (equipo_id, pais)
);

COMMENT ON TABLE public.equipos_venta IS 'Equipo de venta (setter + closer) que comparte un pool de leads_campana.';
COMMENT ON COLUMN public.equipo_miembros.rol_equipo IS 'setter: nuevo->contactado->interesado. closer: interesado->demo->ganado/perdido.';

-- ---------------------------------------------------------------------
-- 2) leads_campana pasa a pertenecer a un equipo (vendedor_id queda,
--    sin uso para RLS, por si se quiere trazar quien lo tomo despues)
-- ---------------------------------------------------------------------
ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS equipo_id uuid REFERENCES public.equipos_venta(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_campana_equipo_id ON public.leads_campana (equipo_id);

-- ---------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_rol_en_equipo(_equipo_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol_equipo FROM public.equipo_miembros
  WHERE equipo_id = _equipo_id AND user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.mi_rol_en_equipo(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mi_rol_en_equipo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.elegir_equipo_para(_pais text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT e.id
  FROM public.equipos_venta e
  JOIN public.equipo_paises ep ON ep.equipo_id = e.id
  WHERE e.activo = true AND lower(unaccent(ep.pais)) = lower(unaccent(_pais))
  ORDER BY (
    SELECT count(*) FROM public.leads_campana lc
    WHERE lc.equipo_id = e.id AND lc.etapa_venta NOT IN ('ganado', 'perdido')
  ) ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.elegir_equipo_para(text) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.elegir_equipo_para(text) TO service_role;

-- ---------------------------------------------------------------------
-- 4) RLS: cualquier vendedor activo que sea MIEMBRO del equipo dueno
--    del lead lo puede ver (reemplaza la politica basada en vendedor_id)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedores read sus leads_campana" ON public.leads_campana;
CREATE POLICY "Vendedores read leads de su equipo"
  ON public.leads_campana FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.equipo_miembros em
      WHERE em.equipo_id = leads_campana.equipo_id AND em.user_id = auth.uid()
    )
  );

ALTER TABLE public.equipos_venta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_miembros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_paises    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage equipos_venta" ON public.equipos_venta;
CREATE POLICY "Admins manage equipos_venta"
  ON public.equipos_venta FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Miembro lee su equipo" ON public.equipos_venta;
CREATE POLICY "Miembro lee su equipo"
  ON public.equipos_venta FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.equipo_miembros em WHERE em.equipo_id = equipos_venta.id AND em.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage equipo_miembros" ON public.equipo_miembros;
CREATE POLICY "Admins manage equipo_miembros"
  ON public.equipo_miembros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Miembro lee su membresia" ON public.equipo_miembros;
CREATE POLICY "Miembro lee su membresia"
  ON public.equipo_miembros FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage equipo_paises" ON public.equipo_paises;
CREATE POLICY "Admins manage equipo_paises"
  ON public.equipo_paises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Miembro lee paises de su equipo" ON public.equipo_paises;
CREATE POLICY "Miembro lee paises de su equipo"
  ON public.equipo_paises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.equipo_miembros em WHERE em.equipo_id = equipo_paises.equipo_id AND em.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 5) RPC vendedor_mover_etapa: ahora valida pertenencia al equipo del
--    lead Y que el rol (setter/closer) tenga permitida esa etapa destino.
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
  _equipo_id uuid;
  _rol text;
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

  SELECT etapa_venta, equipo_id INTO _etapa_anterior, _equipo_id
  FROM public.leads_campana
  WHERE id = _lead_id
  FOR UPDATE;

  IF NOT FOUND OR _equipo_id IS NULL THEN
    RAISE EXCEPTION 'Lead no encontrado o sin equipo asignado';
  END IF;

  SELECT rol_equipo INTO _rol FROM public.equipo_miembros
  WHERE equipo_id = _equipo_id AND user_id = auth.uid();

  IF _rol IS NULL THEN
    RAISE EXCEPTION 'No perteneces al equipo de este lead';
  END IF;

  IF _rol = 'setter' AND _etapa NOT IN ('contactado', 'interesado', 'perdido') THEN
    RAISE EXCEPTION 'Como setter solo puedes mover a Contactado, Interesado o Perdido';
  END IF;
  IF _rol = 'closer' AND _etapa NOT IN ('interesado', 'demo', 'ganado', 'perdido') THEN
    RAISE EXCEPTION 'Como closer solo puedes mover a Interesado, Demo, Ganado o Perdido';
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

-- ---------------------------------------------------------------------
-- 6) vendedor_set_proximo_contacto: ownership vía equipo, no vendedor_id
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

  UPDATE public.leads_campana lc
  SET fecha_proximo_contacto = _fecha
  WHERE lc.id = _lead_id
    AND EXISTS (SELECT 1 FROM public.equipo_miembros em WHERE em.equipo_id = lc.equipo_id AND em.user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 7) vendedor_kpis: ahora agrega por EQUIPO (comparten meta), no por
--    vendedor_id individual (ya no representa dueno unico).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_kpis()
RETURNS TABLE (
  asignados          bigint,
  contactados        bigint,
  interesados        bigint,
  demos               bigint,
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
  WHERE equipo_id IN (SELECT equipo_id FROM public.equipo_miembros WHERE user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 8) vendedor_ranking -> ahora compara EQUIPOS entre si (por ganados),
--    devuelve solo el puesto del equipo del que llama, sin exponer a
--    los demas equipos.
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
      e.id AS equipo_id,
      count(lc.id) FILTER (WHERE lc.etapa_venta = 'ganado') AS ganados
    FROM public.equipos_venta e
    LEFT JOIN public.leads_campana lc ON lc.equipo_id = e.id
    WHERE e.activo = true
    GROUP BY e.id
  ),
  rankeados AS (
    SELECT equipo_id, ganados, RANK() OVER (ORDER BY ganados DESC) AS puesto
    FROM conteos
  )
  SELECT r.puesto, (SELECT count(*) FROM conteos), r.ganados
  FROM rankeados r
  WHERE r.equipo_id IN (SELECT equipo_id FROM public.equipo_miembros WHERE user_id = auth.uid())
  ORDER BY r.puesto
  LIMIT 1;
$$;

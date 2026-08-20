-- =====================================================================
-- Fase 1: vuelta a asignacion individual (vendedor_id), rol como
-- atributo del usuario (setter/closer/ambos), reparto 100% manual.
-- ---------------------------------------------------------------------
-- Se deja de usar equipos_venta/equipo_miembros/equipo_paises para
-- leads_campana (las tablas quedan, sin uso, no se borran). El admin
-- ahora envia leads a una persona puntual, no a un equipo. El bot
-- Camil-AI ya NO asigna solo: solo apaga bot_activo al escalar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Rol de venta del usuario
-- ---------------------------------------------------------------------
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS rol_venta text NOT NULL DEFAULT 'ambos';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendedores_rol_venta_check') THEN
    ALTER TABLE public.vendedores
      ADD CONSTRAINT vendedores_rol_venta_check CHECK (rol_venta IN ('setter', 'closer', 'ambos'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.vendedores.rol_venta IS 'setter: nuevo->contactado->interesado. closer: interesado->demo->ganado/perdido. ambos: la union de las dos.';

-- Continuidad: los que ya tenian rol en Equipo Mexico 1 heredan ese rol.
UPDATE public.vendedores v
SET rol_venta = em.rol_equipo
FROM public.equipo_miembros em
WHERE em.user_id = v.user_id AND em.rol_equipo IN ('setter', 'closer');

-- ---------------------------------------------------------------------
-- 2) RLS de leads_campana: vuelve a ser por vendedor_id (no equipo_id)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedores read leads de su equipo" ON public.leads_campana;
DROP POLICY IF EXISTS "Vendedores read sus leads_campana" ON public.leads_campana;
CREATE POLICY "Vendedores read sus leads_campana"
  ON public.leads_campana FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND vendedor_id = auth.uid()
  );

-- ---------------------------------------------------------------------
-- 3) vendedor_mover_etapa: dueno por vendedor_id, permisos por rol_venta
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

  SELECT etapa_venta INTO _etapa_anterior
  FROM public.leads_campana
  WHERE id = _lead_id AND vendedor_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  SELECT rol_venta INTO _rol FROM public.vendedores WHERE user_id = auth.uid();

  IF _rol = 'setter' AND _etapa NOT IN ('contactado', 'interesado', 'perdido') THEN
    RAISE EXCEPTION 'Como setter solo puedes mover a Contactado, Interesado o Perdido';
  END IF;
  IF _rol = 'closer' AND _etapa NOT IN ('interesado', 'demo', 'ganado', 'perdido') THEN
    RAISE EXCEPTION 'Como closer solo puedes mover a Interesado, Demo, Ganado o Perdido';
  END IF;
  -- rol_venta = 'ambos': sin restriccion adicional (cualquier etapa de la lista valida arriba).

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
-- 4) vendedor_set_proximo_contacto: dueno por vendedor_id
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

-- ---------------------------------------------------------------------
-- 5) vendedor_kpis: vuelve a agregar por vendedor_id individual
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
  WHERE vendedor_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6) vendedor_ranking: vuelve a comparar individuos por vendedor_id
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

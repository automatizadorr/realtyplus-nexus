-- =====================================================================
-- Fase B: los leads que capta el bot Camil-AI entran solos al Pipeline.
--
-- Hasta ahora, cuando Camil-AI escalaba una conversacion a humano, lo
-- unico que pasaba en el CRM era que se apagaba bot_activo: el lead
-- quedaba en la misma etapa de siempre y sin ninguna marca, asi que el
-- vendedor no se enteraba de que ese contacto ya venia caliente.
--
-- Decision de Mario (2026-08-25):
--   * el reparto sigue siendo 100% MANUAL (admin -> vendedor). Esta
--     migracion NO asigna vendedor_id automaticamente.
--   * el lead entra al Pipeline en etapa "contactado" (no a la Bandeja),
--     porque el bot ya hablo con el.
--   * tiene que quedar explicito que lo capto el sistema IA.
--   * disparadores: escalacion a humano (escalar:true) y agendamiento de
--     reunion por Google Calendar.
--
-- Se marca con columnas propias en vez de pisar `origen`: el origen dice
-- de donde salio el lead (campana importada, Buscar Leads, alta manual) y
-- esa historia no se pierde. La captacion por IA es un hecho posterior.
-- =====================================================================

ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS escalado_ia_at     timestamptz,
  ADD COLUMN IF NOT EXISTS escalado_ia_motivo text;

COMMENT ON COLUMN public.leads_campana.escalado_ia_at IS
  'Cuando el bot Camil-AI capto/escalo este lead a un humano (NULL = nunca paso por la IA).';
COMMENT ON COLUMN public.leads_campana.escalado_ia_motivo IS
  'Que gatillo la captacion por IA: escalacion a humano, reunion agendada, etc.';

-- Los captados por IA sin repartir son la lista de trabajo del admin:
-- indice parcial para que el panel "Asignar leads" filtre sin escanear
-- las 8.700 filas.
CREATE INDEX IF NOT EXISTS leads_campana_escalado_ia_idx
  ON public.leads_campana (escalado_ia_at DESC)
  WHERE escalado_ia_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- admin_asignar_leads: un lead captado por IA NO vuelve a la Bandeja al
-- asignarlo.
--
-- El comportamiento normal es que asignar devuelve el lead a etapa
-- "nuevo" con primer_contacto_at = NULL, o sea a la Bandeja, para que el
-- vendedor haga el primer contacto. Para un lead que ya converso con
-- Camil-AI eso seria un retroceso: el primer contacto ya ocurrio y
-- mandarlo a la Bandeja lo dejaria fuera del Pipeline justo cuando esta
-- mas caliente. Asi que se conserva la etapa "contactado" y se da por
-- hecho el primer contacto, fechado cuando la IA lo capto.
--
-- Ademas se suma el parametro _solo_captados_ia, para que el envio por
-- lote respete el filtro "captados por IA" del panel (si no, el lote
-- ignoraria el filtro y mandaria leads frios mezclados).
-- ---------------------------------------------------------------------
-- Se dropea la version de 5 parametros: con CREATE OR REPLACE quedarian
-- las dos como sobrecargas y las llamadas viejas serian ambiguas.
DROP FUNCTION IF EXISTS public.admin_asignar_leads(uuid, int, text, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_asignar_leads(
  _vendedor_id       uuid,
  _cantidad          int DEFAULT NULL,
  _pais              text DEFAULT NULL,
  _solo_sin_asignar  boolean DEFAULT true,
  _busqueda          text DEFAULT NULL,
  _solo_captados_ia  boolean DEFAULT false
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
    RAISE EXCEPTION 'Vendedor no valido o inactivo';
  END IF;

  WITH candidatos AS (
    SELECT id FROM public.leads_campana
    WHERE (_solo_sin_asignar = false OR vendedor_id IS NULL)
      AND (_solo_captados_ia = false OR escalado_ia_at IS NOT NULL)
      AND (_pais IS NULL OR _pais = 'all' OR pais = _pais)
      AND (
        _busqueda IS NULL OR btrim(_busqueda) = '' OR
        nombre ILIKE '%' || _busqueda || '%' OR
        email  ILIKE '%' || _busqueda || '%' OR
        telefono ILIKE '%' || _busqueda || '%'
      )
    -- Con el filtro de IA activo manda la captacion mas reciente (el lead
    -- caliente primero); si no, el orden de siempre por antiguedad.
    ORDER BY
      CASE WHEN _solo_captados_ia THEN escalado_ia_at END DESC NULLS LAST,
      dias_reales DESC NULLS LAST
    LIMIT COALESCE(_cantidad, 2147483647)
  ),
  actualizados AS (
    UPDATE public.leads_campana lc
    SET vendedor_id      = _vendedor_id,
        fecha_asignacion = now(),
        etapa_venta = CASE
          WHEN lc.escalado_ia_at IS NOT NULL THEN 'contactado'
          ELSE 'nuevo'
        END,
        primer_contacto_at = CASE
          WHEN lc.escalado_ia_at IS NOT NULL
            THEN COALESCE(lc.primer_contacto_at, lc.escalado_ia_at)
          ELSE NULL
        END
    FROM candidatos c
    WHERE lc.id = c.id
    RETURNING lc.id
  )
  SELECT count(*) INTO _n FROM actualizados;

  RETURN QUERY SELECT _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_asignar_leads(uuid, int, text, boolean, text, boolean) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_asignar_leads(uuid, int, text, boolean, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- bot_capta_lead: lo que llama la edge function bot-handoff-vendedor
-- (service role) cuando Camil-AI escala o agenda.
--
-- Se hace en una sola funcion para que sea atomico y para dejar la regla
-- de negocio en la base, al lado del resto del flujo del vendedor:
--   * marca escalado_ia_at / escalado_ia_motivo (idempotente: si ya
--     estaba marcado no se vuelve a pisar la fecha original)
--   * apaga el bot para que Camil-AI no siga escribiendo
--   * sube a etapa "contactado" SOLO si el lead sigue en "nuevo"
--     (nunca hace retroceder a uno que ya iba en interesado/demo/ganado)
--   * da por hecho el primer contacto, para que si el lead ya tiene
--     vendedor aparezca de inmediato en su Pipeline
--   * registra el salto en leads_campana_etapa_log con user_id NULL,
--     que es como queda escrito "lo movio el sistema, no una persona"
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_capta_lead(
  _telefono text,
  _motivo   text DEFAULT 'Escalado por Camil-AI'
)
RETURNS TABLE (
  lead_id        uuid,
  vendedor_id    uuid,
  etapa_anterior text,
  etapa_nueva    text,
  ya_estaba      boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tel  text := regexp_replace(COALESCE(_telefono, ''), '\D', '', 'g');
  _lead public.leads_campana%ROWTYPE;
  _prev text;
  _next text;
BEGIN
  IF _tel = '' THEN
    RAISE EXCEPTION 'telefono requerido';
  END IF;

  -- Mismo criterio de match que el resto del sistema: ultimos 9 digitos,
  -- para que el mismo numero escrito con o sin prefijo de pais calce.
  -- Se toma el mas reciente por si quedaron duplicados historicos.
  SELECT * INTO _lead
  FROM public.leads_campana
  WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
    -- Un lead sin telefono lleva el marcador 'sin-tel-<uuid>'; sus digitos
    -- sueltos podrian calzar por casualidad con los ultimos 9 de un numero
    -- real, asi que quedan fuera del match.
    AND telefono NOT LIKE 'sin-tel-%'
    AND COALESCE(archivado, false) = false
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  _prev := _lead.etapa_venta;
  _next := CASE WHEN COALESCE(_lead.etapa_venta, 'nuevo') = 'nuevo' THEN 'contactado' ELSE _lead.etapa_venta END;

  UPDATE public.leads_campana
  SET escalado_ia_at     = COALESCE(escalado_ia_at, now()),
      escalado_ia_motivo = COALESCE(NULLIF(btrim(_motivo), ''), escalado_ia_motivo),
      bot_activo         = false,
      ha_respondido      = true,
      fecha_respuesta    = COALESCE(fecha_respuesta, now()),
      ultimo_contacto_at = now(),
      primer_contacto_at = COALESCE(primer_contacto_at, now()),
      etapa_venta        = _next
  WHERE id = _lead.id;

  IF _next IS DISTINCT FROM _prev THEN
    INSERT INTO public.leads_campana_etapa_log (lead_id, etapa_anterior, etapa_nueva, user_id)
    VALUES (_lead.id, _prev, _next, NULL);
  END IF;

  RETURN QUERY SELECT _lead.id, _lead.vendedor_id, _prev, _next, (_lead.escalado_ia_at IS NOT NULL);
END;
$$;

-- Solo la edge function (service_role) la ejecuta; ningun cliente.
REVOKE EXECUTE ON FUNCTION public.bot_capta_lead(text, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- admin_captados_ia_sin_asignar: contador para el panel de asignacion,
-- asi el admin ve de un vistazo cuantos leads calientes estan esperando
-- reparto sin tener que aplicar el filtro.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_captados_ia_sin_asignar()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.leads_campana
  WHERE escalado_ia_at IS NOT NULL
    AND vendedor_id IS NULL
    AND COALESCE(archivado, false) = false
    AND public.has_role(auth.uid(), 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.admin_captados_ia_sin_asignar() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_captados_ia_sin_asignar() TO authenticated;

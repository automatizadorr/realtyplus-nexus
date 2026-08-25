-- =====================================================================
-- Traspaso automatico setter -> closer.
--
-- El modelo ya tenia el limite dibujado: un setter puede mover el lead
-- hasta "interesado" y un closer arranca justo en "interesado". Lo que
-- faltaba era el salto: hasta ahora, cuando el setter calificaba un lead,
-- se quedaba en su propio Pipeline y el closer nunca se enteraba.
--
-- Decisiones de Mario (2026-08-25):
--   * el traspaso es AUTOMATICO al marcar "interesado", sin boton
--   * el setter sigue viendo el lead, pero en solo lectura, para saber en
--     que termino su trabajo
--   * el reparto entre closers es POR TURNOS
--
-- Esto NO reinstala el modelo de "equipos de venta" que se revirtio el
-- 2026-08-21: el lead sigue perteneciendo a UNA persona a la vez. Lo
-- unico nuevo es que queda anotado quien lo califico.
-- =====================================================================

ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS setter_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS traspasado_at timestamptz;

COMMENT ON COLUMN public.leads_campana.setter_id IS
  'Setter que califico el lead y lo traspaso a un closer. Le da acceso de solo lectura.';
COMMENT ON COLUMN public.leads_campana.traspasado_at IS
  'Cuando paso del setter al closer. Tambien es el reloj de la rotacion por turnos.';

CREATE INDEX IF NOT EXISTS leads_campana_setter_idx
  ON public.leads_campana (setter_id)
  WHERE setter_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Quien recibe traspasos es una lista EXPLICITA, no se deduce de
-- rol_venta. Si se dedujera de rol_venta IN ('closer','ambos'), la cuenta
-- de Mario (lexhouseai, que es 'ambos') entraria en la rotacion sin
-- quererlo. Hoy: Kelby y srick2111.
-- ---------------------------------------------------------------------
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS recibe_traspasos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendedores.recibe_traspasos IS
  'Entra en la rotacion por turnos que reparte los leads calificados por los setters.';

UPDATE public.vendedores
SET recibe_traspasos = true
WHERE nombre_display IN ('Kelby', 'srick2111');

-- ---------------------------------------------------------------------
-- siguiente_closer(): el turno le toca al que hace mas tiempo que no
-- recibe nada. La rotacion no necesita tabla de estado propia: se lee del
-- traspasado_at mas reciente de cada uno, asi que no se puede desincronizar
-- de la realidad. NULLS FIRST = el que nunca ha recibido va primero.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siguiente_closer()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.user_id
  FROM public.vendedores v
  LEFT JOIN LATERAL (
    SELECT max(l.traspasado_at) AS ultimo
    FROM public.leads_campana l
    WHERE l.vendedor_id = v.user_id AND l.traspasado_at IS NOT NULL
  ) t ON true
  WHERE v.activo = true AND v.recibe_traspasos = true
  ORDER BY t.ultimo ASC NULLS FIRST, v.user_id
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- vendedor_mover_etapa: mismo contrato de siempre, mas el traspaso.
--
-- Pasa a devolver jsonb para que la UI pueda avisarle al setter a quien
-- le quedo el lead. Antes devolvia void, por eso hay que dropearla.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vendedor_mover_etapa(uuid, text, text);

CREATE OR REPLACE FUNCTION public.vendedor_mover_etapa(
  _lead_id       uuid,
  _etapa         text,
  _motivo_cierre text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _etapa_anterior text;
  _rol            text;
  _closer         uuid;
  _closer_nombre  text;
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
  -- rol_venta = 'ambos': sin restriccion adicional.

  UPDATE public.leads_campana
  SET etapa_venta  = _etapa,
      motivo_cierre = CASE WHEN _etapa = 'perdido' THEN _motivo_cierre ELSE motivo_cierre END,
      fecha_cierre  = CASE WHEN _etapa IN ('ganado','perdido') THEN now() ELSE fecha_cierre END
  WHERE id = _lead_id;

  INSERT INTO public.leads_campana_etapa_log (lead_id, user_id, etapa_anterior, etapa_nueva)
  VALUES (_lead_id, auth.uid(), _etapa_anterior, _etapa);

  -- --- Traspaso al closer de turno ---
  IF _rol = 'setter' AND _etapa = 'interesado' THEN
    _closer := public.siguiente_closer();

    -- Si no hay ningun closer en la rotacion, el lead se queda con el
    -- setter. Calificar un lead nunca puede fallar por un problema de
    -- configuracion: se avisa en la respuesta y listo.
    IF _closer IS NOT NULL AND _closer <> auth.uid() THEN
      UPDATE public.leads_campana
      SET vendedor_id        = _closer,
          setter_id          = auth.uid(),
          traspasado_at      = now(),
          fecha_asignacion   = now(),
          -- El primer contacto ya lo hizo el setter: el lead entra al
          -- Pipeline del closer, no a su Bandeja.
          primer_contacto_at = COALESCE(primer_contacto_at, now())
      WHERE id = _lead_id;

      SELECT COALESCE(nombre_display, 'un closer') INTO _closer_nombre
      FROM public.vendedores WHERE user_id = _closer;

      RETURN jsonb_build_object(
        'etapa', _etapa,
        'traspasado', true,
        'closer_id', _closer,
        'closer_nombre', _closer_nombre
      );
    END IF;

    RETURN jsonb_build_object(
      'etapa', _etapa,
      'traspasado', false,
      'aviso', 'No hay ningun closer disponible para recibir el lead; se queda contigo.'
    );
  END IF;

  RETURN jsonb_build_object('etapa', _etapa, 'traspasado', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- RLS: el setter conserva la LECTURA del lead que traspaso.
--
-- Solo se toca el SELECT. Los vendedores no tienen politica de UPDATE
-- sobre leads_campana -- todas sus escrituras pasan por RPCs SECURITY
-- DEFINER que exigen vendedor_id = auth.uid() -- asi que el acceso del
-- setter queda de solo lectura sin necesidad de nada mas.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedores read sus leads_campana" ON public.leads_campana;

CREATE POLICY "Vendedores read sus leads_campana"
  ON public.leads_campana
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND (vendedor_id = auth.uid() OR setter_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- vendedor_lead_detalle: el setter tambien puede abrir la ficha de lo que
-- traspaso. Sin esto, el lead se ve en el kanban pero no se puede abrir.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_lead_detalle(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid  uuid := auth.uid();
  _lead public.leads_campana%ROWTYPE;
  _out  jsonb;
BEGIN
  IF NOT public.has_role(_uid, 'vendedor') OR NOT public.vendedor_activo(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO _lead FROM public.leads_campana
  WHERE id = _lead_id AND (vendedor_id = _uid OR setter_id = _uid);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  SELECT jsonb_build_object(
    'lead', to_jsonb(_lead) - 'tag_ids',
    -- solo_lectura: lo traspaso este setter y ya no es suyo.
    'solo_lectura', (_lead.vendedor_id IS DISTINCT FROM _uid),
    'closer_nombre', (
      SELECT nombre_display FROM public.vendedores WHERE user_id = _lead.vendedor_id
    ),
    'prospecto', (
      SELECT to_jsonb(p) FROM public.prospeccion_leads p
      WHERE p.id = _lead.prospecto_id OR p.lead_campana_id = _lead.id
      LIMIT 1
    ),
    'etapas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'etapa_anterior', e.etapa_anterior,
               'etapa_nueva',    e.etapa_nueva,
               'created_at',     e.created_at
             ) ORDER BY e.created_at)
      FROM public.leads_campana_etapa_log e WHERE e.lead_id = _lead.id
    ), '[]'::jsonb),
    'contactos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'canal',         c.canal,
               'resultado',     c.resultado,
               'mensaje_final', left(coalesce(c.mensaje_final, ''), 600),
               'created_at',    c.created_at
             ) ORDER BY c.created_at DESC)
      FROM public.contactos_log c
      WHERE c.lead_id = _lead.id AND c.origen = 'leads_campana'
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_lead_detalle(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_lead_detalle(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- vendedor_kpis: al traspasar, el lead deja de contar para el setter. Se
-- le agrega su propio marcador para que no parezca que su trabajo se
-- evaporo: cuantos califico y entrego.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_traspasados()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.leads_campana
  WHERE setter_id = auth.uid() AND vendedor_id IS DISTINCT FROM auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_traspasados() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_traspasados() TO authenticated;

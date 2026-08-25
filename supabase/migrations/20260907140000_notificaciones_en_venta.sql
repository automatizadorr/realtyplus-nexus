-- =====================================================================
-- Engancha las notificaciones al flujo de venta.
--
-- Los dos casos que pidio Mario:
--   * el setter tiene que enterarse cuando SU lead se cerro (ganado o
--     perdido), porque despues del traspaso lo ve pero no lo toca
--   * el closer tiene que enterarse cuando le llega un lead calificado
--
-- Van dentro de vendedor_mover_etapa y no en un trigger: leads_campana
-- recibe updates masivos y un trigger por fila llenaria de basura la
-- bandeja de notificaciones.
-- =====================================================================

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
  _lead           public.leads_campana%ROWTYPE;
  _quien          text;
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

  SELECT * INTO _lead
  FROM public.leads_campana
  WHERE id = _lead_id AND vendedor_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
  _etapa_anterior := _lead.etapa_venta;

  SELECT rol_venta INTO _rol FROM public.vendedores WHERE user_id = auth.uid();

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

  SELECT COALESCE(nombre_display, 'Un vendedor') INTO _quien
  FROM public.vendedores WHERE user_id = auth.uid();

  -- --- Aviso al setter: su lead se cerro ---
  IF _etapa IN ('ganado','perdido')
     AND _lead.setter_id IS NOT NULL
     AND _lead.setter_id <> auth.uid() THEN
    PERFORM public.notificar(
      _lead.setter_id,
      'negocio_cerrado',
      CASE WHEN _etapa = 'ganado'
        THEN '🏆 Se ganó un lead que calificaste: ' || COALESCE(_lead.nombre, 'sin nombre')
        ELSE 'Se perdió un lead que calificaste: ' || COALESCE(_lead.nombre, 'sin nombre')
      END,
      CASE WHEN _etapa = 'ganado'
        THEN _quien || ' cerró el negocio.'
        ELSE _quien || ' lo dio por perdido' || COALESCE(' — ' || _motivo_cierre, '') || '.'
      END,
      _lead_id, '/mis-leads/pipeline');
  END IF;

  -- --- Traspaso al closer de turno ---
  IF _rol = 'setter' AND _etapa = 'interesado' THEN
    _closer := public.siguiente_closer();

    IF _closer IS NOT NULL AND _closer <> auth.uid() THEN
      UPDATE public.leads_campana
      SET vendedor_id        = _closer,
          setter_id          = auth.uid(),
          traspasado_at      = now(),
          fecha_asignacion   = now(),
          primer_contacto_at = COALESCE(primer_contacto_at, now())
      WHERE id = _lead_id;

      SELECT COALESCE(nombre_display, 'un closer') INTO _closer_nombre
      FROM public.vendedores WHERE user_id = _closer;

      PERFORM public.notificar(
        _closer, 'lead_traspasado',
        '🎯 Lead calificado para ti: ' || COALESCE(_lead.nombre, 'sin nombre'),
        _quien || ' lo dejó en Interesado' || COALESCE(' · ' || _lead.telefono, '') || '.',
        _lead_id, '/mis-leads/pipeline');

      RETURN jsonb_build_object('etapa', _etapa, 'traspasado', true,
                                'closer_id', _closer, 'closer_nombre', _closer_nombre);
    END IF;

    RETURN jsonb_build_object('etapa', _etapa, 'traspasado', false,
      'aviso', 'No hay ningun closer disponible para recibir el lead; se queda contigo.');
  END IF;

  RETURN jsonb_build_object('etapa', _etapa, 'traspasado', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_mover_etapa(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- bot_capta_lead: cuando el bot capta a alguien, avisar. Si el lead ya
-- tiene dueno, a el; si no, a los admins, que son quienes lo reparten.
-- Se mantiene todo lo demas igual que en la version anterior.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_capta_lead(
  _telefono text,
  _motivo   text DEFAULT 'Escalado por el bot',
  _nombre   text DEFAULT NULL,
  _pais     text DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid, vendedor_id uuid, etapa_anterior text, etapa_nueva text,
  ya_estaba boolean, creado boolean, revivido boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tel      text := regexp_replace(COALESCE(_telefono, ''), '\D', '', 'g');
  _lead     public.leads_campana%ROWTYPE;
  _prev     text;
  _next     text;
  _revivido boolean := false;
BEGIN
  IF _tel = '' THEN RAISE EXCEPTION 'telefono requerido'; END IF;

  SELECT * INTO _lead FROM public.leads_campana
  WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
    AND telefono NOT LIKE 'sin-tel-%'
    AND COALESCE(archivado, false) = false
  ORDER BY created_at DESC NULLS LAST LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO _lead FROM public.leads_campana
    WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
      AND telefono NOT LIKE 'sin-tel-%'
    ORDER BY created_at DESC NULLS LAST LIMIT 1;
    IF FOUND THEN _revivido := true; END IF;
  END IF;

  IF _lead.id IS NULL THEN
    INSERT INTO public.leads_campana (
      nombre, telefono, pais, origen, etapa_venta, bot_activo,
      ha_respondido, fecha_respuesta, primer_contacto_at, ultimo_contacto_at,
      escalado_ia_at, escalado_ia_motivo
    ) VALUES (
      COALESCE(NULLIF(btrim(_nombre), ''), 'Contacto WhatsApp ' || right(_tel, 4)),
      _tel, NULLIF(btrim(_pais), ''), 'whatsapp_inbound', 'contactado', false,
      true, now(), now(), now(),
      now(), COALESCE(NULLIF(btrim(_motivo), ''), 'Captado por el bot en WhatsApp')
    ) RETURNING * INTO _lead;

    INSERT INTO public.leads_campana_etapa_log (lead_id, etapa_anterior, etapa_nueva, user_id)
    VALUES (_lead.id, NULL, 'contactado', NULL);

    PERFORM public.notificar_admins('lead_captado_ia',
      '🤖 Lead nuevo captado por la IA: ' || _lead.nombre,
      COALESCE(_motivo, '') || ' · ' || _tel || ' · sin asignar',
      _lead.id, '/admin/vendedores');

    RETURN QUERY SELECT _lead.id, _lead.vendedor_id, NULL::text, 'contactado'::text, false, true, false;
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
      etapa_venta        = _next,
      archivado          = false,
      nombre             = CASE
        WHEN COALESCE(NULLIF(btrim(_nombre), ''), '') <> ''
         AND (nombre IS NULL OR btrim(nombre) = '' OR nombre ILIKE 'Contacto WhatsApp %')
        THEN btrim(_nombre) ELSE nombre END
  WHERE id = _lead.id;

  IF _next IS DISTINCT FROM _prev THEN
    INSERT INTO public.leads_campana_etapa_log (lead_id, etapa_anterior, etapa_nueva, user_id)
    VALUES (_lead.id, _prev, _next, NULL);
  END IF;

  -- Solo se avisa la primera vez que la IA lo capta: si no, cada mensaje
  -- del bot generaria una notificacion nueva por el mismo lead.
  IF _lead.escalado_ia_at IS NULL THEN
    IF _lead.vendedor_id IS NOT NULL THEN
      PERFORM public.notificar(_lead.vendedor_id, 'lead_captado_ia',
        '🤖 La IA captó a tu lead: ' || COALESCE(_lead.nombre, _tel),
        COALESCE(_motivo, ''), _lead.id, '/mis-leads/pipeline');
    ELSE
      PERFORM public.notificar_admins('lead_captado_ia',
        '🤖 Lead captado por la IA: ' || COALESCE(_lead.nombre, _tel),
        COALESCE(_motivo, '') || ' · sin asignar', _lead.id, '/admin/vendedores');
    END IF;
  END IF;

  RETURN QUERY SELECT _lead.id, _lead.vendedor_id, _prev, _next,
                      (_lead.escalado_ia_at IS NOT NULL), false, _revivido;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bot_capta_lead(text, text, text, text) FROM anon, authenticated, PUBLIC;

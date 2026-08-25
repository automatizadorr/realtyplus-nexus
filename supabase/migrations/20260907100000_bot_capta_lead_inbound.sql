-- =====================================================================
-- El bot ya no pierde a los inbound que no estan en la campana.
--
-- bot_capta_lead solo sabia marcar leads que YA existian en
-- leads_campana. Si alguien escribia al WhatsApp del bot sin estar en la
-- campana -- un inbound nuevo, alguien que llego por la web o por un
-- anuncio -- conversaba, agendaba reunion, y se perdia: la funcion
-- devolvia "lead no encontrado" y no quedaba ninguna ficha en el CRM.
--
-- Ahora, si no existe, se crea. Sigue sin asignar vendedor: el reparto
-- es manual y eso no cambia.
--
-- Orden de busqueda (importa):
--   1) lead vivo con ese telefono  -> se marca
--   2) lead archivado con ese telefono -> se revive y se marca. Si la
--      persona esta conversando con el bot ahora mismo, el motivo por el
--      que se archivo (duplicado, numero inmarcable) ya no aplica. Ademas
--      telefono es UNIQUE: insertar uno nuevo reventaria la constraint.
--   3) no existe -> se crea con origen 'whatsapp_inbound'
-- =====================================================================

DROP FUNCTION IF EXISTS public.bot_capta_lead(text, text);

CREATE OR REPLACE FUNCTION public.bot_capta_lead(
  _telefono text,
  _motivo   text DEFAULT 'Escalado por el bot',
  _nombre   text DEFAULT NULL,
  _pais     text DEFAULT NULL
)
RETURNS TABLE (
  lead_id        uuid,
  vendedor_id    uuid,
  etapa_anterior text,
  etapa_nueva    text,
  ya_estaba      boolean,
  creado         boolean,
  revivido       boolean
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
  _creado   boolean := false;
  _revivido boolean := false;
BEGIN
  IF _tel = '' THEN
    RAISE EXCEPTION 'telefono requerido';
  END IF;

  -- 1) Lead vivo. Match por ultimos 9 digitos, para que el mismo numero
  -- escrito con o sin prefijo de pais calce. El marcador 'sin-tel-<uuid>'
  -- queda fuera: sus digitos sueltos podrian calzar por casualidad.
  SELECT * INTO _lead
  FROM public.leads_campana
  WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
    AND telefono NOT LIKE 'sin-tel-%'
    AND COALESCE(archivado, false) = false
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  -- 2) Lead archivado con ese mismo telefono.
  IF NOT FOUND THEN
    SELECT * INTO _lead
    FROM public.leads_campana
    WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
      AND telefono NOT LIKE 'sin-tel-%'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
    IF FOUND THEN
      _revivido := true;
    END IF;
  END IF;

  -- 3) No existe en ninguna parte: se crea.
  IF _lead.id IS NULL THEN
    INSERT INTO public.leads_campana (
      nombre, telefono, pais, origen, etapa_venta, bot_activo,
      ha_respondido, fecha_respuesta, primer_contacto_at, ultimo_contacto_at,
      escalado_ia_at, escalado_ia_motivo
    ) VALUES (
      COALESCE(NULLIF(btrim(_nombre), ''), 'Contacto WhatsApp ' || right(_tel, 4)),
      _tel,
      NULLIF(btrim(_pais), ''),
      'whatsapp_inbound',
      'contactado',
      false,
      true, now(), now(), now(),
      now(), COALESCE(NULLIF(btrim(_motivo), ''), 'Captado por el bot en WhatsApp')
    )
    RETURNING * INTO _lead;

    INSERT INTO public.leads_campana_etapa_log (lead_id, etapa_anterior, etapa_nueva, user_id)
    VALUES (_lead.id, NULL, 'contactado', NULL);

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
      -- Si el lead no traia nombre util, se aprovecha el del perfil de WhatsApp.
      nombre             = CASE
        WHEN COALESCE(NULLIF(btrim(_nombre), ''), '') <> ''
         AND (nombre IS NULL OR btrim(nombre) = '' OR nombre ILIKE 'Contacto WhatsApp %')
        THEN btrim(_nombre) ELSE nombre END
  WHERE id = _lead.id;

  IF _next IS DISTINCT FROM _prev THEN
    INSERT INTO public.leads_campana_etapa_log (lead_id, etapa_anterior, etapa_nueva, user_id)
    VALUES (_lead.id, _prev, _next, NULL);
  END IF;

  RETURN QUERY SELECT _lead.id, _lead.vendedor_id, _prev, _next,
                      (_lead.escalado_ia_at IS NOT NULL), _creado, _revivido;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bot_capta_lead(text, text, text, text) FROM anon, authenticated, PUBLIC;

COMMENT ON FUNCTION public.bot_capta_lead(text, text, text, text) IS
  'Captacion por el bot de WhatsApp: marca el lead, lo sube a contactado y lo crea si no existia. Solo service_role.';

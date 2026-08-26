-- =====================================================================
-- Capturar la respuesta al recordatorio SIN tocar el flujo de Sofía.
--
-- El recordatorio de T-5 h pide confirmar o reagendar. Alguien tiene que
-- escuchar esa respuesta. La alternativa era meter un nodo mas en el
-- workflow de Sofía, que tiene mas de sesenta y atiende toda la operacion:
-- cualquier error ahi deja al bot mudo.
--
-- En cambio, todo mensaje entrante ya se guarda en mensajes_automatizacion.
-- Un trigger sobre esa tabla escucha gratis, no puede romper el bot (va en
-- un bloque EXCEPTION que se traga cualquier fallo) y funciona igual si
-- manana el mensaje entra por otro camino.
--
-- Aca SI corresponde un trigger, al reves que en leads_campana: los
-- mensajes entran de a uno, no en lotes de cientos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- recordatorio_respuesta(): ahora exige que el recordatorio EXISTA.
--
-- Sin ese filtro, cualquier "dale" u "ok" en medio de una conversacion
-- normal marcaria la reunion como confirmada y le mandaria un aviso al
-- vendedor. Se interpreta como respuesta al recordatorio solo si el
-- recordatorio de T-5 h salio de verdad y el mensaje llego despues.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.recordatorio_respuesta(text, text);

CREATE OR REPLACE FUNCTION public.recordatorio_respuesta(
  _telefono text,
  _texto    text,
  _forzar   boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a      public.agendamientos%ROWTYPE;
  _lead   public.leads_campana%ROWTYPE;
  _t      text := lower(btrim(COALESCE(_texto, '')));
  _accion text;
  _cuando text;
  _titulo text;
  _envio  timestamptz;
BEGIN
  -- La reunion viva mas proxima de ese telefono.
  SELECT a.* INTO _a
  FROM public.agendamientos a
  JOIN public.leads_campana l ON l.id = a.lead_id
  WHERE public.tel_norm(l.telefono) = public.tel_norm(_telefono)
    AND a.estado <> 'cancelada'
    AND a.fecha_inicio > now() - interval '30 minutes'
  ORDER BY a.fecha_inicio
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accion', 'sin_reunion');
  END IF;

  -- ¿Le mandamos el recordatorio y esto llego despues?
  SELECT r.enviado_at INTO _envio
  FROM public.recordatorios_envios r
  WHERE r.agendamiento_id = _a.id AND r.tipo = 'previo'
  ORDER BY r.enviado_at DESC
  LIMIT 1;

  IF NOT _forzar AND (_envio IS NULL OR _envio < now() - interval '8 hours') THEN
    RETURN jsonb_build_object('accion', 'sin_recordatorio', 'agendamiento_id', _a.id);
  END IF;

  SELECT * INTO _lead FROM public.leads_campana WHERE id = _a.lead_id;

  IF _t ~ '(confirm|ahi estar|allí estar|alli estar|nos vemos|^si$|^sí$|^dale$|^ok$|^listo$|^si,|^sí,)' THEN
    _accion := 'confirmada';
  ELSIF _t ~ '(reagend|reprogram|cambiar la hora|mover la|otro día|otro dia|no puedo|no podré|no podre)' THEN
    _accion := 'reagendar';
  ELSE
    RETURN jsonb_build_object('accion', 'sin_clasificar', 'agendamiento_id', _a.id);
  END IF;

  _cuando := to_char(_a.fecha_inicio AT TIME ZONE 'America/Santiago', 'DD/MM/YYYY HH24:MI');

  IF _accion = 'confirmada' THEN
    -- Idempotente: si ya estaba confirmada, no se vuelve a avisar.
    IF _a.confirmada_at IS NOT NULL THEN
      RETURN jsonb_build_object('accion', 'ya_confirmada', 'agendamiento_id', _a.id);
    END IF;
    UPDATE public.agendamientos SET confirmada_at = now(), updated_at = now() WHERE id = _a.id;
    _titulo := 'Reunión CONFIRMADA: ' || COALESCE(_lead.nombre, 'un lead');
  ELSE
    _titulo := 'Pide reagendar: ' || COALESCE(_lead.nombre, 'un lead');
  END IF;

  -- Avisar a quien tiene la reunion en su agenda.
  IF _lead.vendedor_id IS NOT NULL THEN
    PERFORM public.notificar(_lead.vendedor_id, 'agendamiento_cambio', _titulo,
      _cuando || ' · ' || COALESCE(_lead.telefono, ''), _a.lead_id, '/mis-leads/pipeline');
  ELSE
    PERFORM public.notificar_admins('agendamiento_cambio', _titulo,
      _cuando || ' · lead sin asignar', _a.lead_id, '/admin/vendedores');
  END IF;

  RETURN jsonb_build_object(
    'accion', _accion,
    'agendamiento_id', _a.id,
    'lead_id', _a.lead_id,
    'fecha', _a.fecha_inicio,
    'cuando', _cuando
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recordatorio_respuesta(text, text, boolean) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- El trigger. Nunca puede tumbar el INSERT del mensaje: si algo falla
-- adentro, se ignora y el bot sigue como si nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_recordatorio_respuesta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direccion = 'inbound' AND COALESCE(btrim(NEW.contenido), '') <> '' THEN
    BEGIN
      PERFORM public.recordatorio_respuesta(NEW.telefono, NEW.contenido);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recordatorio_respuesta_inbound ON public.mensajes_automatizacion;
CREATE TRIGGER recordatorio_respuesta_inbound
  AFTER INSERT ON public.mensajes_automatizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_recordatorio_respuesta();

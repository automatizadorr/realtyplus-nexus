-- =====================================================================
-- Cola de trabajo del vendedor ("Hoy") + registro de paso en una sola
-- llamada.
--
-- Problema que resuelve, con las palabras de Mario: "se pierden leads"
-- y "demasiadas pestanas y pasos".
--
-- El CRM ya sabia TODO lo que hacia falta para decidir a quien tocar
-- ahora (respuestas, reuniones agendadas, traspasos, seguimientos
-- vencidos, leads sin contactar), pero esa informacion estaba repartida
-- en cuatro pantallas distintas y el vendedor tenia que armar la lista
-- en su cabeza. Aca se arma sola, del lado del servidor, ordenada por
-- urgencia real.
--
-- Regla de oro (la de Pipedrive): un lead vivo SIEMPRE tiene proximo
-- paso con fecha. Si no lo tiene, esta podrido y la cola lo grita.
-- Por eso vendedor_registrar_paso nunca deja el lead sin fecha: si el
-- vendedor no elige una, la pone la funcion.
-- =====================================================================

-- Los filtros que usa la cola en cada consulta.
CREATE INDEX IF NOT EXISTS leads_campana_cola_idx
  ON public.leads_campana (vendedor_id, etapa_venta, fecha_proximo_contacto)
  WHERE archivado IS NOT TRUE;

-- Re-ejecutable: el tipo de retorno de estas funciones cambio durante el
-- desarrollo y CREATE OR REPLACE no puede cambiarlo. Se dropean en orden
-- inverso a la dependencia (hoy y resumen se apoyan en calc).
DROP FUNCTION IF EXISTS public.vendedor_cola_hoy(text, int);
DROP FUNCTION IF EXISTS public.vendedor_registrar_paso(uuid, text, text, text, timestamptz, int, text, text, uuid);
DROP FUNCTION IF EXISTS public.vendedor_cola_resumen(text);
DROP FUNCTION IF EXISTS public.vendedor_cola_calc(text);

-- ---------------------------------------------------------------------
-- vendedor_cola_calc(): un lead por fila, con el motivo MAS urgente por
-- el que pide atencion. Un lead nunca sale dos veces: los motivos se
-- evaluan en cascada y gana el primero.
--
-- _tz es la zona horaria del vendedor (el front manda la del navegador).
-- Sin eso, "hoy" seria el dia UTC y a las 21:00 en Mexico la cola ya
-- estaria mostrando el dia siguiente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_cola_calc(_tz text)
RETURNS TABLE (
  id                     uuid,
  nombre                 text,
  telefono               text,
  email                  text,
  pais                   text,
  etapa_venta            text,
  ha_respondido          boolean,
  resumen_ia             text,
  instagram              text,
  facebook               text,
  mensaje_instagram      text,
  notas_vendedor         text,
  origen                 text,
  fecha_asignacion       timestamptz,
  primer_contacto_at     timestamptz,
  ultimo_contacto_at     timestamptz,
  fecha_proximo_contacto timestamptz,
  traspasado_at          timestamptz,
  escalado_ia_at         timestamptz,
  escalado_ia_motivo     text,
  reunion_at             timestamptz,
  motivo                 text,
  motivo_texto           text,
  prioridad              int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH limites AS (
    SELECT
      (date_trunc('day', now() AT TIME ZONE _tz)) AT TIME ZONE _tz AS hoy_ini,
      ((date_trunc('day', now() AT TIME ZONE _tz) + interval '1 day') AT TIME ZONE _tz) AS manana_ini
  ),
  base AS (
    SELECT l.*
    FROM public.leads_campana l
    WHERE l.vendedor_id = auth.uid()
      AND coalesce(l.archivado, false) = false
      -- Un lead cerrado (ganado o perdido) ya no pide trabajo.
      AND l.etapa_venta NOT IN ('ganado', 'perdido')
  ),
  con_reunion AS (
    SELECT b.*, r.fecha_inicio AS reunion_at
    FROM base b
    LEFT JOIN LATERAL (
      SELECT a.fecha_inicio
      FROM public.agendamientos a
      WHERE a.lead_id = b.id
        AND a.estado <> 'cancelada'
        -- La reunion sigue siendo "de ahora" hasta 2 h despues de empezar:
        -- si el vendedor no la marco, tiene que verla igual.
        AND a.fecha_inicio >= now() - interval '2 hours'
      ORDER BY a.fecha_inicio
      LIMIT 1
    ) r ON true
  ),
  clasificado AS (
    SELECT
      c.*,
      CASE
        -- 1. Reunion dentro de las proximas 24 h: nada gana a esto.
        WHEN c.reunion_at IS NOT NULL AND c.reunion_at < now() + interval '24 hours'
          THEN 'reunion'
        -- 2. Contesto y todavia nadie le respondio. La ventana de
        --    respuesta es el activo mas perecible del embudo.
        WHEN c.ha_respondido IS TRUE
             AND (c.ultimo_contacto_at IS NULL
                  OR coalesce(c.fecha_respuesta, c.escalado_ia_at, c.ultimo_contacto_at) > c.ultimo_contacto_at)
          THEN 'respondio'
        -- 3. El bot escalo la conversacion a humano y nadie la tomo.
        WHEN c.escalado_ia_at IS NOT NULL
             AND (c.ultimo_contacto_at IS NULL OR c.escalado_ia_at > c.ultimo_contacto_at)
          THEN 'escalado'
        -- 4. Traspaso setter -> closer sin tocar: el lead llego calificado
        --    y se enfria mientras espera.
        WHEN c.traspasado_at IS NOT NULL
             AND (c.ultimo_contacto_at IS NULL OR c.traspasado_at > c.ultimo_contacto_at)
          THEN 'traspaso'
        -- 5. Seguimiento que ya vencio.
        WHEN c.fecha_proximo_contacto IS NOT NULL
             AND c.fecha_proximo_contacto < (SELECT hoy_ini FROM limites)
          THEN 'vencido'
        -- 6. Seguimiento programado para hoy.
        WHEN c.fecha_proximo_contacto IS NOT NULL
             AND c.fecha_proximo_contacto < (SELECT manana_ini FROM limites)
          THEN 'hoy'
        -- 7. Asignado y nunca contactado (lo que hoy vive en la Bandeja).
        WHEN c.primer_contacto_at IS NULL
          THEN 'nuevo'
        -- 8. Vivo, contactado y SIN proximo paso hace 3 dias o mas: el
        --    lead podrido de Pipedrive. Es la fuga que Mario ve como
        --    "se pierden leads".
        WHEN c.fecha_proximo_contacto IS NULL
             AND coalesce(c.ultimo_contacto_at, c.primer_contacto_at) < now() - interval '3 days'
          THEN 'sin_plan'
        ELSE NULL
      END AS motivo
    FROM con_reunion c
  )
  SELECT
    c.id, c.nombre, c.telefono, c.email, c.pais, c.etapa_venta, c.ha_respondido,
    c.resumen_ia, c.instagram, c.facebook, c.mensaje_instagram, c.notas_vendedor, c.origen,
    c.fecha_asignacion, c.primer_contacto_at, c.ultimo_contacto_at, c.fecha_proximo_contacto,
    c.traspasado_at, c.escalado_ia_at, c.escalado_ia_motivo, c.reunion_at,
    c.motivo,
    CASE c.motivo
      WHEN 'reunion'   THEN 'Reunion ' || to_char(c.reunion_at AT TIME ZONE _tz, 'DD/MM HH24:MI')
      WHEN 'respondio' THEN 'Respondio y espera'
      WHEN 'escalado'  THEN coalesce('IA escalo: ' || c.escalado_ia_motivo, 'La IA escalo a humano')
      WHEN 'traspaso'  THEN 'Calificado y traspasado: primer toque pendiente'
      WHEN 'vencido'   THEN 'Seguimiento vencido hace '
                            || greatest(1, (date_part('day', (SELECT hoy_ini FROM limites) - c.fecha_proximo_contacto))::int)::text
                            || ' d'
      WHEN 'hoy'       THEN 'Seguimiento para hoy'
      WHEN 'nuevo'     THEN 'Sin contactar hace '
                            || greatest(0, (date_part('day', now() - coalesce(c.fecha_asignacion, c.created_at)))::int)::text
                            || ' d'
      WHEN 'sin_plan'  THEN 'Sin proximo paso definido'
    END AS motivo_texto,
    CASE c.motivo
      WHEN 'reunion'   THEN 1
      WHEN 'respondio' THEN 2
      WHEN 'escalado'  THEN 3
      WHEN 'traspaso'  THEN 4
      WHEN 'vencido'   THEN 5
      WHEN 'hoy'       THEN 6
      WHEN 'nuevo'     THEN 7
      WHEN 'sin_plan'  THEN 8
    END AS prioridad
  FROM clasificado c
  WHERE c.motivo IS NOT NULL
  ORDER BY
    prioridad,
    -- Dentro del mismo motivo: primero lo que lleva mas tiempo esperando.
    coalesce(c.reunion_at, c.fecha_proximo_contacto, c.escalado_ia_at, c.traspasado_at, c.fecha_asignacion, c.created_at),
    c.id;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_cola_calc(text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_cola_calc(text) TO authenticated;

COMMENT ON FUNCTION public.vendedor_cola_calc(text) IS
  'Motor de la cola: clasifica cada lead vivo del vendedor con el motivo mas urgente. Sin limite -- la usan vendedor_cola_hoy (paginada) y vendedor_cola_resumen (contadores).';

-- ---------------------------------------------------------------------
-- vendedor_cola_hoy(): lo que consume la pantalla. Misma cola, cortada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_cola_hoy(
  _tz     text DEFAULT 'America/Santiago',
  _limite int  DEFAULT 60
)
RETURNS TABLE (
  id                     uuid,
  nombre                 text,
  telefono               text,
  email                  text,
  pais                   text,
  etapa_venta            text,
  ha_respondido          boolean,
  resumen_ia             text,
  instagram              text,
  facebook               text,
  mensaje_instagram      text,
  notas_vendedor         text,
  origen                 text,
  fecha_asignacion       timestamptz,
  primer_contacto_at     timestamptz,
  ultimo_contacto_at     timestamptz,
  fecha_proximo_contacto timestamptz,
  traspasado_at          timestamptz,
  escalado_ia_at         timestamptz,
  escalado_ia_motivo     text,
  reunion_at             timestamptz,
  motivo                 text,
  motivo_texto           text,
  prioridad              int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT * FROM public.vendedor_cola_calc(_tz)
  LIMIT greatest(1, least(_limite, 500));
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_cola_hoy(text, int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_cola_hoy(text, int) TO authenticated;

COMMENT ON FUNCTION public.vendedor_cola_hoy(text, int) IS
  'Cola de trabajo priorizada del vendedor: un lead por fila con el motivo mas urgente por el que pide atencion hoy.';

-- ---------------------------------------------------------------------
-- vendedor_cola_resumen(): los contadores del encabezado y del badge,
-- sin traerse las filas completas al front.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_cola_resumen(_tz text DEFAULT 'America/Santiago')
RETURNS TABLE (
  total      bigint,
  urgentes   bigint,
  reuniones  bigint,
  respuestas bigint,
  vencidos   bigint,
  nuevos     bigint,
  sin_plan   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    count(*)                                                    AS total,
    count(*) FILTER (WHERE prioridad <= 4)                      AS urgentes,
    count(*) FILTER (WHERE motivo = 'reunion')                  AS reuniones,
    count(*) FILTER (WHERE motivo IN ('respondio', 'escalado')) AS respuestas,
    count(*) FILTER (WHERE motivo = 'vencido')                  AS vencidos,
    count(*) FILTER (WHERE motivo = 'nuevo')                    AS nuevos,
    count(*) FILTER (WHERE motivo = 'sin_plan')                 AS sin_plan
  FROM public.vendedor_cola_calc(_tz);
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_cola_resumen(text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_cola_resumen(text) TO authenticated;

-- ---------------------------------------------------------------------
-- vendedor_registrar_paso(): TODO lo que pasa despues de tocar un lead,
-- en una sola llamada.
--
-- Antes, dejar un lead bien cerrado eran cuatro acciones separadas en
-- dos pantallas: registrar el contacto, mover la etapa, agendar el
-- proximo toque y anotar. Cada una se podia olvidar -- y la que mas se
-- olvidaba era la fecha del proximo toque, que es justo la que evita
-- que el lead se pierda.
--
-- Prioridad de la fecha del proximo paso:
--   _proximo_at explicito > _dias explicito > default por etapa.
-- Nunca queda NULL para un lead vivo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_registrar_paso(
  _lead_id      uuid,
  _canal        text,
  _resultado    text        DEFAULT NULL,
  _nota         text        DEFAULT NULL,
  _proximo_at   timestamptz DEFAULT NULL,
  _dias         int         DEFAULT NULL,
  _etapa        text        DEFAULT NULL,
  _mensaje      text        DEFAULT NULL,
  _plantilla_id uuid        DEFAULT NULL,
  _reunion_at   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _lead        public.leads_campana%ROWTYPE;
  _proximo     timestamptz;
  _etapa_final text;
  _mover       jsonb := NULL;
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _canal NOT IN ('whatsapp', 'email', 'llamada', 'instagram', 'facebook', 'nota') THEN
    RAISE EXCEPTION 'Canal invalido: %', _canal;
  END IF;

  SELECT * INTO _lead
  FROM public.leads_campana
  WHERE id = _lead_id AND vendedor_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  -- 1) Mover etapa primero: puede disparar el traspaso al closer, y si
  --    eso pasa el lead deja de ser nuestro, asi que el resto del paso
  --    se aplica sobre el estado ya movido.
  IF _etapa IS NOT NULL AND _etapa <> _lead.etapa_venta THEN
    _mover := public.vendedor_mover_etapa(_lead_id, _etapa, NULLIF(btrim(coalesce(_nota, '')), ''));
  END IF;

  SELECT etapa_venta INTO _etapa_final FROM public.leads_campana WHERE id = _lead_id;

  -- 2) Registrar el contacto. Una nota suelta no es un contacto: no
  --    ensucia las metricas de actividad por canal.
  IF _canal <> 'nota' THEN
    INSERT INTO public.contactos_log (lead_id, user_id, canal, resultado, mensaje_final, plantilla_id, origen)
    -- origen tiene CHECK ('prospeccion' | 'leads_campana'): la cola trabaja
    -- sobre leads_campana. De donde salio el toque queda en resultado.
    VALUES (_lead_id, auth.uid(), _canal, _resultado, _mensaje, _plantilla_id, 'leads_campana');
  END IF;

  -- 2.b) Reunion agendada a mano por el vendedor. Hasta ahora la tabla
  --      agendamientos solo la llenaba el bot, asi que una reunion
  --      cerrada por telefono no aparecia ni en la Agenda ni arriba de
  --      la cola. Se usa el mismo UNIQUE (lead_id, fecha_inicio) que usa
  --      el bot para reagendar sin duplicar.
  IF _reunion_at IS NOT NULL THEN
    INSERT INTO public.agendamientos (lead_id, fecha_inicio, estado, origen, notas)
    VALUES (_lead_id, _reunion_at, 'agendada', 'vendedor', NULLIF(btrim(coalesce(_nota, '')), ''))
    ON CONFLICT (lead_id, fecha_inicio) DO UPDATE
      SET estado = 'agendada', updated_at = now();
  END IF;

  -- 3) Proximo paso. El default sale de la etapa en la que quedo el lead:
  --    cuanto mas caliente, mas corto el intervalo.
  -- Si el lead va a pasar solo de 'nuevo' a 'contactado' (primer toque),
  -- el default tiene que salir de la etapa en la que VA A QUEDAR, no de
  -- la que ya dejo de tener.
  IF _etapa IS NULL AND _canal <> 'nota' AND _etapa_final = 'nuevo' THEN
    _etapa_final := 'contactado';
  END IF;

  _proximo := COALESCE(
    _proximo_at,
    CASE WHEN _dias IS NOT NULL THEN now() + make_interval(days => greatest(0, _dias)) END,
    now() + CASE _etapa_final
              WHEN 'demo'       THEN interval '1 day'
              WHEN 'interesado' THEN interval '1 day'
              WHEN 'contactado' THEN interval '2 days'
              ELSE interval '1 day'
            END
  );

  -- 4) Un lead cerrado no lleva proximo paso: la cola no debe volver a
  --    pedirlo nunca mas.
  IF _etapa_final IN ('ganado', 'perdido') THEN
    _proximo := NULL;
  END IF;

  UPDATE public.leads_campana
  SET primer_contacto_at     = CASE WHEN _canal = 'nota' THEN primer_contacto_at
                                    ELSE COALESCE(primer_contacto_at, now()) END,
      ultimo_contacto_at     = CASE WHEN _canal = 'nota' THEN ultimo_contacto_at ELSE now() END,
      fecha_proximo_contacto = _proximo,
      notas_vendedor         = CASE
                                 WHEN NULLIF(btrim(coalesce(_nota, '')), '') IS NULL THEN notas_vendedor
                                 WHEN coalesce(btrim(notas_vendedor), '') = '' THEN
                                   to_char(now(), 'DD/MM HH24:MI') || ' - ' || btrim(_nota)
                                 ELSE notas_vendedor || chr(10) || to_char(now(), 'DD/MM HH24:MI') || ' - ' || btrim(_nota)
                               END,
      -- Un lead que estaba "nuevo" y acaba de recibir su primer toque ya
      -- no es nuevo: entra al Pipeline como contactado sin pedir un clic
      -- extra. (Si el vendedor eligio etapa a mano, manda la suya.)
      etapa_venta            = CASE
                                 WHEN _etapa IS NULL AND _canal <> 'nota' AND etapa_venta = 'nuevo'
                                   THEN 'contactado'
                                 ELSE etapa_venta
                               END
  WHERE id = _lead_id;

  RETURN jsonb_build_object(
    'ok', true,
    'etapa', (SELECT etapa_venta FROM public.leads_campana WHERE id = _lead_id),
    'proximo_contacto', _proximo,
    'movimiento', _mover
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_registrar_paso(uuid, text, text, text, timestamptz, int, text, text, uuid, timestamptz) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_registrar_paso(uuid, text, text, text, timestamptz, int, text, text, uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.vendedor_registrar_paso(uuid, text, text, text, timestamptz, int, text, text, uuid, timestamptz) IS
  'Cierra el toque a un lead en una sola llamada: registra el contacto, mueve la etapa, agenda el proximo paso y anota. Nunca deja un lead vivo sin proximo paso.';

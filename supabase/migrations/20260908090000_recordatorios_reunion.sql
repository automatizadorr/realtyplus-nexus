-- =====================================================================
-- Recordatorios de reunion.
--
-- Una reunion agendada que el lead olvida es peor que no haberla
-- agendado: el vendedor bloqueo la hora y se queda esperando. Van dos
-- avisos por WhatsApp antes de cada cita:
--
--   T-5 h  pide confirmar o reagendar  (botones)
--   T-1 h  recordatorio corto con el link
--
-- LA RESTRICCION DE SIEMPRE: fuera de las 24 h desde el ultimo mensaje
-- del lead, WhatsApp solo deja salir plantillas HSM. Una reunion se suele
-- agendar dias antes, asi que el aviso de T-5 h cae casi siempre FUERA de
-- la ventana. Por eso cada recordatorio tiene dos formas:
--
--   ventana abierta (el lead escribio hace menos de 23 h) -> texto libre
--   ventana cerrada                                       -> plantilla HSM
--
-- La RPC decide cual toca y n8n solo obedece. Y como la plantilla de
-- T-5 h lleva botones de respuesta rapida, tocar "Confirmo" cuenta como
-- mensaje del lead: eso ABRE la ventana, y el aviso de T-1 h ya sale como
-- texto libre. Encadenado a proposito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Confirmacion del lead sobre una reunion concreta.
--
-- Columna y no un estado nuevo en el CHECK de `estado`: confirmar no es
-- una transicion, es un dato extra sobre una reunion que sigue agendada.
-- Meterlo en `estado` obligaria a tocar el CHECK, el calendario y toda la
-- UI que hoy mapea tres estados.
-- ---------------------------------------------------------------------
ALTER TABLE public.agendamientos
  ADD COLUMN IF NOT EXISTS confirmada_at timestamptz;

COMMENT ON COLUMN public.agendamientos.confirmada_at IS
  'El lead confirmo asistencia respondiendo el recordatorio de T-5 h.';

-- ---------------------------------------------------------------------
-- Config: los tiempos son editables sin tocar codigo.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recordatorios_config (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),
  activo            boolean NOT NULL DEFAULT true,
  minutos_previo    int NOT NULL DEFAULT 300,  -- 5 h
  minutos_inminente int NOT NULL DEFAULT 60,   -- 1 h
  hora_local_desde  int NOT NULL DEFAULT 8,
  hora_local_hasta  int NOT NULL DEFAULT 22,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.recordatorios_config (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.recordatorios_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan config de recordatorios" ON public.recordatorios_config;
CREATE POLICY "Admins gestionan config de recordatorios"
  ON public.recordatorios_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- Las dos piezas. Cada una guarda su version libre y su plantilla.
--
-- `plantilla_nombre` nace vacio: mientras Meta no apruebe las plantillas,
-- los recordatorios con la ventana cerrada simplemente no salen, en vez de
-- salir rotos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recordatorio_plantillas (
  tipo             text PRIMARY KEY CHECK (tipo IN ('previo', 'inminente')),
  nombre           text NOT NULL,
  cuerpo_libre     text NOT NULL,
  plantilla_nombre text,
  plantilla_idioma text NOT NULL DEFAULT 'es',
  activa           boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recordatorio_plantillas IS
  'Texto de los recordatorios. {{nombre}} {{fecha}} {{hora}} {{link}} se reemplazan al armar la cola.';

ALTER TABLE public.recordatorio_plantillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan piezas de recordatorio" ON public.recordatorio_plantillas;
CREATE POLICY "Admins gestionan piezas de recordatorio"
  ON public.recordatorio_plantillas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedores leen piezas de recordatorio" ON public.recordatorio_plantillas;
CREATE POLICY "Vendedores leen piezas de recordatorio"
  ON public.recordatorio_plantillas FOR SELECT
  USING (public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid()));

INSERT INTO public.recordatorio_plantillas (tipo, nombre, cuerpo_libre) VALUES
  ('previo', 'Confirmacion 5 h antes',
   E'{{nombre}}, te recuerdo tu reunión de hoy a las {{hora}} con LexHouse AI.\n\n¿La confirmamos? Si te cambió la agenda, dime y la movemos sin problema.'),
  ('inminente', 'Aviso 1 h antes',
   E'{{nombre}}, tu reunión con LexHouse AI empieza en un rato, a las {{hora}}.\n\nNos vemos.{{link}}')
ON CONFLICT (tipo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Registro de envios. Es lo que hace el flujo idempotente: si el cron
-- corre dos veces, o n8n reintenta, el UNIQUE impide el segundo mensaje.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recordatorios_envios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamiento_id uuid NOT NULL REFERENCES public.agendamientos(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES public.leads_campana(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('previo', 'inminente')),
  modo            text CHECK (modo IN ('libre', 'plantilla')),
  enviado_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recordatorios_envios_uq
  ON public.recordatorios_envios (agendamiento_id, tipo);

CREATE INDEX IF NOT EXISTS recordatorios_envios_lead_idx
  ON public.recordatorios_envios (lead_id, enviado_at DESC);

ALTER TABLE public.recordatorios_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen envios de recordatorio" ON public.recordatorios_envios;
CREATE POLICY "Admins leen envios de recordatorio"
  ON public.recordatorios_envios FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- registrar_agendamiento(): al reagendar, la reunion vieja se da de baja.
--
-- Antes quedaban las dos filas vivas, porque el UNIQUE es
-- (lead_id, fecha_inicio) y una fecha nueva inserta una fila nueva. Con
-- los recordatorios eso pasa de ser feo a ser un error caro: el lead
-- recibiria el aviso de una reunion que ya movio. Ahora una reunion nueva
-- o modificada cancela las demas futuras del mismo lead.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_agendamiento(
  _lead_id  uuid,
  _fecha    timestamptz,
  _estado   text DEFAULT 'agendada',
  _fin      timestamptz DEFAULT NULL,
  _origen   text DEFAULT NULL,
  _meet     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id     uuid;
  _lead   public.leads_campana%ROWTYPE;
  _cuando text;
  _titulo text;
BEGIN
  IF _fecha IS NULL THEN RETURN NULL; END IF;
  IF _estado NOT IN ('agendada','modificada','cancelada') THEN _estado := 'agendada'; END IF;

  SELECT * INTO _lead FROM public.leads_campana WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.agendamientos (lead_id, fecha_inicio, fecha_fin, estado, origen, meet_link)
  VALUES (_lead_id, _fecha, COALESCE(_fin, _fecha + interval '1 hour'), _estado, _origen, _meet)
  ON CONFLICT (lead_id, fecha_inicio) DO UPDATE
    SET estado    = EXCLUDED.estado,
        fecha_fin = COALESCE(EXCLUDED.fecha_fin, public.agendamientos.fecha_fin),
        meet_link = COALESCE(EXCLUDED.meet_link, public.agendamientos.meet_link),
        origen    = COALESCE(EXCLUDED.origen, public.agendamientos.origen),
        updated_at = now()
  RETURNING id INTO _id;

  -- Una sola reunion viva por lead: la que se acaba de declarar.
  IF _estado <> 'cancelada' THEN
    UPDATE public.agendamientos
    SET estado = 'cancelada', updated_at = now()
    WHERE lead_id = _lead_id
      AND id <> _id
      AND estado <> 'cancelada'
      AND fecha_inicio > now();
  END IF;

  -- La hora se muestra en Santiago, que es la zona con la que opera el equipo.
  _cuando := to_char(_fecha AT TIME ZONE 'America/Santiago', 'DD/MM/YYYY HH24:MI');
  _titulo := CASE _estado
    WHEN 'cancelada'  THEN 'Reunión CANCELADA: ' || COALESCE(_lead.nombre, 'un lead')
    WHEN 'modificada' THEN 'Reunión reagendada: ' || COALESCE(_lead.nombre, 'un lead')
    ELSE 'Nueva reunión agendada: ' || COALESCE(_lead.nombre, 'un lead')
  END;

  IF _lead.vendedor_id IS NOT NULL THEN
    PERFORM public.notificar(
      _lead.vendedor_id,
      CASE WHEN _estado = 'agendada' THEN 'agendamiento_nuevo' ELSE 'agendamiento_cambio' END,
      _titulo, _cuando || ' · ' || COALESCE(_lead.telefono, ''), _lead_id, '/mis-leads/pipeline');
    IF _lead.setter_id IS NOT NULL AND _lead.setter_id <> _lead.vendedor_id THEN
      PERFORM public.notificar(_lead.setter_id, 'agendamiento_cambio', _titulo,
        'Un lead que entregaste: ' || _cuando, _lead_id, '/mis-leads/pipeline');
    END IF;
  ELSE
    PERFORM public.notificar_admins('agendamiento_nuevo', _titulo,
      _cuando || ' · lead sin asignar, repártelo desde "Asignar leads"', _lead_id, '/admin/vendedores');
  END IF;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_agendamiento(uuid, timestamptz, text, timestamptz, text, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- recordatorios_pendientes(): que hay que mandar AHORA.
--
-- Devuelve el mensaje ya resuelto y, sobre todo, `modo`: si la ventana de
-- 24 h esta abierta manda texto libre y si no, plantilla. n8n solo
-- bifurca por ese campo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recordatorios_pendientes(_limite int DEFAULT 50)
RETURNS TABLE (
  agendamiento_id  uuid,
  lead_id          uuid,
  telefono         text,
  nombre           text,
  primer_nombre    text,
  tipo             text,
  modo             text,
  fecha_inicio     timestamptz,
  fecha_local      text,
  hora_local       text,
  meet_link        text,
  cuerpo           text,
  plantilla_nombre text,
  plantilla_idioma text,
  minutos_restan   int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT * FROM public.recordatorios_config WHERE id
  ),
  -- El reloj de Meta: ultimo mensaje ENTRANTE. Vive en dos tablas, igual
  -- que en el calentamiento: mensajes_whatsapp es el canal historico y
  -- mensajes_automatizacion el de los bots actuales.
  entrantes AS (
    SELECT public.tel_norm(m.telefono) AS tel, max(m.created_at) AS cuando
    FROM (
      SELECT telefono, created_at FROM public.mensajes_whatsapp        WHERE direccion = 'inbound'
      UNION ALL
      SELECT telefono, created_at FROM public.mensajes_automatizacion  WHERE direccion = 'inbound'
    ) m
    GROUP BY 1
  ),
  candidatos AS (
    SELECT
      a.id AS ag_id, a.lead_id, a.fecha_inicio, a.meet_link,
      l.nombre, l.telefono,
      COALESCE(NULLIF(l.timezone, ''), 'America/Santiago') AS tz,
      (EXTRACT(EPOCH FROM (a.fecha_inicio - now())) / 60.0)::int AS restan,
      (e.cuando IS NOT NULL AND e.cuando > now() - interval '23 hours') AS ventana_abierta
    FROM public.agendamientos a
    JOIN public.leads_campana l ON l.id = a.lead_id
    LEFT JOIN entrantes e ON e.tel = public.tel_norm(l.telefono)
    WHERE (SELECT activo FROM cfg)
      AND a.estado <> 'cancelada'
      AND a.fecha_inicio > now()
      AND COALESCE(l.archivado, false) = false
      AND l.telefono NOT LIKE 'sin-tel-%'
  ),
  debidos AS (
    SELECT c.*,
      CASE
        WHEN c.restan <= (SELECT minutos_inminente FROM cfg) THEN 'inminente'
        ELSE 'previo'
      END AS tipo
    FROM candidatos c
    WHERE
      -- T-5 h: desde que cruza los 300 min hasta 15 min antes de que
      -- empiece la franja del aviso de T-1 h, para que no se pisen.
      ( c.restan <= (SELECT minutos_previo    FROM cfg)
        AND c.restan >  (SELECT minutos_inminente FROM cfg) + 15
        -- Nada de escribir de madrugada. Si la reunion es tan temprano
        -- que el T-5 h caeria de noche, ese aviso se salta y queda el de
        -- T-1 h, que si sale a cualquier hora porque ya es inminente.
        AND EXTRACT(HOUR FROM (now() AT TIME ZONE c.tz))
            BETWEEN (SELECT hora_local_desde FROM cfg) AND (SELECT hora_local_hasta FROM cfg)
      )
      OR
      -- T-1 h: sale siempre, aunque sea temprano. El lead eligio la hora.
      ( c.restan <= (SELECT minutos_inminente FROM cfg) AND c.restan > 8 )
  )
  SELECT
    d.ag_id, d.lead_id, d.telefono, d.nombre,
    COALESCE(NULLIF(split_part(btrim(d.nombre), ' ', 1), ''), 'Hola'),
    d.tipo,
    CASE WHEN d.ventana_abierta THEN 'libre' ELSE 'plantilla' END,
    d.fecha_inicio,
    to_char(d.fecha_inicio AT TIME ZONE d.tz, 'DD/MM/YYYY'),
    to_char(d.fecha_inicio AT TIME ZONE d.tz, 'HH24:MI'),
    d.meet_link,
    replace(
      replace(
        replace(
          replace(p.cuerpo_libre, '{{nombre}}',
                  COALESCE(NULLIF(split_part(btrim(d.nombre), ' ', 1), ''), 'Hola')),
          '{{fecha}}', to_char(d.fecha_inicio AT TIME ZONE d.tz, 'DD/MM')),
        '{{hora}}',  to_char(d.fecha_inicio AT TIME ZONE d.tz, 'HH24:MI')),
      '{{link}}', COALESCE(chr(10) || chr(10) || d.meet_link, '')),
    p.plantilla_nombre,
    p.plantilla_idioma,
    d.restan
  FROM debidos d
  JOIN public.recordatorio_plantillas p ON p.tipo = d.tipo AND p.activa
  WHERE NOT EXISTS (
      SELECT 1 FROM public.recordatorios_envios r
      WHERE r.agendamiento_id = d.ag_id AND r.tipo = d.tipo
    )
    -- Con la ventana cerrada solo se puede plantilla; si todavia no esta
    -- cargada la aprobada, ese recordatorio no sale.
    AND (d.ventana_abierta OR COALESCE(btrim(p.plantilla_nombre), '') <> '')
  ORDER BY d.restan
  LIMIT LEAST(COALESCE(_limite, 50), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.recordatorios_pendientes(int) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- recordatorio_registrar(): lo llama n8n DESPUES de que WhatsApp acepto.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recordatorio_registrar(
  _agendamiento_id uuid,
  _tipo            text,
  _modo            text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _lead uuid;
BEGIN
  IF _tipo NOT IN ('previo', 'inminente') THEN RETURN false; END IF;

  SELECT lead_id INTO _lead FROM public.agendamientos WHERE id = _agendamiento_id;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.recordatorios_envios (agendamiento_id, lead_id, tipo, modo)
  VALUES (_agendamiento_id, _lead, _tipo, _modo)
  ON CONFLICT (agendamiento_id, tipo) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recordatorio_registrar(uuid, text, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- recordatorio_respuesta(): el lead contesto el recordatorio.
--
-- La clasificacion vive aca y no en un nodo IF de n8n para que el dia que
-- cambien los textos de los botones se toque un solo lugar. Devuelve que
-- se entendio, y quien llama decide si ademas responde algo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recordatorio_respuesta(
  _telefono text,
  _texto    text
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

REVOKE EXECUTE ON FUNCTION public.recordatorio_respuesta(text, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- El calendario ahora muestra si la reunion esta confirmada.
-- Cambian las columnas devueltas, asi que no basta CREATE OR REPLACE.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.calendario_agendamientos(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.calendario_agendamientos(
  _desde timestamptz DEFAULT (now() - interval '7 days'),
  _hasta timestamptz DEFAULT (now() + interval '60 days')
)
RETURNS TABLE (
  id             uuid,
  lead_id        uuid,
  fecha_inicio   timestamptz,
  fecha_fin      timestamptz,
  estado         text,
  origen         text,
  meet_link      text,
  confirmada_at  timestamptz,
  recordatorios  int,
  lead_nombre    text,
  lead_telefono  text,
  lead_email     text,
  lead_pais      text,
  lead_etapa     text,
  lead_origen    text,
  captado_ia     boolean,
  vendedor_id    uuid,
  vendedor       text,
  setter         text,
  es_mio         boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id, a.lead_id, a.fecha_inicio, a.fecha_fin, a.estado, a.origen, a.meet_link,
    a.confirmada_at,
    (SELECT count(*)::int FROM public.recordatorios_envios r WHERE r.agendamiento_id = a.id),
    l.nombre,
    CASE WHEN l.telefono LIKE 'sin-tel-%' THEN NULL ELSE l.telefono END,
    l.email, l.pais, l.etapa_venta, l.origen,
    (l.escalado_ia_at IS NOT NULL),
    l.vendedor_id,
    (SELECT nombre_display FROM public.vendedores WHERE user_id = l.vendedor_id),
    (SELECT nombre_display FROM public.vendedores WHERE user_id = l.setter_id),
    (l.vendedor_id = auth.uid())
  FROM public.agendamientos a
  JOIN public.leads_campana l ON l.id = a.lead_id
  WHERE a.fecha_inicio >= _desde
    AND a.fecha_inicio <  _hasta
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_role(auth.uid(), 'vendedor')
        AND public.vendedor_activo(auth.uid())
        AND (l.vendedor_id = auth.uid() OR l.setter_id = auth.uid())
      )
    )
  ORDER BY a.fecha_inicio;
$$;

REVOKE EXECUTE ON FUNCTION public.calendario_agendamientos(timestamptz, timestamptz) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calendario_agendamientos(timestamptz, timestamptz) TO authenticated;

-- =====================================================================
-- Agendamientos + sistema de notificaciones.
--
-- Dos huecos que quedaron abiertos:
--
-- 1) Cuando el bot agenda una reunion, el CRM se enteraba de que "hubo un
--    movimiento de reunion" pero NO de cuando es. La hora vivia solo en
--    Google Calendar, y n8n no puede prestarle esa credencial a Supabase.
--    Asi que la fecha llega por el mismo camino que ya funciona: el agente
--    la declara en su JSON y el nodo HTTP la manda.
--
-- 2) Nadie se entera de nada. El setter entrega un lead y no sabe si se
--    cerro; el closer recibe un agendamiento y no lo sabe hasta que mira
--    el Pipeline.
-- =====================================================================

-- ---------------------------------------------------------------------
-- agendamientos: una fila por reunion, con su historial de estados.
--
-- Tabla propia y no columnas en leads_campana porque un lead puede
-- agendar, reagendar y cancelar varias veces, y el calendario necesita
-- ver cada una en su fecha.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.leads_campana(id) ON DELETE CASCADE,
  fecha_inicio  timestamptz NOT NULL,
  fecha_fin     timestamptz,
  estado        text NOT NULL DEFAULT 'agendada'
                CHECK (estado IN ('agendada', 'modificada', 'cancelada')),
  origen        text,
  meet_link     text,
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agendamientos IS
  'Reuniones agendadas por los bots de WhatsApp. La hora la declara el agente en su JSON; el CRM no lee Google Calendar.';

CREATE INDEX IF NOT EXISTS agendamientos_lead_idx  ON public.agendamientos (lead_id);
CREATE INDEX IF NOT EXISTS agendamientos_fecha_idx ON public.agendamientos (fecha_inicio);

-- Un lead no puede tener dos reuniones vivas a la misma hora: reagendar
-- actualiza la fila, no crea otra.
CREATE UNIQUE INDEX IF NOT EXISTS agendamientos_lead_fecha_uq
  ON public.agendamientos (lead_id, fecha_inicio);

ALTER TABLE public.agendamientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen agendamientos" ON public.agendamientos;
CREATE POLICY "Admins leen agendamientos"
  ON public.agendamientos FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- El vendedor ve las reuniones de los leads que son suyos, y tambien las
-- de los que califico y entrego: es justo lo que pidio Mario, que el
-- setter siga el proceso del lead en las etapas siguientes.
DROP POLICY IF EXISTS "Vendedores leen agendamientos de sus leads" ON public.agendamientos;
CREATE POLICY "Vendedores leen agendamientos de sus leads"
  ON public.agendamientos FOR SELECT
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.leads_campana l
      WHERE l.id = agendamientos.lead_id
        AND (l.vendedor_id = auth.uid() OR l.setter_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo       text NOT NULL,
  titulo     text NOT NULL,
  cuerpo     text,
  lead_id    uuid REFERENCES public.leads_campana(id) ON DELETE CASCADE,
  url        text,
  leida_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.notificaciones.tipo IS
  'negocio_cerrado | agendamiento_nuevo | agendamiento_cambio | lead_traspasado | lead_captado_ia';

CREATE INDEX IF NOT EXISTS notificaciones_pendientes_idx
  ON public.notificaciones (user_id, created_at DESC)
  WHERE leida_at IS NULL;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Cada quien ve las suyas y solo puede marcarlas como leidas. Insertar es
-- exclusivo de las funciones SECURITY DEFINER: nadie se fabrica avisos.
DROP POLICY IF EXISTS "Cada uno lee sus notificaciones" ON public.notificaciones;
CREATE POLICY "Cada uno lee sus notificaciones"
  ON public.notificaciones FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cada uno marca sus notificaciones" ON public.notificaciones;
CREATE POLICY "Cada uno marca sus notificaciones"
  ON public.notificaciones FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- notificar(): el unico lugar que escribe en la tabla.
--
-- No se dispara por trigger sobre leads_campana a proposito: esa tabla
-- recibe updates masivos (admin_asignar_leads mueve cientos de filas de
-- una vez) y un trigger por fila generaria miles de avisos basura. Las
-- llamadas van explicitas dentro de las RPC que representan un hecho real.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar(
  _user_id uuid,
  _tipo    text,
  _titulo  text,
  _cuerpo  text DEFAULT NULL,
  _lead_id uuid DEFAULT NULL,
  _url     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notificaciones (user_id, tipo, titulo, cuerpo, lead_id, url)
  VALUES (_user_id, _tipo, _titulo, _cuerpo, _lead_id, _url)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar(uuid, text, text, text, uuid, text) FROM anon, authenticated, PUBLIC;

-- Avisar a todos los admins de una vez (para lo que no tiene dueno todavia).
CREATE OR REPLACE FUNCTION public.notificar_admins(
  _tipo text, _titulo text, _cuerpo text DEFAULT NULL, _lead_id uuid DEFAULT NULL, _url text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n int := 0; _uid uuid;
BEGIN
  FOR _uid IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.notificar(_uid, _tipo, _titulo, _cuerpo, _lead_id, _url);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar_admins(text, text, text, uuid, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- registrar_agendamiento(): lo llama la edge function cuando el bot
-- agenda, reagenda o cancela. Guarda la reunion y avisa a quien
-- corresponda.
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
    -- Si lo califico un setter, tambien quiere saber en que quedo.
    IF _lead.setter_id IS NOT NULL AND _lead.setter_id <> _lead.vendedor_id THEN
      PERFORM public.notificar(_lead.setter_id, 'agendamiento_cambio', _titulo,
        'Un lead que entregaste: ' || _cuando, _lead_id, '/mis-leads/pipeline');
    END IF;
  ELSE
    -- Sin dueno todavia: lo tiene que ver el admin para repartirlo.
    PERFORM public.notificar_admins('agendamiento_nuevo', _titulo,
      _cuando || ' · lead sin asignar, repártelo desde "Asignar leads"', _lead_id, '/admin/vendedores');
  END IF;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_agendamiento(uuid, timestamptz, text, timestamptz, text, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- calendario_agendamientos(): la misma vista para todos, recortada por
-- quien pregunta. El admin ve todo; el vendedor, los leads que son suyos
-- o que el califico.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Lectura y marcado de notificaciones
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificaciones_listar(_limite int DEFAULT 30)
RETURNS TABLE (
  id uuid, tipo text, titulo text, cuerpo text, lead_id uuid, url text,
  leida_at timestamptz, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.tipo, n.titulo, n.cuerpo, n.lead_id, n.url, n.leida_at, n.created_at
  FROM public.notificaciones n
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT LEAST(COALESCE(_limite, 30), 100);
$$;

CREATE OR REPLACE FUNCTION public.notificaciones_sin_leer()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.notificaciones
  WHERE user_id = auth.uid() AND leida_at IS NULL;
$$;

-- _ids NULL = marcar todas.
CREATE OR REPLACE FUNCTION public.notificaciones_marcar_leidas(_ids uuid[] DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n bigint;
BEGIN
  WITH t AS (
    UPDATE public.notificaciones
    SET leida_at = now()
    WHERE user_id = auth.uid()
      AND leida_at IS NULL
      AND (_ids IS NULL OR id = ANY(_ids))
    RETURNING id
  )
  SELECT count(*) INTO _n FROM t;
  RETURN _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificaciones_listar(int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notificaciones_listar(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notificaciones_sin_leer() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notificaciones_sin_leer() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notificaciones_marcar_leidas(uuid[]) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notificaciones_marcar_leidas(uuid[]) TO authenticated;

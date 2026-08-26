-- =====================================================================
-- Medidor de consumo por cuenta.
--
-- Es lo que faltaba para poder COBRAR el plan Motor de Ventas: sin
-- contadores no se factura un excedente ni se hace respetar un tope.
--
-- DECISION DE DISENO: el medidor NO lleva su propio registro de eventos.
-- Lee los que ya existen y son la verdad del sistema:
--
--   conversaciones -> calentamiento_envios (fase 0 = plantilla de apertura)
--                     + recordatorios_envios (modo = 'plantilla')
--   busquedas      -> prospeccion_busquedas
--   correos        -> correo_envios (estado = 'enviado')
--   vendedores     -> vendedores activos
--
-- Un contador aparte se desincroniza el dia que alguien inserta sin
-- pasar por la RPC, y ademas no sabria nada del pasado. Asi el medidor
-- funciona retroactivamente desde el primer dia.
--
-- QUE SE COBRA Y QUE NO: solo las conversaciones que ABRIMOS nosotros,
-- que son las que Meta cobra. El texto libre dentro de la ventana de 24 h
-- no le cuesta a nadie, asi que los toques 1-3 del calentamiento y el
-- recordatorio que sale en modo 'libre' no suman al contador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cuentas. Hoy hay una sola (la operacion de LexHouse), pero el plan se
-- vende a terceros, asi que el medidor nace multi-cuenta en vez de
-- tener que reescribirlo con el primer cliente.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuentas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  plan       text NOT NULL DEFAULT 'motor_ventas',
  -- Dia del mes en que arranca el ciclo de facturacion. Tope 28 para que
  -- exista en todos los meses.
  ciclo_dia  smallint NOT NULL DEFAULT 1 CHECK (ciclo_dia BETWEEN 1 AND 28),
  activa     boolean NOT NULL DEFAULT true,
  por_defecto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Una sola cuenta puede ser la de reserva: es a la que caen los consumos
-- de usuarios que nadie asigno todavia.
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_por_defecto_uq
  ON public.cuentas (por_defecto) WHERE por_defecto;

INSERT INTO public.cuentas (nombre, plan, por_defecto)
SELECT 'LexHouse (operación propia)', 'motor_ventas', true
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas);

ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan cuentas" ON public.cuentas;
CREATE POLICY "Admins gestionan cuentas"
  ON public.cuentas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- Que usuario pertenece a que cuenta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuenta_usuarios (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_id  uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cuenta_usuarios_cuenta_idx
  ON public.cuenta_usuarios (cuenta_id);

ALTER TABLE public.cuenta_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan la membresía de cuentas" ON public.cuenta_usuarios;
CREATE POLICY "Admins gestionan la membresía de cuentas"
  ON public.cuenta_usuarios FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Cada uno ve su cuenta" ON public.cuenta_usuarios;
CREATE POLICY "Cada uno ve su cuenta"
  ON public.cuenta_usuarios FOR SELECT
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Limites y precios por plan.
--
-- `excedente_*` en NULL significa "este plan NO se puede ampliar": al
-- llegar al incluido se corta. Con precio, el recurso se sigue sirviendo
-- y se factura.
--
-- `correos_tope` es distinto del incluido y distinto del excedente: es un
-- techo DURO. Todos los clientes salen por el mismo dominio verificado,
-- asi que el volumen de uno se paga con la entregabilidad de todos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_limites (
  plan                    text PRIMARY KEY,
  nombre                  text NOT NULL,
  precio_mes_usd          numeric(10,2) NOT NULL DEFAULT 0,
  activacion_usd          numeric(10,2) NOT NULL DEFAULT 0,

  conversaciones_incluidas int NOT NULL DEFAULT 0,
  busquedas_incluidas      int NOT NULL DEFAULT 0,
  correos_incluidos        int NOT NULL DEFAULT 0,
  vendedores_incluidos     int NOT NULL DEFAULT 1,

  -- Techo duro. NULL = sin techo.
  correos_tope             int,

  excedente_conversacion_usd numeric(10,4),
  excedente_busqueda_usd     numeric(10,4),
  excedente_mil_correos_usd  numeric(10,4),
  excedente_vendedor_usd     numeric(10,4),

  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.plan_limites.correos_tope IS
  'Techo duro de correos por período. Se hace respetar aunque el cliente quiera pagar más: el dominio de envío es compartido.';

INSERT INTO public.plan_limites (
  plan, nombre, precio_mes_usd, activacion_usd,
  conversaciones_incluidas, busquedas_incluidas, correos_incluidos, vendedores_incluidos,
  correos_tope,
  excedente_conversacion_usd, excedente_busqueda_usd, excedente_mil_correos_usd, excedente_vendedor_usd
) VALUES
  ('gratis', 'Nexus Gratis', 0, 0,
   0, 5, 100, 1,
   100,
   NULL, NULL, NULL, NULL),
  ('motor_ventas', 'Motor de Ventas', 149, 299,
   1000, 100, 2500, 5,
   5000,
   0.09, 0.50, 5.00, 15.00)
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE public.plan_limites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan los planes" ON public.plan_limites;
CREATE POLICY "Admins gestionan los planes"
  ON public.plan_limites FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Cualquiera autenticado lee los planes" ON public.plan_limites;
CREATE POLICY "Cualquiera autenticado lee los planes"
  ON public.plan_limites FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- A que cuenta pertenece un usuario. Si nadie lo asigno, cae en la
-- cuenta por defecto: asi el medidor nunca pierde un consumo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cuenta_de_usuario(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT cu.cuenta_id FROM public.cuenta_usuarios cu WHERE cu.user_id = _user),
    (SELECT c.id FROM public.cuentas c WHERE c.por_defecto LIMIT 1)
  );
$$;

-- ---------------------------------------------------------------------
-- El período de facturación vigente de una cuenta.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.periodo_facturacion(_cuenta uuid)
RETURNS TABLE (inicio timestamptz, fin timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dia smallint;
  _ini timestamptz;
BEGIN
  SELECT ciclo_dia INTO _dia FROM public.cuentas WHERE id = _cuenta;
  IF _dia IS NULL THEN _dia := 1; END IF;

  _ini := date_trunc('month', now()) + ((_dia - 1) || ' days')::interval;
  IF now() < _ini THEN
    _ini := _ini - interval '1 month';
  END IF;

  RETURN QUERY SELECT _ini, _ini + interval '1 month';
END;
$$;

-- ---------------------------------------------------------------------
-- consumo_periodo(): el medidor.
--
-- Una fila por recurso, con lo usado, lo incluido, el techo y lo que se
-- facturaria de excedente. Todo derivado de los registros que ya existen.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumo_periodo(
  _cuenta uuid DEFAULT NULL,
  _desde  timestamptz DEFAULT NULL,
  _hasta  timestamptz DEFAULT NULL
)
RETURNS TABLE (
  recurso            text,
  etiqueta           text,
  usado              bigint,
  incluido           int,
  tope               int,
  excedente          bigint,
  excedente_usd      numeric,
  ampliable          boolean,
  periodo_inicio     timestamptz,
  periodo_fin        timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c    uuid := COALESCE(_cuenta, public.cuenta_de_usuario(auth.uid()));
  _ini  timestamptz;
  _fin  timestamptz;
  _p    public.plan_limites%ROWTYPE;
  _conv bigint;
  _busq bigint;
  _mail bigint;
  _vend bigint;
BEGIN
  SELECT pf.inicio, pf.fin INTO _ini, _fin FROM public.periodo_facturacion(_c) pf;
  _ini := COALESCE(_desde, _ini);
  _fin := COALESCE(_hasta, _fin);

  SELECT pl.* INTO _p
  FROM public.plan_limites pl
  JOIN public.cuentas c ON c.plan = pl.plan
  WHERE c.id = _c;

  IF NOT FOUND THEN RETURN; END IF;

  -- Conversaciones que ABRIMOS nosotros: solo las que salen como
  -- plantilla. El texto libre dentro de la ventana no lo cobra Meta.
  SELECT
    (SELECT count(*) FROM public.calentamiento_envios e
      JOIN public.leads_campana l ON l.id = e.lead_id
      WHERE e.fase = 0
        AND e.enviado_at >= _ini AND e.enviado_at < _fin
        AND public.cuenta_de_usuario(l.vendedor_id) = _c)
    +
    (SELECT count(*) FROM public.recordatorios_envios r
      JOIN public.leads_campana l ON l.id = r.lead_id
      WHERE r.modo = 'plantilla'
        AND r.enviado_at >= _ini AND r.enviado_at < _fin
        AND public.cuenta_de_usuario(l.vendedor_id) = _c)
  INTO _conv;

  SELECT count(*) INTO _busq
  FROM public.prospeccion_busquedas b
  WHERE b.created_at >= _ini AND b.created_at < _fin
    AND public.cuenta_de_usuario(b.creado_por) = _c;

  SELECT count(*) INTO _mail
  FROM public.correo_envios ce
  WHERE ce.estado = 'enviado'
    AND ce.enviado_at >= _ini AND ce.enviado_at < _fin
    AND public.cuenta_de_usuario(ce.enviado_por) = _c;

  SELECT count(*) INTO _vend
  FROM public.vendedores v
  WHERE COALESCE(v.activo, false)
    AND public.cuenta_de_usuario(v.user_id) = _c;

  RETURN QUERY
  SELECT * FROM (VALUES
    ('conversaciones', 'Conversaciones de WhatsApp que abrimos',
     _conv, _p.conversaciones_incluidas, NULL::int,
     GREATEST(0, _conv - _p.conversaciones_incluidas),
     ROUND(GREATEST(0, _conv - _p.conversaciones_incluidas) * COALESCE(_p.excedente_conversacion_usd, 0), 2),
     _p.excedente_conversacion_usd IS NOT NULL),

    ('busquedas', 'Búsquedas de prospección',
     _busq, _p.busquedas_incluidas, NULL::int,
     GREATEST(0, _busq - _p.busquedas_incluidas),
     ROUND(GREATEST(0, _busq - _p.busquedas_incluidas) * COALESCE(_p.excedente_busqueda_usd, 0), 2),
     _p.excedente_busqueda_usd IS NOT NULL),

    ('correos', 'Correos enviados',
     _mail, _p.correos_incluidos, _p.correos_tope,
     GREATEST(0, _mail - _p.correos_incluidos),
     ROUND(GREATEST(0, _mail - _p.correos_incluidos)::numeric / 1000.0 * COALESCE(_p.excedente_mil_correos_usd, 0), 2),
     _p.excedente_mil_correos_usd IS NOT NULL),

    ('vendedores', 'Vendedores activos',
     _vend, _p.vendedores_incluidos, NULL::int,
     GREATEST(0, _vend - _p.vendedores_incluidos),
     ROUND(GREATEST(0, _vend - _p.vendedores_incluidos) * COALESCE(_p.excedente_vendedor_usd, 0), 2),
     _p.excedente_vendedor_usd IS NOT NULL)
  ) AS t(recurso, etiqueta, usado, incluido, tope, excedente, excedente_usd, ampliable),
  LATERAL (SELECT _ini, _fin) AS p(periodo_inicio, periodo_fin);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumo_periodo(uuid, timestamptz, timestamptz) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.consumo_periodo(uuid, timestamptz, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------
-- consumo_correos_disponibles(): el guardia del techo duro.
--
-- Lo llama la edge function ANTES de enviar. Devuelve cuantos correos
-- puede mandar todavia, para que el envio se recorte en vez de fallar
-- entero a mitad de camino.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consumo_correos_disponibles(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c        uuid := public.cuenta_de_usuario(_user);
  _ini      timestamptz;
  _fin      timestamptz;
  _tope     int;
  _incl     int;
  _amp      boolean;
  _usados   bigint;
BEGIN
  SELECT pf.inicio, pf.fin INTO _ini, _fin FROM public.periodo_facturacion(_c) pf;

  SELECT pl.correos_tope, pl.correos_incluidos, pl.excedente_mil_correos_usd IS NOT NULL
    INTO _tope, _incl, _amp
  FROM public.plan_limites pl
  JOIN public.cuentas c ON c.plan = pl.plan
  WHERE c.id = _c;

  IF NOT FOUND THEN
    -- Sin plan configurado no se bloquea a nadie: se avisa y se sigue.
    RETURN jsonb_build_object('ok', true, 'sin_plan', true);
  END IF;

  SELECT count(*) INTO _usados
  FROM public.correo_envios ce
  WHERE ce.estado = 'enviado'
    AND ce.enviado_at >= _ini AND ce.enviado_at < _fin
    AND public.cuenta_de_usuario(ce.enviado_por) = _c;

  -- El limite efectivo es el techo duro; si el plan no se puede ampliar,
  -- el limite es lo incluido.
  _tope := COALESCE(_tope, CASE WHEN _amp THEN NULL ELSE _incl END);

  IF _tope IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'usados', _usados, 'sin_tope', true,
                              'periodo_fin', _fin);
  END IF;

  RETURN jsonb_build_object(
    'ok',         _usados < _tope,
    'usados',     _usados,
    'incluidos',  _incl,
    'tope',       _tope,
    'restantes',  GREATEST(0, _tope - _usados)::int,
    'ampliable',  _amp,
    'periodo_fin', _fin
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumo_correos_disponibles(uuid) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- Resumen para el panel del admin: consumo + lo que se facturaria.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_consumo_resumen(_cuenta uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c     uuid;
  _p     public.plan_limites%ROWTYPE;
  _rows  jsonb;
  _exc   numeric;
  _ini   timestamptz;
  _fin   timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'solo admin');
  END IF;

  _c := COALESCE(_cuenta, (SELECT id FROM public.cuentas WHERE por_defecto LIMIT 1));

  SELECT pl.* INTO _p
  FROM public.plan_limites pl
  JOIN public.cuentas c ON c.plan = pl.plan
  WHERE c.id = _c;

  SELECT jsonb_agg(to_jsonb(t)), sum(t.excedente_usd), min(t.periodo_inicio), min(t.periodo_fin)
    INTO _rows, _exc, _ini, _fin
  FROM public.consumo_periodo(_c) t;

  RETURN jsonb_build_object(
    'cuenta',        (SELECT nombre FROM public.cuentas WHERE id = _c),
    'cuenta_id',     _c,
    'plan',          _p.nombre,
    'precio_mes_usd', _p.precio_mes_usd,
    'periodo_inicio', _ini,
    'periodo_fin',    _fin,
    'recursos',       COALESCE(_rows, '[]'::jsonb),
    'excedente_usd',  COALESCE(_exc, 0),
    'total_usd',      COALESCE(_p.precio_mes_usd, 0) + COALESCE(_exc, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_consumo_resumen(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_consumo_resumen(uuid) TO authenticated;

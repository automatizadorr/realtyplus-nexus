-- =====================================================================
-- Flujo unificado del vendedor (2026-09-06)
-- ---------------------------------------------------------------------
-- Hasta ahora "Buscar Leads" (prospeccion_leads) y el Pipeline
-- (leads_campana) eran dos mundos separados: el vendedor encontraba un
-- prospecto, lo contactaba, y ese trabajo no aparecia nunca en su
-- Bandeja/Pipeline. Esta migracion los une y agrega lo que faltaba para
-- trabajar el lead de punta a punta:
--
--   1) Puente Buscar Leads -> Bandeja/Pipeline
--      prospeccion_leads.lead_campana_id + RPC vendedor_prospectos_a_pipeline
--   2) Alta manual de leads desde la Bandeja
--      RPC vendedor_registrar_lead_manual
--   3) Ficha completa del lead (datos + historial de etapas + contactos)
--      RPC vendedor_lead_detalle
--   4) Canales nuevos de contacto: llamada, Instagram, Facebook
--      contactos_log.canal amplia su CHECK
--   5) Remitente de correo elegible por el vendedor (las 2 cuentas Resend
--      o un correo particular): columnas en `vendedores` + RPC
--      vendedor_set_remitente
--
-- Idempotente: se puede correr varias veces.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Helper: telefono normalizado a los ultimos 9 digitos (mismo criterio
--    que el dedupe anti-spam ya existente).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tel_norm(_tel text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(_tel, ''), '[^0-9]', '', 'g')) >= 9
      THEN right(regexp_replace(coalesce(_tel, ''), '[^0-9]', '', 'g'), 9)
    ELSE regexp_replace(coalesce(_tel, ''), '[^0-9]', '', 'g')
  END;
$fn$;

COMMENT ON FUNCTION public.tel_norm(text) IS
  'Ultimos 9 digitos de un telefono (ignora prefijo de pais y formato). Se usa para deduplicar leads entre prospeccion y campana.';

-- ---------------------------------------------------------------------
-- 1) Columnas nuevas
-- ---------------------------------------------------------------------
-- El prospecto sabe a que lead del pipeline dio origen (y viceversa).
ALTER TABLE public.prospeccion_leads
  ADD COLUMN IF NOT EXISTS lead_campana_id   uuid REFERENCES public.leads_campana(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS facebook          text,
  ADD COLUMN IF NOT EXISTS mensaje_instagram text;

CREATE INDEX IF NOT EXISTS idx_prosp_leads_lead_campana ON public.prospeccion_leads (lead_campana_id);

COMMENT ON COLUMN public.prospeccion_leads.lead_campana_id IS
  'Lead del Pipeline (leads_campana) que se creo a partir de este prospecto. NULL = todavia no paso al Pipeline.';
COMMENT ON COLUMN public.prospeccion_leads.mensaje_instagram IS
  'Mensaje de primer contacto para Instagram/Facebook redactado por la IA de Buscar Leads.';

-- El lead del Pipeline arrastra los datos de redes y el mensaje de IG que
-- venian de Buscar Leads, para no tener que volver a la prospeccion.
ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS instagram          text,
  ADD COLUMN IF NOT EXISTS facebook           text,
  ADD COLUMN IF NOT EXISTS mensaje_instagram  text,
  ADD COLUMN IF NOT EXISTS notas_vendedor     text,
  ADD COLUMN IF NOT EXISTS prospecto_id       uuid REFERENCES public.prospeccion_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_campana_prospecto ON public.leads_campana (prospecto_id);

COMMENT ON COLUMN public.leads_campana.prospecto_id IS
  'Prospecto de Buscar Leads (prospeccion_leads) del que salio este lead. NULL = vino de campana, del bot o de alta manual.';
COMMENT ON COLUMN public.leads_campana.notas_vendedor IS
  'Notas libres del vendedor sobre el lead (no las toca el bot).';

-- ---------------------------------------------------------------------
-- 2) contactos_log: canales nuevos (llamada telefonica y redes)
-- ---------------------------------------------------------------------
ALTER TABLE public.contactos_log DROP CONSTRAINT IF EXISTS contactos_log_canal_check;
ALTER TABLE public.contactos_log
  ADD CONSTRAINT contactos_log_canal_check
  CHECK (canal IN ('whatsapp','email','llamada','instagram','facebook'));

ALTER TABLE public.contactos_log ADD COLUMN IF NOT EXISTS resultado text;

COMMENT ON COLUMN public.contactos_log.resultado IS
  'Solo para canal = llamada: contesto / no contesto / agendo / no interesado, etc.';

-- ---------------------------------------------------------------------
-- 3) Remitente de correo elegible por el vendedor
--    modo:
--      auto        -> alterna las 2 cuentas Resend (200/dia en total)
--      resend1     -> solo send.lexhouse-ai.com  (100/dia)
--      resend2     -> solo lexhouse-ai.online    (100/dia)
--      particular  -> no usa Resend: abre el cliente de correo del vendedor
-- ---------------------------------------------------------------------
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS remitente_modo       text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS remitente_from_name  text,
  ADD COLUMN IF NOT EXISTS remitente_local      text,
  ADD COLUMN IF NOT EXISTS remitente_particular text,
  ADD COLUMN IF NOT EXISTS remitente_reply_to   text;

DO $blk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendedores_remitente_modo_check') THEN
    ALTER TABLE public.vendedores
      ADD CONSTRAINT vendedores_remitente_modo_check
      CHECK (remitente_modo IN ('auto','resend1','resend2','particular'));
  END IF;
END;
$blk$;

COMMENT ON COLUMN public.vendedores.remitente_local IS
  'Parte antes de la arroba del remitente (ej. "mario"). El dominio lo pone el servidor segun la cuenta Resend usada.';
COMMENT ON COLUMN public.vendedores.remitente_particular IS
  'Correo propio del vendedor. Con remitente_modo = particular los envios se abren en su cliente de correo y no gastan cupo de Resend.';

CREATE OR REPLACE FUNCTION public.vendedor_set_remitente(
  _modo       text,
  _from_name  text DEFAULT NULL,
  _local      text DEFAULT NULL,
  _particular text DEFAULT NULL,
  _reply_to   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _modo NOT IN ('auto','resend1','resend2','particular') THEN
    RAISE EXCEPTION 'Modo de remitente invalido: %', _modo;
  END IF;

  IF _modo = 'particular' AND coalesce(btrim(_particular), '') = '' THEN
    RAISE EXCEPTION 'Falta el correo particular';
  END IF;

  UPDATE public.vendedores
  SET remitente_modo       = _modo,
      remitente_from_name  = nullif(btrim(coalesce(_from_name, '')), ''),
      -- Solo la parte local: si escriben el correo entero, se recorta en la arroba.
      remitente_local      = nullif(lower(split_part(btrim(coalesce(_local, '')), '@', 1)), ''),
      remitente_particular = nullif(lower(btrim(coalesce(_particular, ''))), ''),
      remitente_reply_to   = nullif(lower(btrim(coalesce(_reply_to, ''))), '')
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes perfil de vendedor';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_set_remitente(text, text, text, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_set_remitente(text, text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Alta manual de un lead desde la Bandeja
--    Entra como cualquier lead asignado: etapa "nuevo" y primer_contacto_at
--    NULL, o sea, a la Bandeja (no directo al Pipeline).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_registrar_lead_manual(
  _nombre    text,
  _telefono  text DEFAULT NULL,
  _email     text DEFAULT NULL,
  _pais      text DEFAULT NULL,
  _instagram text DEFAULT NULL,
  _facebook  text DEFAULT NULL,
  _notas     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid       uuid := auth.uid();
  _tel       text := nullif(btrim(coalesce(_telefono, '')), '');
  _existente uuid;
  _nuevo_id  uuid;
BEGIN
  IF NOT public.has_role(_uid, 'vendedor') OR NOT public.vendedor_activo(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF coalesce(btrim(_nombre), '') = '' THEN
    RAISE EXCEPTION 'Falta el nombre del lead';
  END IF;

  IF _tel IS NULL AND coalesce(btrim(_email), '') = ''
     AND coalesce(btrim(_instagram), '') = '' AND coalesce(btrim(_facebook), '') = '' THEN
    RAISE EXCEPTION 'Indica al menos un dato de contacto (telefono, email, Instagram o Facebook)';
  END IF;

  -- Anti-duplicado: si ese numero ya existe en la base, no se crea otra fila
  -- (leads_campana tiene UNIQUE(telefono) y el dedupe compara 9 digitos).
  IF _tel IS NOT NULL AND public.tel_norm(_tel) <> '' THEN
    SELECT id INTO _existente
    FROM public.leads_campana
    WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
    ORDER BY (archivado IS TRUE)::int, created_at
    LIMIT 1;

    IF _existente IS NOT NULL THEN
      -- Si es del propio vendedor (o no tiene dueno), se recupera a su Bandeja.
      UPDATE public.leads_campana
      SET vendedor_id      = _uid,
          fecha_asignacion = coalesce(fecha_asignacion, now()),
          archivado        = false,
          email            = coalesce(nullif(btrim(coalesce(_email, '')), ''), email),
          pais             = coalesce(nullif(btrim(coalesce(_pais, '')), ''), pais),
          instagram        = coalesce(nullif(btrim(coalesce(_instagram, '')), ''), instagram),
          facebook         = coalesce(nullif(btrim(coalesce(_facebook, '')), ''), facebook),
          notas_vendedor   = coalesce(nullif(btrim(coalesce(_notas, '')), ''), notas_vendedor)
      WHERE id = _existente
        AND (vendedor_id IS NULL OR vendedor_id = _uid);

      IF FOUND THEN
        RETURN _existente;
      END IF;
      RAISE EXCEPTION 'Ese telefono ya esta cargado y asignado a otro vendedor';
    END IF;
  END IF;

  INSERT INTO public.leads_campana (
    nombre, telefono, email, pais, instagram, facebook, notas_vendedor,
    origen, vendedor_id, etapa_venta, fecha_asignacion, primer_contacto_at, archivado
  ) VALUES (
    btrim(_nombre),
    -- leads_campana.telefono es NOT NULL y UNIQUE: un lead sin telefono
    -- (solo email o redes) recibe un marcador unico e inmarcable, que la UI
    -- trata como "sin WhatsApp".
    coalesce(_tel, 'sin-tel-' || replace(gen_random_uuid()::text, '-', '')),
    nullif(lower(btrim(coalesce(_email, ''))), ''),
    nullif(btrim(coalesce(_pais, '')), ''),
    nullif(btrim(coalesce(_instagram, '')), ''),
    nullif(btrim(coalesce(_facebook, '')), ''),
    nullif(btrim(coalesce(_notas, '')), ''),
    'manual_vendedor', _uid, 'nuevo', now(), NULL, false
  )
  RETURNING id INTO _nuevo_id;

  RETURN _nuevo_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_registrar_lead_manual(text, text, text, text, text, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_registrar_lead_manual(text, text, text, text, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) Puente Buscar Leads -> Bandeja / Pipeline
--    _ya_contactados = true  -> entra al Pipeline en etapa "contactado"
--    _ya_contactados = false -> entra a la Bandeja (etapa "nuevo")
--
--    Reglas:
--      * solo prospectos del propio vendedor;
--      * si el prospecto ya tenia lead, se reutiliza (no se duplica);
--      * si el telefono ya existe en leads_campana y es del vendedor o no
--        tiene dueno, se vincula a esa fila en vez de crear otra;
--      * si el telefono pertenece a otro vendedor, se omite (no se roba).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_prospectos_a_pipeline(
  _prospecto_ids  uuid[],
  _ya_contactados boolean DEFAULT true
)
RETURNS TABLE (creados bigint, vinculados bigint, omitidos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid        uuid := auth.uid();
  _p          record;
  _lead_id    uuid;
  _tel        text;
  _creados    bigint := 0;
  _vinculados bigint := 0;
  _omitidos   bigint := 0;
  _etapa      text := CASE WHEN _ya_contactados THEN 'contactado' ELSE 'nuevo' END;
  _primer     timestamptz := CASE WHEN _ya_contactados THEN now() ELSE NULL END;
BEGIN
  IF NOT public.has_role(_uid, 'vendedor') OR NOT public.vendedor_activo(_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR _p IN
    SELECT * FROM public.prospeccion_leads
    WHERE id = ANY(_prospecto_ids) AND creado_por = _uid
  LOOP
    _lead_id := NULL;
    _tel := nullif(btrim(coalesce(nullif(btrim(coalesce(_p.whatsapp, '')), ''), _p.telefono, '')), '');

    -- a) Ya tiene lead del pipeline vinculado y sigue siendo suyo?
    IF _p.lead_campana_id IS NOT NULL THEN
      SELECT id INTO _lead_id FROM public.leads_campana
      WHERE id = _p.lead_campana_id AND (vendedor_id IS NULL OR vendedor_id = _uid);
    END IF;

    -- b) Ese telefono ya esta en la base?
    IF _lead_id IS NULL AND _tel IS NOT NULL AND public.tel_norm(_tel) <> '' THEN
      SELECT id INTO _lead_id FROM public.leads_campana
      WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
        AND (vendedor_id IS NULL OR vendedor_id = _uid)
      ORDER BY (archivado IS TRUE)::int, created_at
      LIMIT 1;

      -- Existe pero es de otro vendedor: no se toca.
      IF _lead_id IS NULL AND EXISTS (
        SELECT 1 FROM public.leads_campana
        WHERE public.tel_norm(telefono) = public.tel_norm(_tel)
      ) THEN
        _omitidos := _omitidos + 1;
        CONTINUE;
      END IF;
    END IF;

    IF _lead_id IS NOT NULL THEN
      UPDATE public.leads_campana
      SET vendedor_id        = _uid,
          fecha_asignacion   = coalesce(fecha_asignacion, now()),
          archivado          = false,
          email              = coalesce(nullif(btrim(coalesce(_p.email, '')), ''), email),
          pais               = coalesce(nullif(btrim(coalesce(_p.pais, '')), ''), pais),
          instagram          = coalesce(nullif(btrim(coalesce(_p.instagram, '')), ''), instagram),
          facebook           = coalesce(nullif(btrim(coalesce(_p.facebook, '')), ''), facebook),
          mensaje_instagram  = coalesce(nullif(btrim(coalesce(_p.mensaje_instagram, '')), ''), mensaje_instagram),
          resumen_ia         = coalesce(resumen_ia, nullif(btrim(coalesce(_p.propuesta_valor, '')), '')),
          prospecto_id       = _p.id,
          -- Nunca se retrocede una etapa ya avanzada por el vendedor.
          etapa_venta        = CASE WHEN etapa_venta = 'nuevo' THEN _etapa ELSE etapa_venta END,
          primer_contacto_at = coalesce(primer_contacto_at, _primer)
      WHERE id = _lead_id;
      _vinculados := _vinculados + 1;
    ELSE
      INSERT INTO public.leads_campana (
        nombre, telefono, email, pais, instagram, facebook, mensaje_instagram,
        resumen_ia, origen, vendedor_id, etapa_venta, fecha_asignacion,
        primer_contacto_at, prospecto_id, archivado
      ) VALUES (
        coalesce(nullif(btrim(_p.nombre), ''), 'Prospecto'),
        coalesce(_tel, 'sin-tel-' || replace(gen_random_uuid()::text, '-', '')),
        nullif(lower(btrim(coalesce(_p.email, ''))), ''),
        nullif(btrim(coalesce(_p.pais, _p.ciudad, '')), ''),
        nullif(btrim(coalesce(_p.instagram, '')), ''),
        nullif(btrim(coalesce(_p.facebook, '')), ''),
        nullif(btrim(coalesce(_p.mensaje_instagram, '')), ''),
        nullif(btrim(coalesce(_p.propuesta_valor, '')), ''),
        'buscar_leads', _uid, _etapa, now(), _primer, _p.id, false
      )
      RETURNING id INTO _lead_id;
      _creados := _creados + 1;
    END IF;

    UPDATE public.prospeccion_leads
    SET lead_campana_id = _lead_id,
        estado_gestion  = CASE
          WHEN _ya_contactados AND estado_gestion = 'nuevo' THEN 'contactado'
          ELSE estado_gestion
        END
    WHERE id = _p.id;
  END LOOP;

  RETURN QUERY SELECT _creados, _vinculados, _omitidos;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_prospectos_a_pipeline(uuid[], boolean) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_prospectos_a_pipeline(uuid[], boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- 6) Ficha completa del lead: datos + historial de etapas + contactos.
--    Un solo viaje a la BD para el dialogo de detalle de la tarjeta.
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

  SELECT * INTO _lead FROM public.leads_campana WHERE id = _lead_id AND vendedor_id = _uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  SELECT jsonb_build_object(
    'lead', to_jsonb(_lead) - 'tag_ids',
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
-- 7) Notas del vendedor sobre un lead del Pipeline (no hay UPDATE directo).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_set_notas_lead(_lead_id uuid, _notas text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.leads_campana
  SET notas_vendedor = nullif(btrim(coalesce(_notas, '')), '')
  WHERE id = _lead_id AND vendedor_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_set_notas_lead(uuid, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_set_notas_lead(uuid, text) TO authenticated;

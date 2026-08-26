-- =====================================================================
-- La fase del calentamiento se calcula, no se guarda.
--
-- La version anterior llevaba un contador (calentamiento_fase) que habia
-- que resetear a mano cuando el lead respondia, con un nodo extra dentro
-- del workflow del bot. Eso es fragil: si el reset falla o alguien lo
-- desconecta, el lead se queda pegado en la fase 3 para siempre y nunca
-- vuelve a recibir el primer toque.
--
-- Ahora la fase es "cuantos toques se enviaron DESPUES del ultimo mensaje
-- del lead". Si el lead escribe, ese conteo vuelve a cero solo, sin que
-- nadie tenga que avisar. Una cosa menos que puede romperse, y el bot
-- principal no se toca.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.calentamiento_envios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES public.leads_campana(id) ON DELETE CASCADE,
  fase       smallint NOT NULL,
  mensaje    text,
  enviado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calentamiento_envios_lead_idx
  ON public.calentamiento_envios (lead_id, enviado_at DESC);

ALTER TABLE public.calentamiento_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen envios de calentamiento" ON public.calentamiento_envios;
CREATE POLICY "Admins leen envios de calentamiento"
  ON public.calentamiento_envios FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedores leen envios de sus leads" ON public.calentamiento_envios;
CREATE POLICY "Vendedores leen envios de sus leads"
  ON public.calentamiento_envios FOR SELECT
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND EXISTS (SELECT 1 FROM public.leads_campana l
                WHERE l.id = calentamiento_envios.lead_id AND l.vendedor_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.leads_para_calentar(_limite int DEFAULT 50)
RETURNS TABLE (
  lead_id       uuid,
  telefono      text,
  nombre        text,
  fase          smallint,
  cuerpo        text,
  media_url     text,
  media_tipo    text,
  horas_callado numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Los mensajes viven en DOS tablas: mensajes_whatsapp es el canal
  -- historico y mensajes_automatizacion es donde escriben los bots
  -- actuales. Mirando solo una, el reloj ignora medio sistema.
  WITH mensajes AS (
    SELECT public.tel_norm(telefono) AS tel, direccion, created_at
    FROM public.mensajes_whatsapp
    UNION ALL
    SELECT public.tel_norm(telefono) AS tel, direccion, created_at
    FROM public.mensajes_automatizacion
  ),
  ultimo_del_lead AS (
    SELECT m.tel, max(m.created_at) AS cuando
    FROM mensajes m WHERE m.direccion = 'inbound' GROUP BY 1
  ),
  ultimo_nuestro AS (
    SELECT m.tel, max(m.created_at) AS cuando
    FROM mensajes m WHERE m.direccion <> 'inbound' GROUP BY 1
  ),
  candidatos AS (
    SELECT
      l.*,
      EXTRACT(EPOCH FROM (now() - ul.cuando)) / 3600.0 AS horas,
      EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(NULLIF(l.timezone, ''), 'America/Santiago'))) AS hora_local,
      -- La fase: toques enviados desde que el lead se callo. Vuelve a 0
      -- solo, en cuanto el lead escribe algo nuevo.
      (SELECT count(*) FROM public.calentamiento_envios e
        WHERE e.lead_id = l.id AND e.enviado_at > ul.cuando) AS toques,
      (SELECT max(e.enviado_at) FROM public.calentamiento_envios e
        WHERE e.lead_id = l.id) AS ultimo_toque
    FROM public.leads_campana l
    JOIN ultimo_del_lead ul ON ul.tel = public.tel_norm(l.telefono)
    LEFT JOIN ultimo_nuestro un ON un.tel = public.tel_norm(l.telefono)
    WHERE COALESCE(l.archivado, false) = false
      AND COALESCE(l.calentamiento_pausado, false) = false
      AND l.bot_activo IS DISTINCT FROM false
      AND l.etapa_venta IN ('contactado', 'interesado', 'demo')
      AND un.cuando IS NOT NULL
      AND un.cuando > ul.cuando
      AND NOT EXISTS (
        SELECT 1 FROM public.agendamientos a
        WHERE a.lead_id = l.id AND a.estado <> 'cancelada' AND a.fecha_inicio > now()
      )
  )
  SELECT
    c.id, c.telefono, c.nombre,
    (c.toques + 1)::smallint,
    replace(
      replace(p.cuerpo, '{{nombre}}', COALESCE(NULLIF(split_part(btrim(c.nombre), ' ', 1), ''), 'Hola')),
      '{{firma}}',
      COALESCE((SELECT nombre_display FROM public.vendedores WHERE user_id = c.vendedor_id), 'Sofía')
    ),
    p.media_url, p.media_tipo,
    round(c.horas::numeric, 1)
  FROM candidatos c
  JOIN public.calentamiento_piezas p ON p.fase = c.toques + 1 AND p.activa
  WHERE c.horas < 23
    AND (
      (c.toques = 0 AND c.horas >= 2) OR
      (c.toques = 1 AND c.horas >= 6) OR
      (c.toques = 2 AND c.horas >= 20)
    )
    AND (c.ultimo_toque IS NULL OR c.ultimo_toque < now() - interval '1 hour')
    AND c.hora_local BETWEEN 9 AND 20
  ORDER BY c.horas DESC
  LIMIT LEAST(COALESCE(_limite, 50), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.leads_para_calentar(int) FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.calentamiento_registrar(
  _lead_id uuid, _fase smallint, _mensaje text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  INSERT INTO public.calentamiento_envios (lead_id, fase, mensaje)
  VALUES (_lead_id, _fase, left(COALESCE(_mensaje, ''), 600));

  -- Las columnas del lead se mantienen al dia solo para mostrarlas; la
  -- logica ya no depende de ellas.
  UPDATE public.leads_campana
  SET calentamiento_fase      = _fase,
      calentamiento_ultimo_at = now(),
      ultimo_contacto_at      = now()
  WHERE id = _lead_id
  RETURNING vendedor_id INTO _uid;

  IF _uid IS NOT NULL THEN
    INSERT INTO public.contactos_log (lead_id, user_id, canal, mensaje_final, origen, resultado)
    VALUES (_lead_id, _uid, 'whatsapp', left(COALESCE(_mensaje, ''), 600), 'calentamiento',
            'calentamiento_fase_' || _fase);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calentamiento_registrar(uuid, smallint, text) FROM anon, authenticated, PUBLIC;

COMMENT ON FUNCTION public.calentamiento_reset(text) IS
  'Ya no hace falta para el flujo normal: la fase se calcula desde los envios posteriores al ultimo mensaje del lead. Se deja para poder cortar una secuencia a mano.';

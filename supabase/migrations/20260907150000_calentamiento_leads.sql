-- =====================================================================
-- Calentamiento de leads que se enfrian.
--
-- Cuando un lead deja de contestar, hoy no pasa nada: se queda en el
-- Pipeline hasta que alguien se acuerda. Esto le manda una escalera corta
-- de mensajes para recuperarlo.
--
-- LA RESTRICCION QUE MANDA EN TODO EL DISENO: WhatsApp Business solo deja
-- enviar mensajes libres -- texto, imagen, video -- dentro de las 24 h
-- desde el ULTIMO MENSAJE DEL LEAD. Fuera de esa ventana solo salen
-- plantillas HSM aprobadas por Meta, y con multimedia hay que aprobar
-- tambien el header. Por eso los tres toques son a las 2, 6 y 20 horas:
-- caben todos dentro de la ventana y no dependen de ninguna aprobacion.
--
-- El reloj corre desde el ultimo mensaje ENTRANTE, que es exactamente lo
-- que Meta mide. Usar ultimo_contacto_at seria incorrecto: esa columna se
-- mueve tambien cuando escribimos nosotros. Y hay que mirar DOS tablas:
-- mensajes_whatsapp (canal historico) y mensajes_automatizacion (donde
-- escriben los bots actuales). La direccion se marca 'inbound'/'outbound'.
-- =====================================================================

ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS calentamiento_fase     smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calentamiento_ultimo_at timestamptz,
  ADD COLUMN IF NOT EXISTS calentamiento_pausado  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads_campana.calentamiento_fase IS
  'Ultimo toque de calentamiento enviado (0 = ninguno). Vuelve a 0 apenas el lead responde.';
COMMENT ON COLUMN public.leads_campana.calentamiento_pausado IS
  'Excluye al lead de la secuencia sin archivarlo (pedido de no contactar, o el vendedor lo trabaja a mano).';

-- ---------------------------------------------------------------------
-- Biblioteca de piezas: que se manda en cada toque.
--
-- Tabla y no texto hardcodeado en el workflow porque el contenido se
-- ajusta seguido y no puede exigir tocar n8n cada vez.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calentamiento_piezas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase       smallint NOT NULL,
  nombre     text NOT NULL,
  cuerpo     text NOT NULL,
  media_url  text,
  media_tipo text CHECK (media_tipo IN ('image', 'video', 'document')),
  activa     boolean NOT NULL DEFAULT true,
  orden      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calentamiento_piezas IS
  'Mensajes de calentamiento. {{nombre}} y {{firma}} se reemplazan al enviar.';

CREATE INDEX IF NOT EXISTS calentamiento_piezas_fase_idx
  ON public.calentamiento_piezas (fase, orden) WHERE activa;

ALTER TABLE public.calentamiento_piezas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan piezas de calentamiento" ON public.calentamiento_piezas;
CREATE POLICY "Admins gestionan piezas de calentamiento"
  ON public.calentamiento_piezas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedores leen piezas de calentamiento" ON public.calentamiento_piezas;
CREATE POLICY "Vendedores leen piezas de calentamiento"
  ON public.calentamiento_piezas FOR SELECT
  USING (public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid()));

-- Contenido inicial. El de la fase 2 y 3 queda sin media_url hasta que
-- existan la infografia y el video; mientras tanto sale solo el texto.
INSERT INTO public.calentamiento_piezas (fase, nombre, cuerpo, media_tipo, orden)
SELECT * FROM (VALUES
  (1::smallint, 'Retomar el hilo',
   '{{nombre}}, ¿alcanzaste a ver lo que te comenté? Si te quedó alguna duda la resuelvo al toque, sin compromiso.',
   NULL::text, 0),
  (2::smallint, 'Infografía de valor',
   'Te lo dejo en una imagen, se entiende en 20 segundos 👇',
   'image', 0),
  (3::smallint, 'Cierre suave con video',
   '{{nombre}}, última de mi parte por hoy 🙌 Te dejo un video corto con cómo se ve funcionando. Si no es el momento, dímelo con confianza y no te escribo más.',
   'video', 0)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.calentamiento_piezas);

-- ---------------------------------------------------------------------
-- leads_para_calentar(): a quien le toca AHORA.
--
-- Devuelve el mensaje ya resuelto (nombre y firma reemplazados) para que
-- n8n solo tenga que enviarlo. Toda la regla de negocio vive aca y no
-- repartida en nodos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_para_calentar(_limite int DEFAULT 50)
RETURNS TABLE (
  lead_id     uuid,
  telefono    text,
  nombre      text,
  fase        smallint,
  cuerpo      text,
  media_url   text,
  media_tipo  text,
  horas_callado numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Los mensajes viven en DOS tablas: mensajes_whatsapp es el canal
  -- historico y mensajes_automatizacion es donde escriben los bots
  -- actuales (Sofia y Camil-AI). Hay que mirar las dos, si no el reloj
  -- ignora justo las conversaciones de hoy.
  WITH mensajes AS (
    SELECT public.tel_norm(telefono) AS tel, direccion, created_at
    FROM public.mensajes_whatsapp
    UNION ALL
    SELECT public.tel_norm(telefono) AS tel, direccion, created_at
    FROM public.mensajes_automatizacion
  ),
  ultimo_del_lead AS (
    -- El reloj de Meta: ultimo mensaje ENTRANTE por telefono normalizado.
    SELECT m.tel, max(m.created_at) AS cuando
    FROM mensajes m
    WHERE m.direccion = 'inbound'
    GROUP BY 1
  ),
  ultimo_nuestro AS (
    SELECT m.tel, max(m.created_at) AS cuando
    FROM mensajes m
    WHERE m.direccion <> 'inbound'
    GROUP BY 1
  ),
  candidatos AS (
    SELECT
      l.*,
      ul.cuando AS callado_desde,
      EXTRACT(EPOCH FROM (now() - ul.cuando)) / 3600.0 AS horas,
      -- Hora local del lead, para no escribir de madrugada.
      EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(NULLIF(l.timezone, ''), 'America/Santiago'))) AS hora_local
    FROM public.leads_campana l
    JOIN ultimo_del_lead ul ON ul.tel = public.tel_norm(l.telefono)
    LEFT JOIN ultimo_nuestro un ON un.tel = public.tel_norm(l.telefono)
    WHERE COALESCE(l.archivado, false) = false
      AND COALESCE(l.calentamiento_pausado, false) = false
      AND l.bot_activo IS DISTINCT FROM false
      AND l.etapa_venta IN ('contactado', 'interesado', 'demo')
      -- Ya le respondimos y el no volvio a escribir: eso es el silencio.
      AND un.cuando IS NOT NULL
      AND un.cuando > ul.cuando
      -- Ninguna reunion viva por delante: si tiene cita, no hay que calentarlo.
      AND NOT EXISTS (
        SELECT 1 FROM public.agendamientos a
        WHERE a.lead_id = l.id AND a.estado <> 'cancelada' AND a.fecha_inicio > now()
      )
  )
  SELECT
    c.id,
    c.telefono,
    c.nombre,
    (c.calentamiento_fase + 1)::smallint,
    replace(
      replace(p.cuerpo, '{{nombre}}', COALESCE(NULLIF(split_part(btrim(c.nombre), ' ', 1), ''), 'Hola')),
      '{{firma}}',
      COALESCE((SELECT nombre_display FROM public.vendedores WHERE user_id = c.vendedor_id), 'Sofía')
    ),
    p.media_url,
    p.media_tipo,
    round(c.horas::numeric, 1)
  FROM candidatos c
  JOIN public.calentamiento_piezas p
    ON p.fase = c.calentamiento_fase + 1 AND p.activa
  WHERE
    -- La escalera: 2 h, 6 h y 20 h desde que se callo. El tope de 23 h
    -- deja margen antes de que Meta cierre la ventana de 24 h.
    c.horas < 23
    AND (
      (c.calentamiento_fase = 0 AND c.horas >= 2)  OR
      (c.calentamiento_fase = 1 AND c.horas >= 6)  OR
      (c.calentamiento_fase = 2 AND c.horas >= 20)
    )
    -- Un toque por lead por hora como maximo, pase lo que pase.
    AND (c.calentamiento_ultimo_at IS NULL OR c.calentamiento_ultimo_at < now() - interval '1 hour')
    -- Horario local decente.
    AND c.hora_local BETWEEN 9 AND 20
  ORDER BY c.horas DESC
  LIMIT LEAST(COALESCE(_limite, 50), 200);
$$;

REVOKE EXECUTE ON FUNCTION public.leads_para_calentar(int) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- calentamiento_registrar(): lo llama n8n despues de enviar.
-- Deja rastro en contactos_log para que aparezca en el panel de KPIs
-- junto al resto de los contactos.
-- ---------------------------------------------------------------------
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
  UPDATE public.leads_campana
  SET calentamiento_fase      = _fase,
      calentamiento_ultimo_at = now(),
      ultimo_contacto_at      = now()
  WHERE id = _lead_id
  RETURNING vendedor_id INTO _uid;

  -- user_id es NOT NULL en contactos_log; sin vendedor el envio no se
  -- registra ahi, pero el estado del calentamiento igual queda guardado.
  IF _uid IS NOT NULL THEN
    INSERT INTO public.contactos_log (lead_id, user_id, canal, mensaje_final, origen, resultado)
    VALUES (_lead_id, _uid, 'whatsapp', left(COALESCE(_mensaje, ''), 600), 'calentamiento',
            'calentamiento_fase_' || _fase);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calentamiento_registrar(uuid, smallint, text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- calentamiento_reset(): el lead volvio a escribir, la secuencia muere.
-- La llama el workflow apenas entra un mensaje.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calentamiento_reset(_telefono text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n int;
BEGIN
  WITH t AS (
    UPDATE public.leads_campana
    SET calentamiento_fase = 0, calentamiento_ultimo_at = NULL
    WHERE public.tel_norm(telefono) = public.tel_norm(_telefono)
      AND calentamiento_fase > 0
    RETURNING id
  )
  SELECT count(*) INTO _n FROM t;
  RETURN _n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calentamiento_reset(text) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- Vista para el admin: como va la secuencia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_calentamiento_resumen()
RETURNS TABLE (
  fase smallint, leads bigint, ultimo timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT calentamiento_fase, count(*), max(calentamiento_ultimo_at)
  FROM public.leads_campana
  WHERE public.has_role(auth.uid(), 'admin')
    AND calentamiento_fase > 0
    AND COALESCE(archivado, false) = false
  GROUP BY calentamiento_fase
  ORDER BY calentamiento_fase;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_calentamiento_resumen() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_calentamiento_resumen() TO authenticated;

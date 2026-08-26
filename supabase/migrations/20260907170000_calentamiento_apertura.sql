-- =====================================================================
-- Fase 0: la plantilla que abre la conversacion.
--
-- El 99% de la base -- 8.413 leads de 8.461 -- nunca escribio nada. A esos
-- Meta solo deja llegarles con una plantilla HSM aprobada: mandar una
-- plantilla NO abre la ventana de 24 h, solo la abre un mensaje del lead
-- (tocar un boton de respuesta rapida cuenta como mensaje suyo).
--
-- Entonces el flujo completo queda:
--   fase 0  plantilla de apertura  -> si no responde, se deja tranquilo
--                                  -> si responde, se abre la ventana
--   fases 1-3  escalera libre a las 2, 6 y 20 h desde su ultimo mensaje
--
-- Decision de Mario: si no contesta la plantilla NO se insiste.
-- =====================================================================

ALTER TABLE public.calentamiento_piezas
  ADD COLUMN IF NOT EXISTS plantilla_nombre text,
  ADD COLUMN IF NOT EXISTS plantilla_idioma text DEFAULT 'es';

COMMENT ON COLUMN public.calentamiento_piezas.plantilla_nombre IS
  'Nombre exacto de la plantilla HSM en Meta. Solo la fase 0 lo usa; si esta vacio, la apertura no envia nada.';

-- ---------------------------------------------------------------------
-- Tope diario. Meta asigna un limite por numero (suele partir en 1.000
-- destinatarios/dia) y lo sube o lo baja segun la calidad: si mucha gente
-- bloquea o reporta, el numero queda restringido y se cae TODO el canal,
-- incluido el bot que ya funciona. Por eso el tope arranca bajo y se sube
-- a mano mirando la tasa de respuesta.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calentamiento_config (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  tope_diario  int NOT NULL DEFAULT 80,
  activo       boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.calentamiento_config (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.calentamiento_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan config de calentamiento" ON public.calentamiento_config;
CREATE POLICY "Admins gestionan config de calentamiento"
  ON public.calentamiento_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- La pieza de fase 0. Nace SIN plantilla_nombre: hasta que Meta apruebe la
-- plantilla y se cargue el nombre aca, leads_para_apertura no devuelve nada
-- y no se manda nada por error.
INSERT INTO public.calentamiento_piezas (fase, nombre, cuerpo, orden)
SELECT 0, 'Plantilla de apertura',
       'Plantilla HSM de apertura. El texto real vive en Meta; aqui solo se guarda que fase es.', 0
WHERE NOT EXISTS (SELECT 1 FROM public.calentamiento_piezas WHERE fase = 0);

-- ---------------------------------------------------------------------
-- leads_para_apertura(): a quien mandarle la plantilla.
--
-- Solo leads que NUNCA escribieron (si escribieron alguna vez, o estan en
-- ventana y les toca la escalera libre, o ya conocen el proyecto y la
-- apertura no aplica) y a los que nunca se les mando la apertura.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_para_apertura(_limite int DEFAULT 50)
RETURNS TABLE (
  lead_id          uuid,
  telefono         text,
  nombre           text,
  primer_nombre    text,
  plantilla_nombre text,
  plantilla_idioma text,
  restantes_hoy    int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (SELECT tope_diario, activo FROM public.calentamiento_config WHERE id),
  enviadas_hoy AS (
    SELECT count(*) AS n FROM public.calentamiento_envios
    WHERE fase = 0 AND enviado_at >= date_trunc('day', now())
  ),
  pieza AS (
    SELECT plantilla_nombre, COALESCE(plantilla_idioma, 'es') AS idioma
    FROM public.calentamiento_piezas
    WHERE fase = 0 AND activa AND COALESCE(btrim(plantilla_nombre), '') <> ''
    LIMIT 1
  ),
  escribieron AS (
    SELECT public.tel_norm(telefono) AS tel FROM public.mensajes_automatizacion WHERE direccion = 'inbound'
    UNION
    SELECT public.tel_norm(telefono) FROM public.mensajes_whatsapp WHERE direccion = 'inbound'
  )
  SELECT
    l.id, l.telefono, l.nombre,
    COALESCE(NULLIF(split_part(btrim(l.nombre), ' ', 1), ''), 'Hola'),
    p.plantilla_nombre, p.idioma,
    GREATEST(0, (SELECT tope_diario FROM cfg) - (SELECT n FROM enviadas_hoy)::int)
  FROM public.leads_campana l
  CROSS JOIN pieza p
  WHERE (SELECT activo FROM cfg)
    AND COALESCE(l.archivado, false) = false
    AND COALESCE(l.calentamiento_pausado, false) = false
    AND l.telefono NOT LIKE 'sin-tel-%'
    AND l.etapa_venta IN ('nuevo', 'contactado')
    AND NOT EXISTS (SELECT 1 FROM escribieron e WHERE e.tel = public.tel_norm(l.telefono))
    AND NOT EXISTS (SELECT 1 FROM public.calentamiento_envios ce
                    WHERE ce.lead_id = l.id AND ce.fase = 0)
    -- Horario local decente, con el timezone del lead.
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(NULLIF(l.timezone, ''), 'America/Santiago')))
        BETWEEN 9 AND 20
  ORDER BY l.created_at DESC NULLS LAST
  LIMIT LEAST(
    COALESCE(_limite, 50),
    GREATEST(0, (SELECT tope_diario FROM cfg) - (SELECT n FROM enviadas_hoy)::int)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.leads_para_apertura(int) FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------
-- Resumen para el admin, ahora incluyendo la apertura.
-- ---------------------------------------------------------------------
-- Cambia las columnas que devuelve, asi que no basta CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.admin_calentamiento_resumen();

CREATE OR REPLACE FUNCTION public.admin_calentamiento_resumen()
RETURNS TABLE (
  fase smallint, enviados bigint, leads bigint, ultimo timestamptz, hoy bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.fase,
    count(*),
    count(DISTINCT e.lead_id),
    max(e.enviado_at),
    count(*) FILTER (WHERE e.enviado_at >= date_trunc('day', now()))
  FROM public.calentamiento_envios e
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY e.fase
  ORDER BY e.fase;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_calentamiento_resumen() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_calentamiento_resumen() TO authenticated;

-- =====================================================================
-- Historial de Prospección (herramienta "Buscar Leads")
-- ---------------------------------------------------------------------
-- Antes cada búsqueda era efímera: la Edge Function `buscar-leads`
-- llamaba a Perplexity Sonar y devolvía el dataset, pero no se guardaba
-- nada. Esta migración añade persistencia + mini-CRM de prospección:
--
--   prospeccion_busquedas  -> cabecera de cada búsqueda (parámetros + stats)
--   prospeccion_leads      -> los prospectos encontrados en cada búsqueda
--
-- Aporta: historial reabrible, deduplicación global por usuario (no volver
-- a prospectar un negocio ya guardado) y estado de gestión por lead
-- (nuevo -> contactado -> respondió -> cliente -> descartado).
--
-- Las escrituras las hace `buscar-leads` con la service key (ignora RLS).
-- El frontend (admin autenticado) lee, actualiza estado/notas y borra.
-- Idempotente: se puede correr varias veces sin error.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Cabecera de búsqueda
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospeccion_busquedas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_por          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nicho               text NOT NULL,
  ciudad              text NOT NULL,
  servicio            text,
  cantidad_solicitada int  NOT NULL DEFAULT 0,
  cantidad_encontrada int  NOT NULL DEFAULT 0,
  nuevos              int  NOT NULL DEFAULT 0,   -- prospectos no vistos antes
  repetidos           int  NOT NULL DEFAULT 0,   -- ya existían en el historial del usuario
  estadisticas        jsonb NOT NULL DEFAULT '{}'::jsonb, -- % sin web, con email, score prom, etc.
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prosp_busq_creado_por ON public.prospeccion_busquedas (creado_por);
CREATE INDEX IF NOT EXISTS idx_prosp_busq_created_at ON public.prospeccion_busquedas (created_at DESC);

COMMENT ON TABLE public.prospeccion_busquedas IS
  'Cabecera de cada ejecución de "Buscar Leads": parámetros de la búsqueda y estadísticas agregadas del nicho. Una fila por búsqueda.';

-- ---------------------------------------------------------------------
-- 2) Prospectos (detalle)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospeccion_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  busqueda_id      uuid REFERENCES public.prospeccion_busquedas(id) ON DELETE CASCADE,
  creado_por       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identidad / contacto
  nombre           text NOT NULL,
  ciudad           text,
  region           text,
  web              text,
  telefono         text,
  whatsapp         text,
  email            text,
  instagram        text,
  direccion        text,
  google_maps      text,
  fuente           text,          -- dónde se encontró (Google Business, directorio, Instagram, post...)

  -- Scoring / clasificación
  score            int,
  nivel            text,          -- Alta | Media | Baja
  tipo_lead        text,          -- Oportunidad caliente | Reactivar | Nuevo | Descartar
  problemas        text[] NOT NULL DEFAULT '{}',

  -- Material de venta (generado por la IA)
  propuesta_valor  text,
  mensaje_whatsapp text,
  mensaje_email    text,

  -- Mini-CRM de prospección
  estado_gestion   text NOT NULL DEFAULT 'nuevo'
                     CHECK (estado_gestion IN ('nuevo','contactado','respondio','cliente','descartado')),
  notas            text,

  -- Deduplicación global por usuario (nombre normalizado + ciudad)
  dedup_key        text GENERATED ALWAYS AS
                     (lower(trim(coalesce(nombre,''))) || '|' || lower(trim(coalesce(ciudad,'')))) STORED,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Un mismo negocio (por usuario) aparece una sola vez en el historial:
-- así "buscar de nuevo" no vuelve a proponer a quien ya prospectaste.
CREATE UNIQUE INDEX IF NOT EXISTS uq_prosp_leads_dedup
  ON public.prospeccion_leads (creado_por, dedup_key);

CREATE INDEX IF NOT EXISTS idx_prosp_leads_busqueda   ON public.prospeccion_leads (busqueda_id);
CREATE INDEX IF NOT EXISTS idx_prosp_leads_creado_por ON public.prospeccion_leads (creado_por);
CREATE INDEX IF NOT EXISTS idx_prosp_leads_estado     ON public.prospeccion_leads (estado_gestion);
CREATE INDEX IF NOT EXISTS idx_prosp_leads_email_lower ON public.prospeccion_leads (lower(email));

COMMENT ON TABLE public.prospeccion_leads IS
  'Prospectos encontrados por "Buscar Leads". Incluye mensajes de contacto generados por IA y estado de gestión (mini-CRM). Deduplicados por (creado_por, nombre|ciudad).';
COMMENT ON COLUMN public.prospeccion_leads.estado_gestion IS
  'Ciclo de vida del prospecto: nuevo -> contactado -> respondio -> cliente / descartado.';

-- ---------------------------------------------------------------------
-- 3) updated_at automático en prospeccion_leads
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_prospeccion_leads_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospeccion_leads_touch ON public.prospeccion_leads;
CREATE TRIGGER trg_prospeccion_leads_touch
  BEFORE UPDATE ON public.prospeccion_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_prospeccion_leads_touch();

-- ---------------------------------------------------------------------
-- 4) RLS: solo admins autenticados. Las inserciones las hace la Edge
--    Function con service_role (ignora RLS); el frontend lee/actualiza/borra.
-- ---------------------------------------------------------------------
ALTER TABLE public.prospeccion_busquedas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccion_leads     ENABLE ROW LEVEL SECURITY;

-- Búsquedas: leer y borrar (borrar cascada elimina sus leads)
DROP POLICY IF EXISTS "Admins read prospeccion_busquedas" ON public.prospeccion_busquedas;
CREATE POLICY "Admins read prospeccion_busquedas"
  ON public.prospeccion_busquedas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete prospeccion_busquedas" ON public.prospeccion_busquedas;
CREATE POLICY "Admins delete prospeccion_busquedas"
  ON public.prospeccion_busquedas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Leads: leer, actualizar (estado/notas) y borrar
DROP POLICY IF EXISTS "Admins read prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Admins read prospeccion_leads"
  ON public.prospeccion_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Admins update prospeccion_leads"
  ON public.prospeccion_leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Admins delete prospeccion_leads"
  ON public.prospeccion_leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (Sin políticas de INSERT: solo service_role, que ignora RLS.)

-- ---------------------------------------------------------------------
-- 5) RPC: lista de búsquedas del historial con conteo de leads y
--    desglose por estado de gestión. Para el panel "Historial".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prospeccion_historial()
RETURNS TABLE (
  id                  uuid,
  nicho               text,
  ciudad              text,
  servicio            text,
  cantidad_encontrada int,
  nuevos              int,
  repetidos           int,
  estadisticas        jsonb,
  created_at          timestamptz,
  total_leads         bigint,
  contactados         bigint,
  clientes            bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id, b.nicho, b.ciudad, b.servicio, b.cantidad_encontrada,
    b.nuevos, b.repetidos, b.estadisticas, b.created_at,
    count(l.id)                                              AS total_leads,
    count(l.id) FILTER (WHERE l.estado_gestion = 'contactado') AS contactados,
    count(l.id) FILTER (WHERE l.estado_gestion = 'cliente')    AS clientes
  FROM public.prospeccion_busquedas b
  LEFT JOIN public.prospeccion_leads l ON l.busqueda_id = b.id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.prospeccion_historial() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.prospeccion_historial() TO authenticated, service_role;

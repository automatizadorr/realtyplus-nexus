-- =====================================================================
-- Rol "vendedor" — acceso acotado a leads de prospección "en campaña"
-- ---------------------------------------------------------------------
-- Un vendedor:
--   * ve SOLO prospeccion_leads con en_campana = true, cuyo país esté
--     en sus países asignados (vendedor_paises) o que le hayan sido
--     asignados directamente (asignado_a).
--   * NO puede buscar leads nuevos (buscar-leads sigue admin-only).
--   * puede actualizar estado_gestion/notas de sus leads vía RPC
--     (no UPDATE directo) para no exponer el resto de las columnas.
--   * lee plantillas de WhatsApp/email activas (las gestiona el admin)
--     y registra sus contactos en contactos_log.
--
-- PASO 2 DE 2: ejecutar después de que 20260819200000_vendedor_enum.sql
-- haya confirmado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Perfil/configuración del vendedor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendedores (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activo             boolean NOT NULL DEFAULT true,
  nombre_display     text,
  telefono_contacto  text,
  limite_mensajes_dia int NOT NULL DEFAULT 50,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendedores IS
  'Perfil/configuración de cada usuario con rol vendedor: si está activo, límite diario de mensajes, datos de contacto.';

-- ---------------------------------------------------------------------
-- 2) Países asignados a cada vendedor (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendedor_paises (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pais        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pais)
);

COMMENT ON TABLE public.vendedor_paises IS
  'Países que puede trabajar cada vendedor. Un vendedor solo ve prospeccion_leads en_campana cuyo país esté aquí (o que tengan asignado_a = su user_id).';

-- ---------------------------------------------------------------------
-- 3) prospeccion_leads: país normalizado, publicación a campaña,
--    asignación opcional directa a un vendedor
-- ---------------------------------------------------------------------
ALTER TABLE public.prospeccion_leads
  ADD COLUMN IF NOT EXISTS pais        text,
  ADD COLUMN IF NOT EXISTS en_campana  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asignado_a  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prosp_leads_pais       ON public.prospeccion_leads (pais);
CREATE INDEX IF NOT EXISTS idx_prosp_leads_en_campana ON public.prospeccion_leads (en_campana);
CREATE INDEX IF NOT EXISTS idx_prosp_leads_asignado_a ON public.prospeccion_leads (asignado_a);

COMMENT ON COLUMN public.prospeccion_leads.en_campana IS
  'true = el admin lo "publicó" a ventas; visible para vendedores con acceso a su país (o asignado_a).';
COMMENT ON COLUMN public.prospeccion_leads.asignado_a IS
  'Opcional: fuerza la visibilidad a un vendedor específico, aunque haya varios en el mismo país.';

-- ---------------------------------------------------------------------
-- 4) Plantillas de contacto (gestionadas por admin)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plantillas_whatsapp (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  contenido   text NOT NULL,   -- soporta {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}
  activa      boolean NOT NULL DEFAULT true,
  creado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plantillas_email (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  asunto      text NOT NULL,
  cuerpo_html text NOT NULL,
  cuerpo_text text,
  activa      boolean NOT NULL DEFAULT true,
  creado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5) Log de contactos (trazabilidad por vendedor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contactos_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES public.prospeccion_leads(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal          text NOT NULL CHECK (canal IN ('whatsapp','email')),
  plantilla_id   uuid,
  mensaje_final  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contactos_log_lead ON public.contactos_log (lead_id);
CREATE INDEX IF NOT EXISTS idx_contactos_log_user ON public.contactos_log (user_id);

-- ---------------------------------------------------------------------
-- 6) Helper: vendedor activo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_activo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendedores WHERE user_id = _user_id AND activo = true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_activo(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_activo(uuid) TO authenticated, service_role;

-- Helper: el lead es visible para el vendedor autenticado
CREATE OR REPLACE FUNCTION public.vendedor_ve_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prospeccion_leads l
    WHERE l.id = _lead_id
      AND l.en_campana = true
      AND (
        l.asignado_a = _user_id
        OR EXISTS (
          SELECT 1 FROM public.vendedor_paises vp
          WHERE vp.user_id = _user_id AND vp.pais = l.pais
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_ve_lead(uuid, uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_ve_lead(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.vendedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_paises   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_email    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos_log       ENABLE ROW LEVEL SECURITY;

-- vendedores: admin CRUD completo; el propio vendedor lee su fila
DROP POLICY IF EXISTS "Admins manage vendedores" ON public.vendedores;
CREATE POLICY "Admins manage vendedores"
  ON public.vendedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee su perfil" ON public.vendedores;
CREATE POLICY "Vendedor lee su perfil"
  ON public.vendedores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- vendedor_paises: admin CRUD completo; el propio vendedor lee sus países
DROP POLICY IF EXISTS "Admins manage vendedor_paises" ON public.vendedor_paises;
CREATE POLICY "Admins manage vendedor_paises"
  ON public.vendedor_paises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee sus paises" ON public.vendedor_paises;
CREATE POLICY "Vendedor lee sus paises"
  ON public.vendedor_paises FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- plantillas_whatsapp: admin CRUD completo; vendedor activo lee las activas
DROP POLICY IF EXISTS "Admins manage plantillas_whatsapp" ON public.plantillas_whatsapp;
CREATE POLICY "Admins manage plantillas_whatsapp"
  ON public.plantillas_whatsapp FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee plantillas_whatsapp activas" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor lee plantillas_whatsapp activas"
  ON public.plantillas_whatsapp FOR SELECT TO authenticated
  USING (
    activa = true
    AND public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
  );

-- plantillas_email: admin CRUD completo; vendedor activo lee las activas
DROP POLICY IF EXISTS "Admins manage plantillas_email" ON public.plantillas_email;
CREATE POLICY "Admins manage plantillas_email"
  ON public.plantillas_email FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee plantillas_email activas" ON public.plantillas_email;
CREATE POLICY "Vendedor lee plantillas_email activas"
  ON public.plantillas_email FOR SELECT TO authenticated
  USING (
    activa = true
    AND public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
  );

-- contactos_log: admin lee todo; vendedor inserta/lee lo propio sobre leads que puede ver
DROP POLICY IF EXISTS "Admins read contactos_log" ON public.contactos_log;
CREATE POLICY "Admins read contactos_log"
  ON public.contactos_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendedor lee su contactos_log" ON public.contactos_log;
CREATE POLICY "Vendedor lee su contactos_log"
  ON public.contactos_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Vendedor inserta contactos_log propio" ON public.contactos_log;
CREATE POLICY "Vendedor inserta contactos_log propio"
  ON public.contactos_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND public.vendedor_ve_lead(auth.uid(), lead_id)
  );

-- prospeccion_leads: nueva política SELECT para vendedores
-- (las políticas de admin ya existen y no cambian)
DROP POLICY IF EXISTS "Vendedores read leads en campana" ON public.prospeccion_leads;
CREATE POLICY "Vendedores read leads en campana"
  ON public.prospeccion_leads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor')
    AND public.vendedor_activo(auth.uid())
    AND en_campana = true
    AND (
      asignado_a = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.vendedor_paises vp
        WHERE vp.user_id = auth.uid() AND vp.pais = prospeccion_leads.pais
      )
    )
  );

-- ---------------------------------------------------------------------
-- 8) RPC: el vendedor actualiza estado/notas de un lead propio
--    (no UPDATE directo: solo estas dos columnas quedan expuestas)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendedor_actualizar_lead(
  _lead_id uuid,
  _estado  text,
  _notas   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'vendedor') OR NOT public.vendedor_activo(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _estado NOT IN ('nuevo','contactado','respondio','cliente','descartado') THEN
    RAISE EXCEPTION 'Estado inválido: %', _estado;
  END IF;

  IF NOT public.vendedor_ve_lead(auth.uid(), _lead_id) THEN
    RAISE EXCEPTION 'Lead no encontrado o sin acceso';
  END IF;

  UPDATE public.prospeccion_leads
  SET estado_gestion = _estado,
      notas          = _notas
  WHERE id = _lead_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendedor_actualizar_lead(uuid, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_actualizar_lead(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- Alta de un vendedor (ejecutar a mano, reemplazando el uuid y datos):
--
--   INSERT INTO public.user_roles (user_id, role)
--     VALUES ('<uuid-del-usuario>', 'vendedor');
--
--   INSERT INTO public.vendedores (user_id, activo, nombre_display, telefono_contacto, limite_mensajes_dia)
--     VALUES ('<uuid-del-usuario>', true, 'Nombre Apellido', '+56...', 50);
--
--   INSERT INTO public.vendedor_paises (user_id, pais) VALUES
--     ('<uuid-del-usuario>', 'Chile'),
--     ('<uuid-del-usuario>', 'México');
-- ---------------------------------------------------------------------

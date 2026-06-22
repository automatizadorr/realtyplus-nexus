-- ============================================================
-- Log append-only del workflow n8n "Reporte Etiquetados → Jefatura"
-- (2026-06-04)
-- Cada envío (éxito o error) deja una fila. NUNCA se actualiza ni borra:
-- no se crean políticas UPDATE/DELETE, así el historial es inmutable.
-- n8n escribe con la SERVICE ROLE KEY (que ignora RLS), por eso no se
-- necesita política INSERT para el rol anónimo.
-- Idempotente: re-ejecutar produce el mismo resultado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.logs_expansion (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  evento          text        NOT NULL,            -- 'enviado' | 'error'
  filtro          text,
  total_leads     integer,
  total_mensajes  integer,
  total_etiquetas integer,
  destinatario    text,
  detalle         text
);

COMMENT ON TABLE public.logs_expansion IS
  'Log append-only de envíos del reporte de etiquetados a la jefatura (workflow n8n /expansion).';

-- Índice para consultar el historial por fecha
CREATE INDEX IF NOT EXISTS idx_logs_expansion_created_at
  ON public.logs_expansion (created_at DESC);

-- RLS activo: nadie lee/escribe con anon key. Solo la service role (n8n)
-- y los admins vía una política de SELECT pueden ver el historial.
ALTER TABLE public.logs_expansion ENABLE ROW LEVEL SECURITY;

-- Lectura solo para administradores autenticados (usa la función has_role ya
-- existente en el proyecto). Sin políticas de INSERT/UPDATE/DELETE a propósito.
DROP POLICY IF EXISTS "admins_leen_logs_expansion" ON public.logs_expansion;
CREATE POLICY "admins_leen_logs_expansion"
  ON public.logs_expansion
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

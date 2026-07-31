-- =====================================================================
-- Seguimiento de correos (Resend): saber cuándo el lead RECIBE o ABRE.
-- ---------------------------------------------------------------------
-- send-personalized-campaign registra una fila por correo enviado (con el
-- email_id de Resend). La Edge Function `resend-webhook` recibe los eventos
-- de Resend (delivered/opened/clicked/bounced/complained) y actualiza el
-- estado + timestamps cruzando por resend_id.
-- RLS: solo admins leen; las escrituras las hacen las funciones (service_role).
-- Idempotente.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.correo_envios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id        text UNIQUE,                 -- email_id que devuelve Resend (clave de cruce)
  email            text NOT NULL,
  empresa          text,
  asunto           text,
  enviado_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  estado           text NOT NULL DEFAULT 'enviado'
                     CHECK (estado IN ('enviado','entregado','abierto','click','rebotado','quejado','fallido')),
  error            text,

  enviado_at       timestamptz NOT NULL DEFAULT now(),
  entregado_at     timestamptz,
  abierto_at       timestamptz,
  click_at         timestamptz,
  rebotado_at      timestamptz,
  opens            int NOT NULL DEFAULT 0,
  clicks           int NOT NULL DEFAULT 0,
  ultimo_evento_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_correo_envios_resend   ON public.correo_envios (resend_id);
CREATE INDEX IF NOT EXISTS idx_correo_envios_enviado  ON public.correo_envios (enviado_at DESC);
CREATE INDEX IF NOT EXISTS idx_correo_envios_estado   ON public.correo_envios (estado);
CREATE INDEX IF NOT EXISTS idx_correo_envios_por      ON public.correo_envios (enviado_por);
CREATE INDEX IF NOT EXISTS idx_correo_envios_email    ON public.correo_envios (lower(email));

COMMENT ON TABLE public.correo_envios IS
  'Log de correos enviados por Resend y su estado de entrega/apertura (webhook resend-webhook). Una fila por correo.';

ALTER TABLE public.correo_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read correo_envios" ON public.correo_envios;
CREATE POLICY "Admins read correo_envios"
  ON public.correo_envios FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (Sin políticas INSERT/UPDATE: solo service_role, que ignora RLS.)

-- KPIs rápidos para el panel de seguimiento (últimos N días).
CREATE OR REPLACE FUNCTION public.correo_envios_resumen(_dias int DEFAULT 30)
RETURNS TABLE (total bigint, entregados bigint, abiertos bigint, clicks bigint, rebotados bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE entregado_at IS NOT NULL OR estado IN ('entregado','abierto','click')),
    count(*) FILTER (WHERE abierto_at IS NOT NULL OR estado IN ('abierto','click')),
    count(*) FILTER (WHERE click_at IS NOT NULL OR estado = 'click'),
    count(*) FILTER (WHERE estado = 'rebotado')
  FROM public.correo_envios
  WHERE public.has_role(auth.uid(), 'admin')
    AND enviado_at >= now() - make_interval(days => greatest(_dias, 1));
$$;

REVOKE EXECUTE ON FUNCTION public.correo_envios_resumen(int) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.correo_envios_resumen(int) TO authenticated, service_role;

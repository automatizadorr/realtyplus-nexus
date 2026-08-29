-- voice_llamadas + plan_limites voz + voice_minutos_disponibles
-- Migración para tracking de consumo de voz por plan (Growth 1h / Pro 2h / Enterprise 5h web+CRM + telefónico Enterprise)

-- 1. Extender plan_limites con columnas de voz
ALTER TABLE public.plan_limites
ADD COLUMN IF NOT EXISTS voz_minutos_incluidos int DEFAULT 0,
ADD COLUMN IF NOT EXISTS voz_telephony_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS excedente_minuto_usd numeric DEFAULT 0.15;

-- Actualizar planes existentes
UPDATE public.plan_limites SET
  voz_minutos_incluidos = 0,
  voz_telephony_enabled = false,
  excedente_minuto_usd = 0.15
WHERE plan = 'gratis';

UPDATE public.plan_limites SET
  voz_minutos_incluidos = 0,
  voz_telephony_enabled = false,
  excedente_minuto_usd = 0.15
WHERE plan = 'motor_ventas';

-- Insertar planes de Plataforma (si no existen)
INSERT INTO public.plan_limites (plan, nombre, precio_mes_usd, activacion_usd,
  conversaciones_incluidas, busquedas_incluidas, correos_incluidos, vendedores_incluidos,
  correos_tope, excedente_conversacion_usd, excedente_busqueda_usd,
  excedente_mil_correos_usd, excedente_vendedor_usd,
  voz_minutos_incluidos, voz_telephony_enabled, excedente_minuto_usd)
VALUES
  ('growth', 'Growth', 199, 499, 1000, 100, 2000, 5, 5000, 0.09, 0.50, 5.00, 15.00, 60, false, 0.15),
  ('pro', 'Pro', 299, 699, 2000, 200, 5000, 10, 10000, 0.09, 0.50, 5.00, 15.00, 120, false, 0.15),
  ('enterprise', 'Enterprise', 499, 1199, 5000, 500, 7000, 20, 20000, 0.09, 0.50, 5.00, 15.00, 300, true, 0.15)
ON CONFLICT (plan) DO UPDATE SET
  voz_minutos_incluidos = EXCLUDED.voz_minutos_incluidos,
  voz_telephony_enabled = EXCLUDED.voz_telephony_enabled,
  excedente_minuto_usd = EXCLUDED.excedente_minuto_usd;

-- 2. Tabla voice_llamadas (append-only log)
CREATE TABLE IF NOT EXISTS public.voice_llamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider text NOT NULL,
  call_id text UNIQUE NOT NULL,
  agent_id text,
  duration_seconds int DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  transcript text,
  recording_url text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no_answer', 'voicemail')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.voice_llamadas ENABLE ROW LEVEL SECURITY;

-- Admin ve todo
CREATE POLICY "voice_llamadas_admin_all" ON public.voice_llamadas
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Usuario ve solo de su cuenta
CREATE POLICY "voice_llamadas_user_select" ON public.voice_llamadas
FOR SELECT USING (
  public.cuenta_de_usuario(auth.uid()) = cuenta_id
);

-- Service role insert/update (edge functions)
CREATE POLICY "voice_llamadas_service_insert" ON public.voice_llamadas
FOR INSERT WITH CHECK (true);
CREATE POLICY "voice_llamadas_service_update" ON public.voice_llamadas
FOR UPDATE USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS voice_llamadas_cuenta_id_idx ON public.voice_llamadas(cuenta_id);
CREATE INDEX IF NOT EXISTS voice_llamadas_user_id_idx ON public.voice_llamadas(user_id);
CREATE INDEX IF NOT EXISTS voice_llamadas_call_id_idx ON public.voice_llamadas(call_id);
CREATE INDEX IF NOT EXISTS voice_llamadas_started_at_idx ON public.voice_llamadas(started_at DESC);

-- 3. Extender consumo_periodo para incluir voz_minutos
CREATE OR REPLACE FUNCTION public.consumo_periodo(_cuenta uuid, _desde timestamptz, _hasta timestamptz)
RETURNS TABLE (
  recurso text,
  usado numeric,
  incluido numeric,
  tope numeric,
  excedente_usd numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan text;
  v_limites record;
  v_voz_minutos numeric;
BEGIN
  -- Obtener plan de la cuenta
  SELECT plan INTO v_plan FROM public.cuentas WHERE id = _cuenta;
  IF v_plan IS NULL THEN v_plan := 'gratis'; END IF;

  SELECT * INTO v_limites FROM public.plan_limites WHERE plan = v_plan;
  IF NOT FOUND THEN
    SELECT * INTO v_limites FROM public.plan_limites WHERE plan = 'gratis';
  END IF;

  -- Recursos existentes (calentamiento, recordatorios, búsquedas, correos, vendedores)
  RETURN QUERY
  SELECT 'calentamiento'::text, COUNT(*)::numeric, v_limites.conversaciones_incluidas::numeric, NULL::numeric, v_limites.excedente_conversacion_usd
  FROM public.calentamiento_envios
  WHERE cuenta_id = _cuenta AND enviado = true AND enviado_at >= _desde AND enviado_at < _hasta
  UNION ALL
  SELECT 'recordatorios'::text, COUNT(*)::numeric, v_limites.conversaciones_incluidas::numeric, NULL::numeric, v_limites.excedente_conversacion_usd
  FROM public.recordatorios_envios
  WHERE cuenta_id = _cuenta AND enviado = true AND enviado_at >= _desde AND enviado_at < _hasta
  UNION ALL
  SELECT 'busquedas'::text, COUNT(*)::numeric, v_limites.busquedas_incluidas::numeric, NULL::numeric, v_limites.excedente_busqueda_usd
  FROM public.prospeccion_busquedas
  WHERE cuenta_id = _cuenta AND created_at >= _desde AND created_at < _hasta
  UNION ALL
  SELECT 'correos'::text, COUNT(*)::numeric, v_limites.correos_incluidos::numeric, v_limites.correos_tope::numeric, v_limites.excedente_mil_correos_usd
  FROM public.correo_envios
  WHERE cuenta_id = _cuenta AND enviado = true AND enviado_at >= _desde AND enviado_at < _hasta
  UNION ALL
  SELECT 'vendedores'::text, COUNT(*)::numeric, v_limites.vendedores_incluidos::numeric, NULL::numeric, v_limites.excedente_vendedor_usd
  FROM public.vendedores
  WHERE cuenta_id = _cuenta AND activo = true;

  -- NUEVO: Voz - minutos consumidos en el período
  SELECT COALESCE(CEIL(SUM(duration_seconds)::numeric / 60), 0) INTO v_voz_minutos
  FROM public.voice_llamadas
  WHERE cuenta_id = _cuenta
    AND direction = 'outbound'
    AND status IN ('answered', 'completed')
    AND started_at >= _desde AND started_at < _hasta;

  RETURN QUERY
  SELECT 'voz_minutos'::text, v_voz_minutos, v_limites.voz_minutos_incluidos::numeric, NULL::numeric, v_limites.excedente_minuto_usd;
END;
$$;

-- 4. Función voice_minutos_disponibles (guarda para orchestrator pre-flight)
CREATE OR REPLACE FUNCTION public.voice_minutos_disponibles(_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cuenta uuid;
  v_plan text;
  v_limites record;
  v_periodo_inicio timestamptz;
  v_periodo_fin timestamptz;
  v_usados numeric;
  v_incluidos int;
  v_restantes numeric;
BEGIN
  v_cuenta := public.cuenta_de_usuario(_user);
  IF v_cuenta IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_CUENTA');
  END IF;

  SELECT plan INTO v_plan FROM public.cuentas WHERE id = v_cuenta;
  IF v_plan IS NULL THEN v_plan := 'gratis'; END IF;

  SELECT * INTO v_limites FROM public.plan_limites WHERE plan = v_plan;
  IF NOT FOUND THEN
    SELECT * INTO v_limites FROM public.plan_limites WHERE plan = 'gratis';
  END IF;

  SELECT * INTO v_periodo_inicio, v_periodo_fin FROM public.periodo_facturacion(v_cuenta);

  SELECT COALESCE(CEIL(SUM(duration_seconds)::numeric / 60), 0) INTO v_usados
  FROM public.voice_llamadas
  WHERE cuenta_id = v_cuenta
    AND direction = 'outbound'
    AND status IN ('answered', 'completed')
    AND started_at >= v_periodo_inicio AND started_at < v_periodo_fin;

  v_incluidos := v_limites.voz_minutos_incluidos;
  v_restantes := GREATEST(v_incluidos - v_usados, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'usados', v_usados,
    'incluidos', v_incluidos,
    'restantes_min', v_restantes,
    'telephony_enabled', v_limites.voz_telephony_enabled,
    'excedente_minuto_usd', v_limites.excedente_minuto_usd,
    'periodo_fin', v_periodo_fin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.voice_minutos_disponibles(uuid) TO authenticated, service_role;

-- 5. Función admin_voice_resumen (para dashboard)
CREATE OR REPLACE FUNCTION public.admin_voice_resumen(_cuenta uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cuenta record;
  v_periodo_inicio timestamptz;
  v_periodo_fin timestamptz;
  v_llamadas jsonb;
  v_total_minutos numeric;
  v_total_costo numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_ADMIN');
  END IF;

  SELECT * INTO v_cuenta FROM public.cuentas WHERE id = _cuenta;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'CUENTA_NOT_FOUND'); END IF;

  SELECT * INTO v_periodo_inicio, v_periodo_fin FROM public.periodo_facturacion(_cuenta);

  SELECT jsonb_agg(jsonb_build_object(
    'call_id', call_id,
    'phone', phone,
    'direction', direction,
    'duration_seconds', duration_seconds,
    'duration_min', ROUND(duration_seconds::numeric / 60, 2),
    'cost_usd', cost_usd,
    'status', status,
    'started_at', started_at,
    'ended_at', ended_at
  ) ORDER BY started_at DESC) INTO v_llamadas
  FROM public.voice_llamadas
  WHERE cuenta_id = _cuenta
    AND started_at >= v_periodo_inicio AND started_at < v_periodo_fin;

  SELECT COALESCE(SUM(duration_seconds), 0)::numeric / 60, COALESCE(SUM(cost_usd), 0)
  INTO v_total_minutos, v_total_costo
  FROM public.voice_llamadas
  WHERE cuenta_id = _cuenta
    AND started_at >= v_periodo_inicio AND started_at < v_periodo_fin;

  RETURN jsonb_build_object(
    'ok', true,
    'cuenta', v_cuenta.nombre,
    'plan', v_cuenta.plan,
    'periodo_inicio', v_periodo_inicio,
    'periodo_fin', v_periodo_fin,
    'total_minutos', ROUND(v_total_minutos, 2),
    'total_costo_usd', v_total_costo,
    'llamadas', v_llamadas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_voice_resumen(uuid) TO authenticated, service_role;
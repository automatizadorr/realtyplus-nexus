-- =====================================================================
-- Espejo de Google Sheet4 en Postgres: tabla leads_sheet
-- ---------------------------------------------------------------------
-- Reemplaza la lectura en vivo del gateway de Lovable + Google Sheets.
-- La pobla la Edge Function `resync-leads-sheet` (cron + manual).
-- Las funciones sheets-leads / sheets-country-kpis / sync-id-contacto
-- pasan a leer de esta tabla.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.leads_sheet (
  id_contacto        text PRIMARY KEY,           -- clave de upsert (fallback 'tel:<telefono>' si el Sheet no trae id)
  nombres            text,
  apellidos          text,
  email              text,
  telefono           text,
  pais               text NOT NULL DEFAULT 'Sin país',
  dias_transcurridos int  NOT NULL DEFAULT 0,
  synced_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_sheet_email_lower ON public.leads_sheet (lower(email));
CREATE INDEX IF NOT EXISTS idx_leads_sheet_pais        ON public.leads_sheet (pais);
CREATE INDEX IF NOT EXISTS idx_leads_sheet_tel         ON public.leads_sheet (telefono);

-- ---------------------------------------------------------------------
-- RLS: solo admins autenticados pueden leer; escrituras solo service_role
-- (la anon key, pública en el frontend, NO debe poder leer nada aquí).
-- ---------------------------------------------------------------------
ALTER TABLE public.leads_sheet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read leads_sheet" ON public.leads_sheet;
CREATE POLICY "Admins can read leads_sheet"
  ON public.leads_sheet FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (Sin políticas para INSERT/UPDATE/DELETE: solo service_role, que ignora RLS.)

-- ---------------------------------------------------------------------
-- RPC: KPIs por país (sustituye la agregación de sheets-country-kpis)
-- Mismo contrato: pais, total, recientes_7d, promedio_dias, pct
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kpis_por_pais()
RETURNS TABLE (pais text, total bigint, recientes_7d bigint, promedio_dias numeric, pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(trim(ls.pais), ''), 'Sin país') AS pais,
           ls.dias_transcurridos AS dias
    FROM public.leads_sheet ls
  ),
  agg AS (
    SELECT b.pais,
           count(*) AS total,
           count(*) FILTER (WHERE b.dias <= 7) AS recientes_7d,
           round(avg(b.dias)::numeric, 1) AS promedio_dias
    FROM base b
    GROUP BY b.pais
  ),
  tot AS (SELECT count(*)::numeric AS t FROM base)
  SELECT a.pais, a.total, a.recientes_7d, a.promedio_dias,
         CASE WHEN (SELECT t FROM tot) > 0
              THEN round(a.total * 100.0 / (SELECT t FROM tot), 1)
              ELSE 0 END AS pct
  FROM agg a
  ORDER BY a.total DESC;
$$;

-- ---------------------------------------------------------------------
-- RPC: sincroniza id_contacto del Sheet hacia leads_campana (cruce email)
-- Sustituye el pull al gateway de sync-id-contacto por un único UPDATE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_id_contacto_from_sheet()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_unchanged int;
  v_unmatched int;
  v_leads_with_email int;
  v_sheet_unique int;
  v_sheet_rows int;
BEGIN
  -- Conteos por estado (sin match / sin cambios) ANTES de actualizar.
  -- Un id por email del Sheet (max() determinista); se ignoran ids sintéticos 'tel:%'.
  WITH lc AS (
    SELECT lower(lc.email) AS em, lc.id_contacto AS cur
    FROM public.leads_campana lc
    WHERE lc.email IS NOT NULL AND lc.email <> ''
  ),
  sheet AS (
    SELECT lower(email) AS em, max(id_contacto) AS sid
    FROM public.leads_sheet
    WHERE email IS NOT NULL AND email <> ''
      AND id_contacto IS NOT NULL AND id_contacto <> '' AND id_contacto NOT LIKE 'tel:%'
    GROUP BY lower(email)
  ),
  joined AS (
    SELECT lc.cur, s.sid
    FROM lc LEFT JOIN sheet s ON s.em = lc.em
  )
  SELECT
    count(*) FILTER (WHERE sid IS NULL),
    count(*) FILTER (WHERE sid IS NOT NULL AND cur IS NOT DISTINCT FROM sid)
  INTO v_unmatched, v_unchanged
  FROM joined;

  -- Aplicar el UPDATE (cruce por email).
  WITH sheet AS (
    SELECT lower(email) AS em, max(id_contacto) AS sid
    FROM public.leads_sheet
    WHERE email IS NOT NULL AND email <> ''
      AND id_contacto IS NOT NULL AND id_contacto <> '' AND id_contacto NOT LIKE 'tel:%'
    GROUP BY lower(email)
  ),
  upd AS (
    UPDATE public.leads_campana lc
    SET id_contacto = s.sid
    FROM sheet s
    WHERE lower(lc.email) = s.em
      AND lc.email IS NOT NULL AND lc.email <> ''
      AND lc.id_contacto IS DISTINCT FROM s.sid
    RETURNING lc.id
  )
  SELECT count(*) INTO v_updated FROM upd;

  SELECT count(*) INTO v_leads_with_email
    FROM public.leads_campana WHERE email IS NOT NULL AND email <> '';
  SELECT count(DISTINCT lower(email)) INTO v_sheet_unique
    FROM public.leads_sheet WHERE email IS NOT NULL AND email <> '';
  SELECT count(*) INTO v_sheet_rows FROM public.leads_sheet;

  RETURN json_build_object(
    'success', true,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'unmatched', v_unmatched,
    'actualizados', v_updated,   -- alias usado por Dashboard.tsx
    'sin_match', v_unmatched,    -- alias usado por Dashboard.tsx
    'leads_with_email', v_leads_with_email,
    'sheet_unique_emails', v_sheet_unique,
    'sheet_rows', v_sheet_rows
  );
END;
$$;

-- Solo service_role puede ejecutar las RPCs (las Edge Functions las llaman
-- con la service key; el frontend nunca directamente).
REVOKE EXECUTE ON FUNCTION public.kpis_por_pais()                FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_id_contacto_from_sheet()  FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kpis_por_pais()                TO service_role;
GRANT  EXECUTE ON FUNCTION public.sync_id_contacto_from_sheet()  TO service_role;

-- =====================================================================
-- CRON (ejecútalo APARTE en el SQL Editor con tu secreto real; NO se
-- versiona con el secreto). Requiere extensiones pg_cron y pg_net.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'resync-leads-sheet',
--   '*/15 * * * *',
--   $$
--     select net.http_post(
--       url     := 'https://owykkhwqpnumvgdeugmj.functions.supabase.co/resync-leads-sheet',
--       headers := jsonb_build_object('Content-Type','application/json','X-Resync-Secret','<TU_RESYNC_SECRET>'),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
-- =====================================================================

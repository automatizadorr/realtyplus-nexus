-- =====================================================================
-- BACKFILL correo_envios: nombre / empresa / pais desde las tablas de leads
-- ---------------------------------------------------------------------
-- Los envíos anteriores al fix dejaron nombre/empresa/pais en NULL en
-- correo_envios (las edges no los guardaban). Al llevar "los que recibidos"
-- a Correos Personalizados la tabla salía vacía.
-- Este UPDATE cruza por email (minúsculas) con leads_campana y
-- prospeccion_leads y completa las celdas vacías sin pisar lo existente.
-- Solo corre si las dos tablas existen. Idempotente.
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('public.leads_campana') IS NULL OR to_regclass('public.prospeccion_leads') IS NULL THEN
    RAISE NOTICE 'correo_envios backfill omitido: faltan tables leads_campana/prospeccion_leads';
    RETURN;
  END IF;

  UPDATE public.correo_envios ce
  SET
    nombre  = COALESCE(ce.nombre,  x.nombre),
    empresa = COALESCE(ce.empresa, x.empresa),
    pais    = COALESCE(ce.pais,    x.pais)
  FROM (
    SELECT DISTINCT ON (email) email, nombre, empresa, pais
    FROM (
      SELECT lower(btrim(email)) AS email, nombre, nombre AS empresa, pais
      FROM public.leads_campana
      WHERE email IS NOT NULL AND btrim(email) <> ''
      UNION ALL
      SELECT lower(btrim(email)) AS email, nombre, nombre AS empresa, region AS pais
      FROM public.prospeccion_leads
      WHERE email IS NOT NULL AND btrim(email) <> ''
    ) u
    ORDER BY email
  ) x
  WHERE lower(btrim(ce.email)) = x.email
    AND (ce.nombre IS NULL OR ce.empresa IS NULL OR ce.pais IS NULL);

  RAISE NOTICE 'correo_envios backfill: celdas vacías rellenadas desde leads_campana/prospeccion_leads';
END $$;
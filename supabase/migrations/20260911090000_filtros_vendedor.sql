-- =====================================================================
-- Filtros del vendedor: facetas propias + cola de Hoy filtrable.
--
-- Dos huecos que reporto un vendedor:
--
-- 1) En la Bandeja no se podia buscar por pais. El unico filtro era un
--    buscador de texto sobre nombre/email/telefono.
--
-- 2) El selector de pais del Pipeline salia de una lista FIJA de paises
--    de prospeccion, no de los leads que el vendedor tiene de verdad:
--    ofrecia paises sin un solo lead y escondia los que si tenia si no
--    estaban en esa lista.
--
-- vendedor_paises() arregla los dos: devuelve los paises de SUS leads
-- vivos, con cuantos hay en cada uno.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.vendedor_paises()
RETURNS TABLE (pais text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(NULLIF(btrim(l.pais), ''), 'Sin pais') AS pais, count(*) AS n
  FROM public.leads_campana l
  WHERE l.vendedor_id = auth.uid()
    AND coalesce(l.archivado, false) = false
  GROUP BY 1
  ORDER BY 2 DESC, 1;
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_paises() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_paises() TO authenticated;

COMMENT ON FUNCTION public.vendedor_paises() IS
  'Paises de los leads del vendedor con su conteo, para alimentar el filtro de pais sin ofrecer opciones vacias.';

-- ---------------------------------------------------------------------
-- La cola de Hoy tambien se filtra.
--
-- Filtrar en el cliente no alcanza: la pantalla trae las primeras 100
-- filas de la cola, asi que buscar "Chile" sobre lo ya cargado se pierde
-- todo lo que quedo mas abajo. El filtro va donde se arma la cola.
--
-- Los contadores (vendedor_cola_resumen) siguen contando TODO a
-- proposito: el badge tiene que decir cuanto trabajo hay, no cuanto
-- queda del filtro puesto.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vendedor_cola_hoy(text, int);

CREATE OR REPLACE FUNCTION public.vendedor_cola_hoy(
  _tz     text DEFAULT 'America/Santiago',
  _limite int  DEFAULT 60,
  _q      text DEFAULT NULL,
  _pais   text DEFAULT NULL,
  _motivo text DEFAULT NULL
)
RETURNS TABLE (
  id                     uuid,
  nombre                 text,
  telefono               text,
  email                  text,
  pais                   text,
  etapa_venta            text,
  ha_respondido          boolean,
  resumen_ia             text,
  instagram              text,
  facebook               text,
  mensaje_instagram      text,
  notas_vendedor         text,
  origen                 text,
  fecha_asignacion       timestamptz,
  primer_contacto_at     timestamptz,
  ultimo_contacto_at     timestamptz,
  fecha_proximo_contacto timestamptz,
  traspasado_at          timestamptz,
  escalado_ia_at         timestamptz,
  escalado_ia_motivo     text,
  reunion_at             timestamptz,
  motivo                 text,
  motivo_texto           text,
  prioridad              int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT c.*
  FROM public.vendedor_cola_calc(_tz) c
  WHERE (
      NULLIF(btrim(coalesce(_q, '')), '') IS NULL
      OR c.nombre   ILIKE '%' || btrim(_q) || '%'
      OR c.email    ILIKE '%' || btrim(_q) || '%'
      OR c.telefono ILIKE '%' || btrim(_q) || '%'
    )
    AND (
      NULLIF(btrim(coalesce(_pais, '')), '') IS NULL
      OR _pais = 'all'
      -- "Sin pais" agrupa los leads que llegaron sin ese dato.
      OR (_pais = 'Sin pais' AND coalesce(btrim(c.pais), '') = '')
      OR btrim(c.pais) = btrim(_pais)
    )
    AND (
      NULLIF(btrim(coalesce(_motivo, '')), '') IS NULL
      OR _motivo = 'all'
      OR c.motivo = _motivo
    )
  LIMIT greatest(1, least(_limite, 500));
$fn$;

REVOKE EXECUTE ON FUNCTION public.vendedor_cola_hoy(text, int, text, text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendedor_cola_hoy(text, int, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.vendedor_cola_hoy(text, int, text, text, text) IS
  'Cola de trabajo priorizada del vendedor, con busqueda por texto, pais y motivo aplicados del lado del servidor.';

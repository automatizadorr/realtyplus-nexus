-- =====================================================================
-- "Buscar Leads" para el VENDEDOR: mismas tablas/mini-CRM que el admin
-- (prospeccion_busquedas/prospeccion_leads), pero con un motor gratuito
-- (SerpApi + NVIDIA NIM, edge function buscar-leads-vendedor) en vez de
-- Perplexity. El vendedor solo ve y gestiona SUS propias búsquedas/leads.
-- =====================================================================

-- Columna para saber con qué motor se hizo cada búsqueda (informativo).
ALTER TABLE public.prospeccion_busquedas
  ADD COLUMN IF NOT EXISTS motor text NOT NULL DEFAULT 'perplexity';

-- ---------------------------------------------------------------------
-- RLS: el vendedor activo lee/actualiza/borra SOLO lo que creó él mismo.
-- (Las inserciones las hace la Edge Function con service_role, como ya
-- pasa con el admin.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendedor lee sus prospeccion_busquedas" ON public.prospeccion_busquedas;
CREATE POLICY "Vendedor lee sus prospeccion_busquedas"
  ON public.prospeccion_busquedas FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Vendedor borra sus prospeccion_busquedas" ON public.prospeccion_busquedas;
CREATE POLICY "Vendedor borra sus prospeccion_busquedas"
  ON public.prospeccion_busquedas FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Vendedor lee sus prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Vendedor lee sus prospeccion_leads"
  ON public.prospeccion_leads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Vendedor actualiza sus prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Vendedor actualiza sus prospeccion_leads"
  ON public.prospeccion_leads FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND creado_por = auth.uid()
  )
  WITH CHECK (creado_por = auth.uid());

DROP POLICY IF EXISTS "Vendedor borra sus prospeccion_leads" ON public.prospeccion_leads;
CREATE POLICY "Vendedor borra sus prospeccion_leads"
  ON public.prospeccion_leads FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND creado_por = auth.uid()
  );

-- ---------------------------------------------------------------------
-- prospeccion_historial(): antes solo admin (veía TODAS las búsquedas);
-- ahora el vendedor también puede llamarla, pero acotada a las suyas.
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
     OR (
          public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
          AND b.creado_por = auth.uid()
        )
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.prospeccion_historial() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.prospeccion_historial() TO authenticated, service_role;

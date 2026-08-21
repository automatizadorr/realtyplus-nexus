-- =====================================================================
-- Mario pidió devolver a la bandeja los leads que quedaron "liberados"
-- por el backfill de la Fase 8 (todos siguen en etapa_venta='nuevo': nadie
-- alcanzó a contactarlos todavía, así que corresponde que pasen por la
-- bandeja de primer contacto en vez de acumularse en el Pipeline).
--
-- Se hace en lotes de 30 (con una pausa corta entre lote y lote) para no
-- tomar un lock largo sobre miles de filas de golpe mientras el sistema
-- está en uso.
-- =====================================================================
DO $$
DECLARE
  _n int;
BEGIN
  LOOP
    UPDATE public.leads_campana
    SET primer_contacto_at = NULL
    WHERE id IN (
      SELECT id FROM public.leads_campana
      WHERE vendedor_id IS NOT NULL
        AND primer_contacto_at IS NOT NULL
        AND etapa_venta = 'nuevo'
      LIMIT 30
    );
    GET DIAGNOSTICS _n = ROW_COUNT;
    EXIT WHEN _n = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

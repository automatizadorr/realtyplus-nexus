-- =====================================================================
-- Mario pidió "eliminar los leads de la pipeline" — aclarado por
-- AskUserQuestion: DESASIGNAR (quitar vendedor_id), no borrar los leads.
-- Vuelven al pool general de leads_campana sin vendedor, listos para
-- reasignarse desde /vendedores cuando se quiera.
--
-- Se hace en lotes de 30 (con pausa corta entre lote y lote), mismo
-- patrón que la migración anterior, para no tomar un lock largo con el
-- sistema en uso.
-- =====================================================================
DO $$
DECLARE
  _n int;
BEGIN
  LOOP
    -- etapa_venta es NOT NULL en el esquema; se deja tal cual (todas estas
    -- filas ya están en 'nuevo', que es el mismo valor que toma un lead
    -- recién asignado, así que no hace falta tocarla).
    UPDATE public.leads_campana
    SET vendedor_id = NULL,
        fecha_asignacion = NULL,
        fecha_cierre = NULL,
        motivo_cierre = NULL,
        fecha_proximo_contacto = NULL,
        primer_contacto_at = NULL
    WHERE id IN (
      SELECT id FROM public.leads_campana
      WHERE vendedor_id IS NOT NULL
      LIMIT 30
    );
    GET DIAGNOSTICS _n = ROW_COUNT;
    EXIT WHEN _n = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

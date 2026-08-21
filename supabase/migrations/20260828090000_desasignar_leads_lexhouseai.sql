-- =====================================================================
-- Mario hizo una prueba (probablemente "Enviar lote a vendedor" con
-- "Todos los filtrados") que terminó asignando el pool completo de leads
-- a la cuenta de prueba lexhouseai@gmail.com. Se desasignan (no se
-- borran) esos leads, mismo patrón de lotes de 30 + pausa corta.
-- =====================================================================
DO $$
DECLARE
  _n int;
  _vendedor_id uuid;
BEGIN
  SELECT v.user_id INTO _vendedor_id
  FROM public.vendedores v
  JOIN auth.users u ON u.id = v.user_id
  WHERE u.email = 'lexhouseai@gmail.com';

  IF _vendedor_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el vendedor lexhouseai@gmail.com';
  END IF;

  LOOP
    UPDATE public.leads_campana
    SET vendedor_id = NULL,
        fecha_asignacion = NULL,
        fecha_cierre = NULL,
        motivo_cierre = NULL,
        fecha_proximo_contacto = NULL,
        primer_contacto_at = NULL
    WHERE id IN (
      SELECT id FROM public.leads_campana
      WHERE vendedor_id = _vendedor_id
      LIMIT 30
    );
    GET DIAGNOSTICS _n = ROW_COUNT;
    EXIT WHEN _n = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

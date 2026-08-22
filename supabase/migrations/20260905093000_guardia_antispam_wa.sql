-- ============================================================
-- Guardia anti-spam en la cola de WhatsApp (2026-09-05)
--
-- Devuelve los números a los que YA se les mandó un WhatsApp desde el CRM,
-- normalizados a los últimos 9 dígitos (mismo criterio que el dedupe de
-- leads_campana), junto con el lead desde el que se mandó.
--
-- El frontend la usa para saltar un lead cuando el MISMO número ya fue
-- contactado desde OTRO lead (el caso del duplicado con otro nombre). Volver a
-- escribirle al mismo lead sigue permitido: eso es seguimiento, no spam.
--
-- SECURITY DEFINER porque un vendedor solo ve sus propias filas de
-- contactos_log, y el duplicado puede estar en manos de otro vendedor.
-- Es un dato mínimo (teléfono normalizado + lead_id), sin mensajes ni nombres.
-- ============================================================
CREATE OR REPLACE FUNCTION public.telefonos_contactados_wa()
RETURNS TABLE (tel_norm text, lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    CASE WHEN length(x.d) >= 9 THEN right(x.d, 9) ELSE x.d END AS tel_norm,
    x.lead_id
  FROM (
    SELECT c.lead_id,
           regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g') AS d
    FROM public.contactos_log c
    JOIN public.leads_campana l ON l.id = c.lead_id
    WHERE c.canal = 'whatsapp'
  ) x
  WHERE x.d <> '';
$$;

REVOKE ALL ON FUNCTION public.telefonos_contactados_wa() FROM public;
GRANT EXECUTE ON FUNCTION public.telefonos_contactados_wa() TO authenticated;

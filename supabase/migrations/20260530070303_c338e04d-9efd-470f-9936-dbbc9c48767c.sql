
-- 1) Tighten auto_insert policy on mensajes_automatizacion: require admin
DROP POLICY IF EXISTS "auto_insert" ON public.mensajes_automatizacion;
REVOKE INSERT ON public.mensajes_automatizacion FROM anon;

CREATE POLICY "Admins insert auto messages"
ON public.mensajes_automatizacion
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Make vista_inbox_automatizacion run with caller's privileges (not definer)
ALTER VIEW public.vista_inbox_automatizacion SET (security_invoker = true);

-- 3) Fix mutable search_path on set_updated_at function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

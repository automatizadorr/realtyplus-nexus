
DROP POLICY IF EXISTS auto_select ON public.mensajes_automatizacion;
DROP POLICY IF EXISTS auto_update ON public.mensajes_automatizacion;

CREATE POLICY "Admins read auto messages"
ON public.mensajes_automatizacion
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update auto messages"
ON public.mensajes_automatizacion
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete auto messages"
ON public.mensajes_automatizacion
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

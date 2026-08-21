-- =====================================================================
-- El vendedor ahora puede editar también las plantillas COMPARTIDAS
-- (creadas por el admin o sin dueño), no solo las suyas propias. Sigue
-- sin poder BORRAR las compartidas (eso se deja solo al dueño/admin,
-- para que un vendedor no le borre una plantilla a todo el equipo).
-- =====================================================================

DROP POLICY IF EXISTS "Vendedor edita sus plantillas_whatsapp" ON public.plantillas_whatsapp;
CREATE POLICY "Vendedor edita plantillas_whatsapp propias y compartidas"
  ON public.plantillas_whatsapp FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (creado_por = auth.uid() OR creado_por IS NULL OR public.has_role(creado_por, 'admin'))
  )
  WITH CHECK (
    creado_por = auth.uid() OR creado_por IS NULL OR public.has_role(creado_por, 'admin')
  );

DROP POLICY IF EXISTS "Vendedor edita sus plantillas_email" ON public.plantillas_email;
CREATE POLICY "Vendedor edita plantillas_email propias y compartidas"
  ON public.plantillas_email FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'vendedor') AND public.vendedor_activo(auth.uid())
    AND (creado_por = auth.uid() OR creado_por IS NULL OR public.has_role(creado_por, 'admin'))
  )
  WITH CHECK (
    creado_por = auth.uid() OR creado_por IS NULL OR public.has_role(creado_por, 'admin')
  );

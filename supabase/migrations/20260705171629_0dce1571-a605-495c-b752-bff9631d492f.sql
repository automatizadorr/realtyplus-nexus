
-- Set search_path on protect_permanent_tags
CREATE OR REPLACE FUNCTION public.protect_permanent_tags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.es_permanente THEN
        RAISE EXCEPTION 'No se puede borrar la etiqueta permanente "%".', OLD.nombre;
      END IF;
      RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.es_permanente AND (NEW.nombre <> OLD.nombre OR NEW.es_permanente = false) THEN
        RAISE EXCEPTION 'No se puede renombrar ni desproteger la etiqueta permanente "%".', OLD.nombre;
      END IF;
      RETURN NEW;
    END IF;
    RETURN NEW;
  END;
  $function$;

-- Revoke anon EXECUTE on SECURITY DEFINER complete_onboarding; only authenticated users need it
REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

-- Drop broad public SELECT policy on avatars (public bucket downloads still work via public URL)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- Restrict reportes bucket access: only admins can read/write
CREATE POLICY "Admins read reportes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload reportes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update reportes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete reportes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reportes' AND public.has_role(auth.uid(), 'admin'));

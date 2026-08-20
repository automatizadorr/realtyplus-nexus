-- =====================================================================
-- Soporte para la seccion de admin "Vendedores": listar con email
-- (auth.users no es accesible via REST normal) y dar de alta a alguien
-- que YA tiene cuenta (self-signup) como vendedor, sin SQL manual.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_listar_vendedores()
RETURNS TABLE (
  user_id             uuid,
  email               text,
  nombre_display      text,
  telefono_contacto   text,
  activo              boolean,
  rol_venta           text,
  limite_mensajes_dia int,
  paises              text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.user_id, u.email, v.nombre_display, v.telefono_contacto, v.activo, v.rol_venta, v.limite_mensajes_dia,
    coalesce(array_agg(vp.pais ORDER BY vp.pais) FILTER (WHERE vp.pais IS NOT NULL), '{}')
  FROM public.vendedores v
  JOIN auth.users u ON u.id = v.user_id
  LEFT JOIN public.vendedor_paises vp ON vp.user_id = v.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY v.user_id, u.email, v.nombre_display, v.telefono_contacto, v.activo, v.rol_venta, v.limite_mensajes_dia
  ORDER BY u.email;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_listar_vendedores() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_listar_vendedores() TO authenticated;

-- Da de alta como vendedor a un usuario que YA tiene cuenta (self-signup
-- via /auth). Si no existe la cuenta, avisa que debe registrarse primero
-- (no crea cuentas nuevas: eso requiere invitar por Auth Admin API).
CREATE OR REPLACE FUNCTION public.admin_agregar_vendedor(_email text, _rol text DEFAULT 'ambos')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _rol NOT IN ('setter', 'closer', 'ambos') THEN
    RAISE EXCEPTION 'Rol invalido: %', _rol;
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(btrim(_email));
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta con ese email. La persona debe registrarse primero en /auth.';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'vendedor')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.vendedores (user_id, activo, rol_venta, created_by)
    VALUES (_uid, true, _rol, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET activo = true, rol_venta = _rol;

  RETURN _uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_agregar_vendedor(text, text) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_agregar_vendedor(text, text) TO authenticated;

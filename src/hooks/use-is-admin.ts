import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!active) return;
        setIsAdmin(!!data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // Dependemos del user.id (estable), NO del objeto `user`: al volver el foco a la
    // pestaña, Supabase refresca el token y crea un nuevo objeto `user` con el MISMO id.
    // Si dependiéramos de `user`, el efecto se re-ejecutaría, AdminRoute mostraría su
    // spinner y DESMONTARÍA la página → se perderían los datos escritos. Con user.id el
    // re-chequeo solo ocurre en login/logout reales.
  }, [user?.id]);

  return { isAdmin, loading };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "sub_admin" | null;

interface UseRoleResult {
  role: AppRole;
  isAdmin: boolean;
  isSubAdmin: boolean;
  /** true para admin Y sub_admin (puede ver datos del CRM) */
  hasCrmAccess: boolean;
  /** true solo para admin (puede enviar, borrar, disparar webhooks) */
  canWrite: boolean;
  loading: boolean;
}

export function useRole(): UseRoleResult {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "sub_admin"])
      .maybeSingle()
      .then(({ data }: { data: { role: string } | null }) => {
        if (!active) return;
        setRole((data?.role as AppRole) ?? null);
        setLoading(false);
      });
    return () => { active = false; };
    // Depende de user.id (estable al refrescar token): evita remontar páginas
    // al volver el foco a la pestaña. Ver use-is-admin.ts para contexto.
  }, [user?.id]);

  const isAdmin = role === "admin";
  const isSubAdmin = role === "sub_admin";
  return {
    role,
    isAdmin,
    isSubAdmin,
    hasCrmAccess: isAdmin || isSubAdmin,
    canWrite: isAdmin,
    loading,
  };
}

/** Alias de compatibilidad para los componentes que ya usan useIsAdmin() */
export function useIsAdmin() {
  const { isAdmin, loading } = useRole();
  return { isAdmin, loading };
}

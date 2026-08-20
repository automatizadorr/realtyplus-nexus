import { useEffect, useState } from "react";
import { getSupabase } from "@/integrations/supabase/lazy";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "sub_admin" | "vendedor" | null;

interface UseRoleResult {
  role: AppRole;
  isAdmin: boolean;
  isSubAdmin: boolean;
  /** true para el rol vendedor (acceso acotado a leads en_campana de sus países) */
  isVendedor: boolean;
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
    getSupabase().then((supabase) => {
      if (!active) return;
      (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "sub_admin", "vendedor"])
        .maybeSingle()
        .then(({ data }: { data: { role: string } | null }) => {
          if (!active) return;
          setRole((data?.role as AppRole) ?? null);
          setLoading(false);
        });
    });
    return () => { active = false; };
    // Depende de user.id (estable al refrescar token): evita remontar páginas
    // al volver el foco a la pestaña. Ver use-is-admin.ts para contexto.
  }, [user?.id]);

  const isAdmin = role === "admin";
  const isSubAdmin = role === "sub_admin";
  const isVendedor = role === "vendedor";
  return {
    role,
    isAdmin,
    isSubAdmin,
    isVendedor,
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

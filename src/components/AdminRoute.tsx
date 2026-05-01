import { useIsAdmin } from "@/hooks/use-is-admin";
import { Navigate } from "react-router-dom";
import { Lock } from "lucide-react";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Esta sección está disponible únicamente para administradores de Realtyplus.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

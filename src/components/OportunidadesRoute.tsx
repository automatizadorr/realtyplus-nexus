import { useRole } from "@/hooks/use-is-admin";
import { Lock } from "lucide-react";

// "Mensajes · Oportunidades" / "Panel de Oportunidades": admin, sub_admin
// (ven todo, vía las políticas ya existentes), o vendedor (ve solo sus
// propios leads, vía las políticas de vendedor_ve_telefono).
export function OportunidadesRoute({ children }: { children: React.ReactNode }) {
  const { hasCrmAccess, isVendedor, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasCrmAccess && !isVendedor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Esta sección está disponible únicamente para el equipo de NexusPlus-AI.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

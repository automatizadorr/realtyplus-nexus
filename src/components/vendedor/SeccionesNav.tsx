import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Inbox, Kanban, RotateCcw, Radar, FileText, Palette, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Mismas secciones que el sidebar del vendedor, pero dentro de la página.
// El sidebar se colapsa en móvil y obliga a salir del contexto en escritorio;
// esta barra deja el flujo completo (Bandeja → Pipeline → herramientas) a un
// clic desde cualquier punto.
const SECCIONES = [
  { url: "/mis-leads/bandeja", label: "Bandeja", icon: Inbox, badge: "bandeja" as const },
  { url: "/mis-leads/pipeline", label: "Pipeline", icon: Kanban },
  { url: "/mis-leads/buscar-leads", label: "Buscar Leads", icon: Radar },
  { url: "/mis-leads/reactivacion", label: "Leads DataBase", icon: RotateCcw },
  { url: "/mis-leads/plantillas", label: "Mis Plantillas", icon: FileText },
  { url: "/mis-leads/diseno-correo", label: "Diseño de Correo", icon: Palette },
  { url: "/mis-leads/estadisticas", label: "Estadísticas", icon: PieChart },
];

export default function SeccionesNav() {
  const [enBandeja, setEnBandeja] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase.rpc("vendedor_bandeja_count").then(({ data }: { data: number | null }) => {
      if (vivo && typeof data === "number") setEnBandeja(data);
    });
    return () => { vivo = false; };
  }, []);

  return (
    <nav aria-label="Secciones de ventas" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {SECCIONES.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.url}>
              <NavLink
                to={s.url}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-[#003DA5] bg-[#003DA5] text-white"
                      : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                    {s.badge === "bandeja" && enBandeja !== null && enBandeja > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] ${isActive ? "bg-white/20" : "bg-[#003DA5]/15 text-[#003DA5]"}`}>
                        {enBandeja > 99 ? "99+" : enBandeja}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

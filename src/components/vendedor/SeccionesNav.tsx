import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Inbox, Kanban, RotateCcw, Radar, FileText, Palette, PieChart, CalendarDays, Flame, MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tzNavegador, type ColaResumen } from "@/components/vendedor/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ---------------------------------------------------------------------
// Solo el trabajo diario ocupa lugar en la barra.
//
// Antes había ocho secciones al mismo nivel y ninguna decía por dónde
// empezar. Ahora la barra tiene el ciclo completo -- Hoy (a quién tocar),
// Pipeline (cómo va el embudo), Agenda (reuniones) y Buscar Leads (de
// dónde salen los nuevos) -- y todo lo que se configura una vez y no se
// vuelve a mirar vive detrás de "Más".
// ---------------------------------------------------------------------
const PRINCIPALES = [
  { url: "/mis-leads/hoy", label: "Hoy", icon: Flame, badge: true },
  { url: "/mis-leads/pipeline", label: "Pipeline", icon: Kanban },
  { url: "/mis-leads/agenda", label: "Agenda", icon: CalendarDays },
  { url: "/mis-leads/buscar-leads", label: "Buscar Leads", icon: Radar },
];

const SECUNDARIAS = [
  // La Bandeja sigue existiendo para los envíos en tanda (elegir 25 leads y
  // mandarles la misma plantilla). El seguimiento uno a uno ya lo cubre Hoy.
  { url: "/mis-leads/bandeja", label: "Bandeja (envíos en tanda)", icon: Inbox },
  { url: "/mis-leads/reactivacion", label: "Leads DataBase", icon: RotateCcw },
  { url: "/mis-leads/plantillas", label: "Mis Plantillas", icon: FileText },
  { url: "/mis-leads/diseno-correo", label: "Diseño de Correo", icon: Palette },
  { url: "/mis-leads/estadisticas", label: "Estadísticas", icon: PieChart },
];

const chip = (activo: boolean) =>
  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    activo ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;

export default function SeccionesNav() {
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [urgentes, setUrgentes] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    let vivo = true;
    sb.rpc("vendedor_cola_resumen", { _tz: tzNavegador() }).then(({ data }: { data: ColaResumen[] | null }) => {
      const r = (data ?? [])[0];
      if (!vivo || !r) return;
      setPendientes(r.total);
      setUrgentes(r.urgentes);
    });
    return () => { vivo = false; };
  }, [pathname]);

  const enSecundaria = SECUNDARIAS.some((s) => pathname.startsWith(s.url));

  return (
    <nav aria-label="Secciones de ventas" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max items-center gap-1 px-1">
        {PRINCIPALES.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.url}>
              <NavLink to={s.url} className={({ isActive }) => chip(isActive)}>
                {({ isActive }) => (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                    {s.badge && pendientes !== null && pendientes > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] ${
                        isActive ? "bg-white/20"
                        : urgentes > 0 ? "bg-red-500/15 text-red-600"
                        : "bg-[#003DA5]/15 text-[#003DA5]"
                      }`}>
                        {pendientes > 99 ? "99+" : pendientes}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}

        <li>
          <DropdownMenu>
            <DropdownMenuTrigger className={chip(enSecundaria)}>
              <MoreHorizontal className="h-3.5 w-3.5" /> Más
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {SECUNDARIAS.map((s) => {
                const Icon = s.icon;
                return (
                  <DropdownMenuItem key={s.url} asChild>
                    <NavLink to={s.url} className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4" /> {s.label}
                    </NavLink>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}

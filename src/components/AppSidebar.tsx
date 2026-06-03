import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, Bot, Zap, Tag, Settings2, LogOut, Building2, ChevronRight } from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type BadgeVariant = "new" | "ai" | "hot" | "pro" | "live" | "beta";
type NavBadgeT = { text: string; variant: BadgeVariant };

const groups: {
  label?: string;
  sublabel?: string;
  items: { title: string; url: string; icon: React.ElementType; badge?: NavBadgeT }[];
}[] = [
  {
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: { text: "Live", variant: "live" } },
    ],
  },
  {
    label: "Oportunidades",
    sublabel: "Captación y análisis",
    items: [
      { title: "Scanner de Leads",       url: "/scanner",          icon: ScanSearch, badge: { text: "New", variant: "new" } },
      { title: "Mensajes Activos",        url: "/automation-inbox", icon: Zap,        badge: { text: "AI",  variant: "ai"  } },
      { title: "Panel de Oportunidades", url: "/automation",       icon: Bot,        badge: { text: "Pro", variant: "pro" } },
    ],
  },
  {
    label: "Reactivación",
    sublabel: "Seguimiento y cierre",
    items: [
      { title: "Campañas IA",       url: "/campaigns", icon: Megaphone,     badge: { text: "AI",   variant: "ai"   } },
      { title: "Bandeja de Entrada", url: "/inbox",     icon: MessageSquare, badge: { text: "Hot",  variant: "hot"  } },
      { title: "Leads Etiquetados", url: "/tagged",    icon: Tag,           badge: { text: "Beta", variant: "beta" } },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración", url: "/settings", icon: Settings2 },
    ],
  },
];

function NavBadge({ badge }: { badge: NavBadgeT }) {
  // ── Dot de estado: live / hot ──────────────────────────────────────────
  // Solo un punto animado. Sin caja, sin texto. Señal de actividad.
  if (badge.variant === "live") {
    return (
      <span className="ml-auto relative flex h-2 w-2 shrink-0">
        <motion.span
          animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
    );
  }

  if (badge.variant === "hot") {
    return (
      <span className="ml-auto relative flex h-2 w-2 shrink-0">
        <motion.span
          animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute inline-flex h-full w-full rounded-full bg-orange-400"
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
      </span>
    );
  }

  // ── Ghost pill: new / beta ─────────────────────────────────────────────
  // Outline ultrafino, sin relleno. No compite con el contenido.
  if (badge.variant === "new") {
    return (
      <span className="ml-auto inline-flex items-center px-1.5 py-px rounded-sm border border-emerald-500/40 text-[8px] font-semibold tracking-[0.12em] uppercase text-emerald-400/70">
        New
      </span>
    );
  }

  if (badge.variant === "beta") {
    return (
      <span className="ml-auto inline-flex items-center px-1.5 py-px rounded-sm border border-white/15 text-[8px] font-semibold tracking-[0.12em] uppercase text-white/30">
        Beta
      </span>
    );
  }

  // ── Gradient pill: ai / pro ────────────────────────────────────────────
  // Gradiente sutil con glow mínimo. Denota features premium.
  if (badge.variant === "ai") {
    return (
      <span className="ml-auto inline-flex items-center gap-1 px-2 py-px rounded-sm bg-gradient-to-r from-violet-600/30 to-blue-600/30 border border-violet-500/20 text-[8px] font-bold tracking-[0.1em] uppercase text-violet-300/80 shadow-[0_0_6px_rgba(124,58,237,0.15)]">
        AI
      </span>
    );
  }

  if (badge.variant === "pro") {
    return (
      <span className="ml-auto inline-flex items-center px-2 py-px rounded-sm bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border border-amber-500/20 text-[8px] font-bold tracking-[0.1em] uppercase text-amber-300/80 shadow-[0_0_6px_rgba(245,158,11,0.12)]">
        Pro
      </span>
    );
  }

  return null;
}

export function AppSidebar() {
  const { setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
    else toggleSidebar();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <div className="flex flex-col h-full bg-[#080d1a] bg-[radial-gradient(ellipse_at_top_left,_rgba(124,58,237,0.08)_0%,_transparent_60%)]">

        {/* ── Logo ────────────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-md bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-violet-400" />
            </div>
            <img
              src={realtyplusLogo}
              alt="RealtyPlus"
              className="h-7 w-auto object-contain"
            />
          </div>
          <p className="text-[10px] text-white/25 font-medium tracking-[0.15em] uppercase pl-11">
            Intelligence Platform
          </p>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent mb-3" />

        {/* ── Nav ─────────────────────────────────────────────────── */}
        <SidebarContent className="px-3 flex-1 overflow-y-auto scrollbar-none">
          {groups.map((group, gIdx) => (
            <div key={group.label || `g-${gIdx}`} className="mb-1">
              {group.label && (
                <div className="px-2 pt-4 pb-1.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/30">
                    {group.label}
                  </p>
                  {group.sublabel && (
                    <p className="text-[8.5px] text-white/18 mt-0.5 tracking-wide">
                      {group.sublabel}
                    </p>
                  )}
                </div>
              )}
              <SidebarMenu>
                {group.items.map((item, index) => {
                  const isActive =
                    item.url === "/dashboard"
                      ? location.pathname === "/dashboard"
                      : location.pathname.startsWith(item.url);

                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.25 }}
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === "/dashboard"}
                            onClick={handleNavClick}
                            className={[
                              "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                              "text-white/45 hover:text-white/80 hover:bg-white/5",
                            ].join(" ")}
                            activeClassName="!text-white !bg-violet-500/12 hover:!bg-violet-500/15"
                          >
                            {/* Active left accent */}
                            <AnimatePresence>
                              {isActive && (
                                <motion.div
                                  layoutId="sidebar-active"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-violet-400"
                                  initial={{ opacity: 0, scaleY: 0 }}
                                  animate={{ opacity: 1, scaleY: 1 }}
                                  exit={{ opacity: 0, scaleY: 0 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                />
                              )}
                            </AnimatePresence>

                            {/* Icon */}
                            <item.icon
                              className={[
                                "h-[15px] w-[15px] shrink-0 transition-colors duration-200",
                                isActive ? "text-violet-400" : "text-white/35 group-hover:text-white/60",
                              ].join(" ")}
                            />

                            {/* Title */}
                            <span className={[
                              "flex-1 truncate font-medium transition-colors duration-200 text-[13px]",
                              isActive ? "text-white" : "",
                            ].join(" ")}>
                              {item.title}
                            </span>

                            {/* Badge */}
                            {item.badge && <NavBadge badge={item.badge} />}

                            {/* Arrow on hover */}
                            <ChevronRight className="h-3 w-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </SidebarContent>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <SidebarFooter className="p-0">
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div className="p-4 flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold ring-2 ring-violet-500/30">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#080d1a]" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/80 truncate">{displayName}</p>
              <p className="text-[10px] text-white/30 tracking-wide">Administrador</p>
            </div>

            {/* Logout */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={signOut}
              className="p-1.5 rounded-md text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </SidebarFooter>

      </div>
    </Sidebar>
  );
}

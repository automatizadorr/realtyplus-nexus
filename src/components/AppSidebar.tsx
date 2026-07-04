import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, Bot, Zap, Tag, Settings2, LogOut, Mic, ShieldCheck, User } from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const groups: { label?: string; items: { title: string; url: string; icon: React.ElementType }[] }[] = [
  {
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Campañas · Leads IA", url: "/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Oportunidades",
    items: [
      { title: "Escáner · Leads Nuevos", url: "/scanner", icon: ScanSearch },
      { title: "Mensajes · Oportunidades", url: "/automation-inbox", icon: Zap },
      { title: "Panel de Oportunidades", url: "/automation", icon: Bot },
    ],
  },
  {
    label: "Reactivación",
    items: [
      { title: "Mensajes · Reactivación", url: "/inbox", icon: MessageSquare },
      { title: "Expansión", url: "/tagged", icon: Tag },
      { title: "Etiquetas IA", url: "/etiquetas", icon: Tag },
    ],
  },
  {
    label: "CRM Realty Web-AI",
    items: [
      { title: "CRM Realty Web-AI", url: "/voice-crm", icon: Mic },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración", url: "/settings", icon: Settings2 },
    ],
  },
];

// Transición compartida del indicador activo (se desliza entre ítems).
const ACTIVE_SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

function AnimatedIcon({ icon: Icon, isActive }: { icon: React.ElementType; isActive: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
      className="relative z-10 shrink-0"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} />
    </motion.div>
  );
}

export function AppSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  const handleNavClick = () => {
    // En móvil cerramos el drawer; en desktop el rail se colapsa solo al salir el mouse.
    if (isMobile) setOpenMobile(false);
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-gradient-to-b from-white/[0.03] to-black/10">
        <div className="p-4 group-data-[collapsible=icon]:p-2">
          {/* Logo completo — modo expandido */}
          <motion.div
            whileHover={{ scale: 1.04, rotate: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="bg-white rounded-xl p-3 shadow-md w-full flex items-center justify-center overflow-hidden group group-data-[collapsible=icon]:hidden"
          >
            <motion.img
              src={realtyplusLogo}
              alt="Realtyplus - Servicios Inmobiliarios"
              className="w-full h-auto max-h-16 object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </motion.div>
          {/* Marca compacta — modo rail de íconos */}
          <div className="hidden group-data-[collapsible=icon]:flex aspect-square w-full items-center justify-center rounded-xl bg-white shadow-md">
            <span className="text-sm font-extrabold leading-none tracking-tight" style={{ color: "hsl(210 100% 20%)" }}>
              R<span style={{ color: "hsl(0 100% 40%)" }}>P</span>
            </span>
          </div>
          {/* Firma de marca */}
          <div className="mt-3.5 flex items-center justify-center gap-2.5 group-data-[collapsible=icon]:hidden" aria-hidden="true">
            <span className="h-px flex-1 bg-sidebar-border/70" />
            <span className="font-mono text-[9px] font-medium tracking-[0.34em] uppercase text-sidebar-foreground/45">
              Nexus CRM
            </span>
            <span className="h-px flex-1 bg-sidebar-border/70" />
          </div>
        </div>

        {groups.map((group, gIdx) => (
          <SidebarGroup key={group.label || `g-${gIdx}`}>
            {group.label && (
              <SidebarGroupLabel className="px-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/40">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item, index) => {
                  const isActive =
                    item.url === "/dashboard"
                      ? location.pathname === "/dashboard"
                      : location.pathname.startsWith(item.url);

                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, type: "spring", stiffness: 320, damping: 26 }}
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink
                            to={item.url}
                            end={item.url === "/dashboard"}
                            className="group/nav relative rounded-lg tracking-tight transition-colors"
                            activeClassName="text-sidebar-accent-foreground font-semibold"
                            onClick={handleNavClick}
                          >
                            {/* Fondo activo que se desliza entre ítems */}
                            {isActive && (
                              <motion.span
                                layoutId="sidebar-active-bg"
                                transition={ACTIVE_SPRING}
                                className="absolute inset-0 rounded-lg bg-sidebar-accent/80 shadow-sm"
                              />
                            )}
                            {/* Barra de acento a la izquierda */}
                            {isActive && (
                              <motion.span
                                layoutId="sidebar-active-bar"
                                transition={ACTIVE_SPRING}
                                className="absolute left-0 top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
                              />
                            )}
                            <AnimatedIcon icon={item.icon} isActive={isActive} />
                            <span className="relative z-10 ml-2 truncate text-[13px]">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>


      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          {/* Avatar — el anillo cambia de color según el rol (señal también en el rail) */}
          <div
            className={`relative w-8 h-8 rounded-full bg-sidebar-primary/20 ring-1 flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shrink-0 transition-colors ${
              isAdmin ? "ring-sidebar-primary/70" : "ring-sidebar-border"
            }`}
          >
            {displayName.charAt(0).toUpperCase()}
            {/* Insignia de rol sobre el avatar — visible también con el rail colapsado */}
            {!roleLoading && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-sidebar ${
                  isAdmin ? "bg-sidebar-primary text-white" : "bg-sidebar-accent text-sidebar-foreground"
                }`}
              >
                {isAdmin ? <ShieldCheck className="h-2 w-2" /> : <User className="h-2 w-2" />}
              </span>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sidebar-foreground truncate tracking-tight">
                {displayName}
              </span>
              {!roleLoading && (
                <span
                  className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase leading-none tracking-wider ${
                    isAdmin
                      ? "bg-sidebar-primary/25 text-sidebar-primary-foreground ring-1 ring-sidebar-primary/40"
                      : "bg-sidebar-accent/60 text-sidebar-foreground/70"
                  }`}
                >
                  {isAdmin ? "Admin" : "Agente"}
                </span>
              )}
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
              onClick={signOut}
              className="mt-0.5 flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-sidebar-foreground/55 hover:text-destructive transition-colors text-left"
            >
              <LogOut className="h-3 w-3" />
              Cerrar sesión
            </motion.button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

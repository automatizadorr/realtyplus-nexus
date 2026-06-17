import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, Bot, Zap, Tag, Settings2, LogOut, Mic } from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

type NavBadgeT = { text: string; variant: "new" | "ai" | "hot" | "pro" | "live" | "beta" };

const groups: { label?: string; items: { title: string; url: string; icon: React.ElementType; badge?: NavBadgeT }[] }[] = [
  {
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: { text: "Live", variant: "live" } },
      { title: "Campañas - Leads IA", url: "/campaigns", icon: Megaphone, badge: { text: "AI", variant: "ai" } },
    ],
  },
  {
    label: "Oportunidades",
    items: [
      { title: "Escáner- Leads News", url: "/scanner", icon: ScanSearch, badge: { text: "New", variant: "new" } },
      { title: "​Mensajes - Oportunidades", url: "/automation-inbox", icon: Zap, badge: { text: "AI", variant: "ai" } },
      { title: "Panel ​Para Oportunidades ", url: "/automation", icon: Bot, badge: { text: "Pro", variant: "pro" } },
    ],
  },
  {
    label: "Reactivación",
    items: [
      { title: "Mensajes - Reactivacion Leads", url: "/inbox", icon: MessageSquare, badge: { text: "Hot", variant: "hot" } },
      { title: "Expansión", url: "/tagged", icon: Tag, badge: { text: "NEXUS", variant: "beta" } },
    ],
  },
  {
    label: "CRM Realty Web-AI",
    items: [
      { title: "CRM Realty Web-AI", url: "/voice-crm", icon: Mic, badge: { text: "New", variant: "new" } },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configuración", url: "/settings", icon: Settings2 },
    ],
  },
];

const badgeStyles: Record<NavBadgeT["variant"], string> = {
  new: "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]",
  ai: "bg-gradient-to-r from-[#cc0000] to-[#ff3344] text-white shadow-[0_0_8px_rgba(204,0,0,0.55)]",
  hot: "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.55)]",
  pro: "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#1a1a1a] shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  live: "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.55)]",
  beta: "bg-gradient-to-r from-sky-400 to-indigo-500 text-white shadow-[0_0_8px_rgba(99,102,241,0.5)]",
};

function NavBadge({ badge }: { badge: NavBadgeT }) {
  const pulseDot = badge.variant === "live" || badge.variant === "hot";
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider leading-none ${badgeStyles[badge.variant]}`}
    >
      {pulseDot && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="w-1 h-1 rounded-full bg-white"
        />
      )}
      {badge.text}
    </motion.span>
  );
}

function AnimatedIcon({ icon: Icon, isActive }: { icon: React.ElementType; isActive: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.2, rotate: 8 }}
      whileTap={{ scale: 0.9 }}
      animate={isActive ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
      className="shrink-0"
    >
      <Icon className="h-4 w-4" />
    </motion.div>
  );
}

export function AppSidebar() {
  const { setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      toggleSidebar();
    }
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Usuario";

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent className="bg-gradient-to-b from-white/[0.03] to-black/10">
        <div className="p-4">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="bg-white rounded-lg p-3 shadow-md w-full flex items-center justify-center overflow-hidden group"
          >
            <motion.img
              src={realtyplusLogo}
              alt="Realtyplus - Servicios Inmobiliarios"
              className="w-full h-auto max-h-16 object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </motion.div>
        </div>

        {groups.map((group, gIdx) => (
          <SidebarGroup key={group.label || `g-${gIdx}`}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
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
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === "/dashboard"}
                            className="relative rounded-md transition-colors hover:bg-sidebar-accent/40"
                            activeClassName="bg-sidebar-accent/80 text-sidebar-accent-foreground font-semibold shadow-sm before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary"
                            onClick={handleNavClick}
                          >
                            <AnimatedIcon icon={item.icon} isActive={isActive} />
                            <span className="ml-2 truncate">{item.title}</span>
                            {item.badge && <NavBadge badge={item.badge} />}
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
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {displayName}
            </span>
            <motion.button
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
              onClick={signOut}
              className="flex items-center gap-1 text-xs text-sidebar-foreground/60 hover:text-destructive transition-colors text-left"
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

import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, Bot, Zap, Tag, Settings2, LogOut } from "lucide-react";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Escáner", url: "/scanner", icon: ScanSearch },
  { title: "Campañas", url: "/campaigns", icon: Megaphone },
  { title: "Mensajes", url: "/inbox", icon: MessageSquare },
  { title: "​Oportunidades calientes", url: "/automation-inbox", icon: Zap },
  { title: "Panel ​Oportunidades calientes", url: "/automation", icon: Bot },
  { title: "Etiquetados leads 99 ", url: "/tagged", icon: Tag },
  { title: "Configuración", url: "/settings", icon: Settings2 },
];

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
      <SidebarContent>
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, index) => {
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
                          className="hover:bg-sidebar-accent/50"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          onClick={handleNavClick}
                        >
                          <AnimatedIcon icon={item.icon} isActive={isActive} />
                          <span className="ml-2">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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

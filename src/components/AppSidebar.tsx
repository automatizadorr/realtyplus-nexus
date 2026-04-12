import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, LogOut } from "lucide-react";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Escáner", url: "/scanner", icon: ScanSearch },
  { title: "Campañas", url: "/campaigns", icon: Megaphone },
  { title: "Mensajes", url: "/inbox", icon: MessageSquare },
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
        <div className="p-4 flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0"
          >
            R+
          </motion.div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sidebar-foreground">Realtyplus</span>
            <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Hub Inmobiliario</span>
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, index) => {
                const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
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
                          end={item.url === "/"}
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
            <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
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

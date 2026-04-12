import { LayoutDashboard, ScanSearch, Megaphone, MessageSquare, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
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
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
            R+
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-sidebar-foreground">Realtyplus</span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Hub Inmobiliario</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-1 text-xs text-sidebar-foreground/60 hover:text-destructive transition-colors text-left"
              >
                <LogOut className="h-3 w-3" />
                Cerrar sesión
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={signOut} title="Cerrar sesión" className="sr-only">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

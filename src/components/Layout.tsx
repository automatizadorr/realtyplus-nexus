import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface LayoutProps {
  children: React.ReactNode;
}

function HoverEdge() {
  const { setOpen, open, isMobile } = useSidebar();
  if (isMobile) return null;
  return (
    <div
      onMouseEnter={() => !open && setOpen(true)}
      className="fixed left-0 top-0 h-screen w-2 z-40"
      aria-hidden
    />
  );
}

function SidebarHoverWrapper() {
  const { setOpen, isMobile } = useSidebar();
  return (
    <div onMouseLeave={() => !isMobile && setOpen(false)}>
      <AppSidebar />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <HoverEdge />
        <SidebarHoverWrapper />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold text-foreground">CRM Realtyplus</h1>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

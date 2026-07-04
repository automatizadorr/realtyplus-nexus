import { useRef } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

interface LayoutProps {
  children: React.ReactNode;
}

const CLOSE_DELAY_MS = 300;

function SidebarHoverWrapper({ closeTimerRef }: { closeTimerRef: React.MutableRefObject<number | null> }) {
  const { setOpen, isMobile } = useSidebar();
  return (
    <div
      onMouseEnter={() => {
        if (closeTimerRef.current) {
          window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        // El rail de íconos siempre está visible; al pasar el mouse se expande a texto.
        if (!isMobile) setOpen(true);
      }}
      onMouseLeave={() => {
        if (isMobile) return;
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(() => {
          setOpen(false);
          closeTimerRef.current = null;
        }, CLOSE_DELAY_MS);
      }}
    >
      <AppSidebar />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const closeTimerRef = useRef<number | null>(null);
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <SidebarHoverWrapper closeTimerRef={closeTimerRef} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <img
              src={realtyplusLogo}
              alt="Realtyplus - Servicios Inmobiliarios"
              className="h-10 w-auto object-contain"
            />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

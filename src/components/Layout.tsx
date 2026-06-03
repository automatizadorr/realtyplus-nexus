import { useRef } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

interface LayoutProps {
  children: React.ReactNode;
}

const CLOSE_DELAY_MS = 300;

function HoverEdge({ closeTimerRef }: { closeTimerRef: React.MutableRefObject<number | null> }) {
  const { setOpen, open, isMobile } = useSidebar();
  if (isMobile) return null;
  return (
    <div
      onMouseEnter={() => {
        if (closeTimerRef.current) {
          window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        if (!open) setOpen(true);
      }}
      className="fixed left-0 top-0 h-screen w-2 z-40"
      aria-hidden
    />
  );
}

function SidebarHoverWrapper({ closeTimerRef }: { closeTimerRef: React.MutableRefObject<number | null> }) {
  const { setOpen, isMobile } = useSidebar();
  return (
    <div
      onMouseEnter={() => {
        if (closeTimerRef.current) {
          window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
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
        <HoverEdge closeTimerRef={closeTimerRef} />
        <SidebarHoverWrapper closeTimerRef={closeTimerRef} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-13 flex items-center border-b border-white/5 bg-[#080d1a]/80 backdrop-blur-sm px-4 gap-3">
            <SidebarTrigger className="text-white/40 hover:text-white/70 transition-colors" />
            <div className="w-px h-5 bg-white/10" />
            <img
              src={realtyplusLogo}
              alt="Realtyplus - Servicios Inmobiliarios"
              className="h-7 w-auto object-contain opacity-90"
            />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

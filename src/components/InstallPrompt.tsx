import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rp_install_banner_dismissed_at";
const DISMISS_DAYS = 7;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line|WhatsApp|wv\)/i.test(ua);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile() || isStandalone() || isInAppBrowser()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const days = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    if (isIOS()) {
      setIos(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: show generic banner on Android Chrome even if event hasn't fired yet
    const fallback = window.setTimeout(() => {
      if (!isStandalone()) setVisible(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(fallback);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferred(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:hidden pointer-events-none">
      <div
        className="pointer-events-auto mx-auto max-w-md rounded-2xl shadow-2xl border border-white/10 text-white p-4 flex gap-3 items-start animate-in slide-in-from-bottom-4 duration-300"
        style={{
          background: "linear-gradient(135deg, #0f2b5a 0%, #1a3a72 100%)",
        }}
      >
        <div className="shrink-0 rounded-xl bg-white/15 p-2">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            Instala Realtyplus en tu móvil
          </p>
          {ios ? (
            <p className="text-xs text-white/80 mt-1 leading-snug">
              Toca <Share className="inline h-3.5 w-3.5 -mt-0.5" /> "Compartir"
              y luego <strong>"Añadir a pantalla de inicio"</strong>.
            </p>
          ) : (
            <p className="text-xs text-white/80 mt-1 leading-snug">
              Accede más rápido con un acceso directo desde Chrome.
            </p>
          )}
          {!ios && (
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                onClick={install}
                className="h-8 px-3 text-xs bg-white text-[#0f2b5a] hover:bg-white/90"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {deferred ? "Instalar app" : "Cómo instalar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="h-8 px-3 text-xs text-white hover:bg-white/10"
              >
                Ahora no
              </Button>
            </div>
          )}
          {!deferred && !ios && (
            <p className="text-[10px] text-white/60 mt-2 leading-snug">
              En Chrome: menú ⋮ → "Añadir a pantalla de inicio".
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0 -mt-1 -mr-1 rounded-full p-1 hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Download, Monitor, Smartphone, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rp_install_banner_dismissed_at";
const DISMISS_DAYS = 7;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipod/i.test(navigator.userAgent);
}

function isTablet() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad (incl. iPadOS 13+ which reports as Mac with touch)
  const iPad =
    /ipad/i.test(ua) ||
    (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
  const androidTablet = /android/i.test(ua) && !/mobile/i.test(ua);
  return iPad || androidTablet;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore iOS Safari
    window.navigator.standalone === true
  );
}

function isIOSLike() {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1)
  );
}

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line|WhatsApp|wv\)/i.test(ua);
}

type DeviceKind = "mobile" | "tablet" | "desktop";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [device, setDevice] = useState<DeviceKind>("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mob = isMobile();
    const tab = isTablet();
    setDevice(mob ? "mobile" : tab ? "tablet" : "desktop");

    const checkAndHide = () => {
      if (isStandalone() || isInAppBrowser()) {
        setVisible(false);
        setDeferred(null);
        return true;
      }
      return false;
    };

    // Immediately hide if already installed
    if (checkAndHide()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const days = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    // iOS / iPadOS Safari: no beforeinstallprompt, show manual instructions
    if (isIOSLike()) {
      setIos(true);
      setVisible(true);
      return;
    }

    let fallback: number | undefined;

    const handler = (e: Event) => {
      e.preventDefault();
      if (checkAndHide()) return;
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Hide banner as soon as the app is installed
    const installedHandler = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    // React to display-mode changes (e.g. user opens installed PWA)
    const mql = window.matchMedia?.("(display-mode: standalone)");
    const mediaHandler = (evt: MediaQueryListEvent) => {
      if (evt.matches) {
        setVisible(false);
        setDeferred(null);
      }
    };
    mql?.addEventListener?.("change", mediaHandler);

    // Fallback: show generic banner with instructions after a short delay
    fallback = window.setTimeout(() => {
      if (!isStandalone()) setVisible(true);
    }, 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      if (mql) mql.removeEventListener?.("change", mediaHandler);
      if (fallback) window.clearTimeout(fallback);
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

  const isHandheld = device === "mobile";
  const Icon = isHandheld ? Smartphone : Monitor;
  const title = isHandheld
    ? "Instala NexusPlus-AI en tu móvil"
    : device === "tablet"
    ? "Instala NexusPlus-AI en tu tablet"
    : "Instala NexusPlus-AI en tu PC";

  const manualHint = ios
    ? null
    : device === "desktop"
    ? 'En Chrome/Edge: icono "Instalar" (⊕) en la barra de direcciones, o menú ⋮ → "Instalar NexusPlus-AI".'
    : 'En Chrome: menú ⋮ → "Instalar app" o "Añadir a pantalla de inicio".';

  return (
    <div
      className={`fixed z-[60] p-3 pointer-events-none ${
        isHandheld
          ? "inset-x-0 bottom-0"
          : "bottom-4 left-4 sm:max-w-sm"
      }`}
    >
      <div
        className="pointer-events-auto mx-auto max-w-md rounded-2xl shadow-2xl border border-white/10 text-white p-4 flex gap-3 items-start animate-in slide-in-from-bottom-4 duration-300"
        style={{
          background: "linear-gradient(135deg, #0f2b5a 0%, #1a3a72 100%)",
        }}
      >
        <div className="shrink-0 rounded-xl bg-white/15 p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>

          {ios ? (
            <p className="text-xs text-white/80 mt-1 leading-snug">
              Toca <Share className="inline h-3.5 w-3.5 -mt-0.5" /> "Compartir"
              y luego <strong>"Añadir a pantalla de inicio"</strong>.
            </p>
          ) : (
            <p className="text-xs text-white/80 mt-1 leading-snug">
              {device === "desktop"
                ? "Tenla siempre a mano como una app de escritorio."
                : "Acceso directo más rápido sin abrir el navegador."}
            </p>
          )}

          {!ios && (
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                onClick={install}
                disabled={!deferred}
                className="h-8 px-3 text-xs bg-white text-[#0f2b5a] hover:bg-white/90 disabled:opacity-60"
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

          {manualHint && !deferred && (
            <p className="text-[10px] text-white/60 mt-2 leading-snug">
              {manualHint}
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

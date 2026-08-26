import type { CSSProperties } from "react";

/*
  SocialNavLinks — botones de redes sociales del navbar público.

  - Iconos propios servidos desde /public/redes/*.svg (sin librerías externas).
  - En reposo se ven monocromos y discretos para no competir con los CTA.
  - Al pasar el puntero: recuperan el color de marca, saltan, encienden un halo
    del color de la red y muestran un call to action.
  - variant="bar"   → fila compacta con tooltip (escritorio).
  - variant="stack" → lista con el CTA siempre visible (menú móvil).
*/

type Network = {
  id: string;
  label: string;
  cta: string;
  href: string;
  icon: string;
  glow: string;
};

export const SOCIAL_NETWORKS: Network[] = [
  {
    id: "instagram",
    label: "Instagram",
    cta: "Síguenos en Instagram",
    href: "https://www.instagram.com/lexhouse.ia/",
    icon: "/redes/instagram.svg",
    glow: "rgba(214, 36, 159, 0.55)",
  },
  {
    id: "tiktok",
    label: "TikTok",
    cta: "Míranos en TikTok",
    href: "https://www.tiktok.com/@lexhouse.ai",
    icon: "/redes/tiktok.svg",
    glow: "rgba(254, 44, 85, 0.5)",
  },
  {
    id: "youtube",
    label: "YouTube",
    cta: "Mira nuestros videos",
    href: "https://www.youtube.com/@LEXHOUSEIA",
    icon: "/redes/youtube.svg",
    glow: "rgba(255, 0, 0, 0.45)",
  },
  {
    id: "threads",
    label: "Threads",
    cta: "Conversa en Threads",
    href: "https://www.threads.com/@lexhouse_ai",
    icon: "/redes/threads.svg",
    glow: "rgba(15, 27, 45, 0.45)",
  },
];

interface SocialNavLinksProps {
  variant?: "bar" | "stack";
  /** Sobre fondos oscuros o transparentes sobre el hero. */
  tone?: "light" | "dark";
  className?: string;
  onNavigate?: () => void;
}

export function SocialNavLinks({
  variant = "bar",
  tone = "light",
  className = "",
  onNavigate,
}: SocialNavLinksProps) {
  const stack = variant === "stack";

  const shell =
    tone === "dark"
      ? "border-white/20 bg-white/10 hover:border-white/50"
      : "border-slate-200/80 bg-white/70 hover:border-slate-300";

  return (
    <ul
      className={`flex items-center ${stack ? "flex-wrap gap-2" : "gap-1.5"} ${className}`}
      aria-label="Redes sociales de LexHouse AI"
    >
      {SOCIAL_NETWORKS.map((n, i) => (
        <li key={n.id} className="relative">
          <a
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            title={n.cta}
            aria-label={n.cta}
            onClick={onNavigate}
            style={{ "--glow": n.glow, animationDelay: `${i * 90}ms` } as CSSProperties}
            className={`group relative flex ${
              stack ? "w-full items-center gap-2.5 rounded-xl px-3 py-2.5" : "h-9 w-9 items-center justify-center rounded-full"
            } border ${shell} backdrop-blur-sm transition-all duration-300 ease-out
              hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_var(--glow)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--glow)]`}
          >
            {/* Halo que late al pasar el puntero */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-ping"
              style={{ boxShadow: "0 0 0 1px var(--glow)" }}
            />
            <img
              src={n.icon}
              alt=""
              width={18}
              height={18}
              decoding="async"
              className={`${stack ? "h-5 w-5" : "h-[18px] w-[18px]"} shrink-0 grayscale opacity-70 transition-all duration-300 ease-out
                group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 group-hover:rotate-[-6deg]
                group-focus-visible:grayscale-0 group-focus-visible:opacity-100`}
            />
            {stack ? (
              <span className={`text-sm font-medium ${tone === "dark" ? "text-white/90" : "text-slate-700"}`}>
                {n.cta}
              </span>
            ) : (
              /* Tooltip CTA: aparece bajo el botón al parar el puntero */
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap
                  rounded-lg bg-[#0F1B2D] px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white opacity-0 shadow-lg
                  transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100
                  group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              >
                <span
                  aria-hidden
                  className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#0F1B2D]"
                />
                {n.cta}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

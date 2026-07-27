import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowUpRight, Building2, MessagesSquare, Clapperboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
  EcosystemSwitcher — selector de productos del ecosistema LexHouse AI.
  Botón con glyph de marca (4 puntos azul/rojo/dorado) + panel con tiles de
  íconos en gradiente por color de producto. Mismo diseño en los 3 sitios.
  Añadir producto = agregar a SITES.
*/

const BLUE = "#003DA5";
const RED = "#DC1C2E";
const GOLD = "#D4AF37";
const INK = "#0F1B2D";

type SiteKey = "plataforma" | "crm" | "studio";

interface Site {
  key: SiteKey;
  name: string;
  tag: string;
  desc: string;
  href?: string;
  icon: LucideIcon;
  color: string;
  grad: [string, string];
}

const SITES: Site[] = [
  {
    key: "plataforma",
    name: "LexHouse AI",
    tag: "Plataforma",
    desc: "SaaS inmobiliario con IA: marketplace, contratos y agentes.",
    href: "https://lexhouse-ai.com",
    icon: Building2,
    color: BLUE,
    grad: ["#1E5FD0", "#003DA5"],
  },
  {
    key: "crm",
    name: "LexHouse AI",
    tag: "CRM",
    desc: "CRM sobre WhatsApp: Sofía atiende, agenda y clasifica leads.",
    href: "https://lexhouse-ai.homes",
    icon: MessagesSquare,
    color: RED,
    grad: ["#F0384A", "#DC1C2E"],
  },
  {
    key: "studio",
    name: "LexHouse AI",
    tag: "Studio",
    desc: "Crea reels de tus propiedades con IA, listos para publicar.",
    href: "https://lexhouse-ai.online",
    icon: Clapperboard,
    color: GOLD,
    grad: ["#E6C25A", "#C9A233"],
  },
];

interface Props {
  current: SiteKey;
  theme?: "light" | "dark";
  className?: string;
}

/** Glyph de marca: 2×2 de puntos azul/rojo/dorado/ink — representa el ecosistema. */
function EcosystemGlyph() {
  const dots = [BLUE, RED, GOLD, `${INK}59`];
  return (
    <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
      {dots.map((c, i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-[2px]" style={{ background: c }} />
      ))}
    </span>
  );
}

export function EcosystemSwitcher({ current, theme = "light", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const btnLight = "border-slate-200 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-[#0F1B2D] hover:shadow-sm";
  const btnDark = "border-white/20 bg-white/10 text-white/90 hover:bg-white/15";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cambiar de sitio · Ecosistema LexHouse AI"
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-all ${theme === "dark" ? btnDark : btnLight}`}
      >
        <EcosystemGlyph />
        <span className="hidden sm:inline">Ecosistema</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[320px] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_70px_-24px_rgba(15,27,45,0.45)]"
        >
          {/* Barra de acento con la paleta de marca */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${BLUE} 0%, ${RED} 55%, ${GOLD} 100%)` }} />

          <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
            <EcosystemGlyph />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Ecosistema LexHouse AI
            </span>
          </div>

          <div className="p-1.5 pt-0">
            {SITES.map((s) => {
              const isCurrent = s.key === current;
              const soon = !s.href;
              const Inner = (
                <>
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${s.grad[0]}, ${s.grad[1]})`, boxShadow: `0 6px 16px -6px ${s.color}` }}
                  >
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold" style={{ color: INK }}>{s.name}</span>
                      <span className="text-[11px] font-semibold" style={{ color: s.color }}>· {s.tag}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{s.desc}</span>
                    {isCurrent && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                        Estás aquí
                      </span>
                    )}
                    {soon && !isCurrent && (
                      <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${GOLD}1f`, color: "#8a6d1a" }}>
                        Próximamente
                      </span>
                    )}
                  </span>
                  {s.href && !isCurrent && (
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600" aria-hidden="true" />
                  )}
                </>
              );

              const base = "group flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors";

              if (soon) {
                return (
                  <div key={s.key} className={`${base} cursor-default opacity-70`} aria-disabled="true">
                    {Inner}
                  </div>
                );
              }
              if (isCurrent) {
                return (
                  <div key={s.key} className={`${base} bg-slate-50`} aria-current="true">
                    {Inner}
                  </div>
                );
              }
              return (
                <a
                  key={s.key}
                  href={s.href}
                  className={`${base} hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#003DA5]`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {Inner}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

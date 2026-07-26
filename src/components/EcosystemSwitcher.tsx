import { useEffect, useRef, useState } from "react";
import { LayoutGrid, ChevronDown, ArrowUpRight, Sparkles, MessageSquare, Clapperboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
  EcosystemSwitcher — selector de productos del ecosistema LexHouse AI.
  Botón de navbar que despliega un panel para saltar entre los sitios de la marca.
  Diseñado para crecer: añade una entrada nueva a SITES cuando el Studio (creador
  de videos) tenga su dominio. Marca "Estás aquí" el sitio actual (prop `current`).
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
  href?: string;   // ausente = próximamente
  icon: LucideIcon;
  color: string;
}

const SITES: Site[] = [
  {
    key: "plataforma",
    name: "LexHouse AI",
    tag: "Plataforma",
    desc: "SaaS inmobiliario con IA: marketplace, contratos y agentes.",
    href: "https://lexhouse-ai.com",
    icon: Sparkles,
    color: BLUE,
  },
  {
    key: "crm",
    name: "LexHouse AI",
    tag: "CRM",
    desc: "CRM sobre WhatsApp: Sofía atiende, agenda y clasifica leads.",
    href: "https://lexhouse-ai.homes",
    icon: MessageSquare,
    color: RED,
  },
  {
    key: "studio",
    name: "LexHouse AI",
    tag: "Studio",
    desc: "Creador de reels y videos inmobiliarios con IA.",
    icon: Clapperboard,
    color: GOLD,
  },
];

interface Props {
  /** Sitio actual (se marca "Estás aquí"). */
  current: SiteKey;
  /** Tema del botón según el fondo del navbar. */
  theme?: "light" | "dark";
  className?: string;
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

  const btnLight = "border-slate-200 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-[#0F1B2D]";
  const btnDark = "border-white/20 bg-white/10 text-white/90 hover:bg-white/15";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cambiar de sitio · Ecosistema LexHouse AI"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors ${theme === "dark" ? btnDark : btnLight}`}
      >
        <LayoutGrid className="h-4 w-4" style={{ color: theme === "dark" ? undefined : BLUE }} aria-hidden="true" />
        <span className="hidden sm:inline">Ecosistema</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[300px] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,27,45,0.35)]"
        >
          {/* Encabezado */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Ecosistema LexHouse AI
            </span>
          </div>

          {/* Productos */}
          <div className="p-1.5">
            {SITES.map((s) => {
              const isCurrent = s.key === current;
              const soon = !s.href;
              const Inner = (
                <>
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${s.color}14`, color: s.color }}
                  >
                    <s.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold" style={{ color: INK }}>{s.name}</span>
                      <span className="text-[11px] font-semibold" style={{ color: s.color }}>· {s.tag}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{s.desc}</span>
                    {isCurrent && (
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Estás aquí
                      </span>
                    )}
                    {soon && !isCurrent && (
                      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${GOLD}1f`, color: "#8a6d1a" }}>
                        Próximamente
                      </span>
                    )}
                  </span>
                  {s.href && !isCurrent && (
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" aria-hidden="true" />
                  )}
                </>
              );

              const base = "group flex items-start gap-3 rounded-xl p-3 text-left transition-colors";

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

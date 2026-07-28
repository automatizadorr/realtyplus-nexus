import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  MessageCircle,
  ShieldCheck,
  MapPin,
  Building2,
  MessagesSquare,
  Clapperboard,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import lexLogo from "@/assets/lexhouse-logo.webp";

/*
  PublicFooter — footer del CRM (lexhouse-ai.homes) con el MISMO lenguaje de marca
  del footer de lexhouse-ai.com (grid blueprint, línea tricolor, corner brackets,
  glows) sobre el fondo navy que usa este sitio. Cross-linkea los 3 dominios:
    · lexhouse-ai.com    → Plataforma
    · lexhouse-ai.homes  → CRM · Sofía (este sitio)
    · lexhouse-ai.online → Studio (reels)
  Reemplaza los footers ad-hoc de Index.tsx y PublicShell.tsx.
*/

const INK = "#0F1B2D";
const BLUE = "#003DA5";
const RED = "#DC1C2E";
const GOLD = "#D4AF37";

interface EcoLink {
  label: string;
  href: string;
}

/** Interno=react-router Link · con "#"=ancla (<a>) · http=externo (<a target). */
function NavLink({ link }: { link: EcoLink }) {
  const inner = (
    <>
      <span className="h-1 w-1 shrink-0 rounded-full bg-white/25 transition-colors group-hover:bg-[#D4AF37]" />
      {link.label}
    </>
  );
  const cls =
    "group flex items-center gap-2 text-[13px] text-white/55 transition-colors duration-150 hover:text-white";
  if (/^https?:\/\//.test(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  if (link.href.includes("#")) {
    return (
      <a href={link.href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={link.href} className={cls}>
      {inner}
    </Link>
  );
}

function NavColumn({ title, links }: { title: string; links: EcoLink[] }) {
  return (
    <div>
      <h3 className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#7FA8FF]">{title}</h3>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <NavLink link={l} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const PRODUCTO: EcoLink[] = [
  { label: "Cómo funciona", href: "/#como" },
  { label: "Funciones", href: "/#funciones" },
  { label: "VoiceCRM · Voz IA", href: "/#voz" },
  { label: "Reporte diario", href: "/#reporte" },
  { label: "Blog & Insights", href: "/blog" },
  { label: "Preguntas frecuentes", href: "/#faq" },
];

const RECURSOS: EcoLink[] = [
  { label: "Comenzar gratis", href: "/auth" },
  { label: "Iniciar sesión", href: "/auth" },
  { label: "Centro de Ayuda", href: "https://lexhouse-ai.com/support" },
  { label: "Términos de Uso", href: "https://lexhouse-ai.com/terms" },
  { label: "Privacidad de Datos", href: "https://lexhouse-ai.com/privacy" },
];

const PLATAFORMA_IA: EcoLink[] = [
  { label: "Agentes IA 24/7", href: "https://lexhouse-ai.com/soluciones/ia" },
  { label: "Contratos IA", href: "https://lexhouse-ai.com/soluciones/legal" },
  { label: "Vitrina de Propiedades", href: "https://lexhouse-ai.com/marketplace-publico" },
  { label: "Calculadora Hipotecaria", href: "https://lexhouse-ai.com/calculadora-hipotecaria" },
  { label: "Estadísticas del Mercado", href: "https://lexhouse-ai.com/estadisticas-mercado-inmobiliario" },
];

const SOCIALS = [
  { icon: Facebook, href: "https://www.facebook.com/profile.php?id=61586539315067", label: "Facebook" },
  { icon: Instagram, href: "https://www.instagram.com/lexhouse.ia/", label: "Instagram" },
  { icon: Linkedin, href: "https://www.linkedin.com/in/d-aimaautomations/", label: "LinkedIn" },
  { icon: Youtube, href: "https://www.youtube.com/@LEXHOUSEIA", label: "YouTube" },
] as const;

interface EcoSite {
  name: string;
  tag: string;
  href: string;
  icon: LucideIcon;
  color: string;
  current?: boolean;
}

const SITES: EcoSite[] = [
  { name: "LexHouse AI", tag: "Plataforma", href: "https://lexhouse-ai.com", icon: Building2, color: BLUE },
  { name: "LexHouse AI", tag: "CRM · Sofía", href: "https://lexhouse-ai.homes", icon: MessagesSquare, color: RED, current: true },
  { name: "LexHouse AI", tag: "Studio", href: "https://lexhouse-ai.online", icon: Clapperboard, color: GOLD },
];

function GoldBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = {
    tl: "top-4 left-4 border-t border-l",
    tr: "top-4 right-4 border-t border-r",
    bl: "bottom-4 left-4 border-b border-l",
    br: "bottom-4 right-4 border-b border-r",
  }[pos];
  return <div className={`pointer-events-none absolute h-5 w-5 border-[#D4AF37]/40 ${cls}`} aria-hidden="true" />;
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="relative overflow-hidden border-t border-white/10"
      style={{ background: INK }}
      role="contentinfo"
      aria-label="Pie de página"
      itemScope
      itemType="https://schema.org/Organization"
    >
      {/* Glows de marca */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#DC1C2E]/12 blur-[100px]" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#003DA5]/16 blur-[90px]" />
        <div className="absolute left-1/2 top-1/2 h-48 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/8 blur-[80px]" />
      </div>

      {/* Blueprint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px)",
            "linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",
          ].join(","),
          backgroundSize: "44px 44px",
        }}
      />

      {/* Scan line (CSS) */}
      <div
        aria-hidden
        className="lh-footer-scan pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${BLUE} 20%,${GOLD} 50%,${RED} 80%,transparent)` }}
      />

      {/* Línea superior tricolor */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${BLUE} 25%, ${GOLD} 50%, ${RED} 75%, transparent)` }}
      />

      <GoldBracket pos="tl" />
      <GoldBracket pos="tr" />
      <GoldBracket pos="bl" />
      <GoldBracket pos="br" />

      <meta itemProp="name" content="LexHouse AI · CRM" />
      <meta itemProp="url" content="https://lexhouse-ai.homes" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr]">
          {/* Columna marca */}
          <div className="flex flex-col gap-6">
            <Link to="/" aria-label="LexHouse AI · CRM — Inicio" className="w-fit">
              <span className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 ring-1 ring-white/10">
                <img src={lexLogo} alt="LexHouse AI" className="h-11 w-auto" width={44} height={44} />
              </span>
            </Link>

            <p className="max-w-sm text-[13px] leading-relaxed text-white/50" itemProp="description">
              CRM inmobiliario sobre WhatsApp con IA. Sofía responde 24/7, califica cada lead por intención y agenda las
              reuniones en tu calendario. Parte del ecosistema LexHouse AI.
            </p>

            <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Datos protegidos · RLS por rol
              </span>
            </div>

            <div className="flex items-center gap-2 text-white/50">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
              <span className="font-mono text-[10px]">Madrid, España · lexhouse-ai.homes</span>
            </div>

            <div className="flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-all duration-200 hover:scale-110 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                >
                  <s.icon size={16} strokeWidth={2} />
                </a>
              ))}
            </div>

            <a
              href="https://chat.whatsapp.com/L3midsH65kcBuRwemfwT32"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-fit items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 pl-4 pr-2 py-1.5 transition-all duration-200 hover:border-emerald-400/60 hover:bg-emerald-400/15"
            >
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                Comunidad WhatsApp
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 transition-transform group-hover:scale-110">
                <MessageCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
            </a>
          </div>

          <NavColumn title="Producto" links={PRODUCTO} />
          <NavColumn title="Recursos" links={RECURSOS} />
          <NavColumn title="Plataforma IA" links={PLATAFORMA_IA} />
        </div>

        {/* Tira del ecosistema: los 3 dominios enlazados */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Un ecosistema, tres productos
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {SITES.map((s) => {
              const inner = (
                <>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ring-1 ring-white/10"
                    style={{ background: s.color }}
                  >
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-white">{s.name}</span>
                      <span className="text-[11px] font-semibold" style={{ color: s.tag.includes("Studio") ? GOLD : s.tag.includes("Plataforma") ? "#7FA8FF" : "#FF8A96" }}>
                        · {s.tag}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-white/35">
                      {s.href.replace("https://", "")}
                    </span>
                  </span>
                  {s.current ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{ background: `${RED}2e`, color: "#FF8A96" }}
                    >
                      Aquí
                    </span>
                  ) : (
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-white/70" />
                  )}
                </>
              );
              const cls =
                "group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-all hover:border-white/20 hover:bg-white/[0.06]";
              return s.current ? (
                <div key={s.tag} className={cls} aria-current="true">
                  {inner}
                </div>
              ) : (
                <a key={s.tag} href={s.href} className={cls}>
                  {inner}
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="font-mono text-[10px] text-white/35">
            © {year} LexHouse AI · Servicios Inmobiliarios Plus Sur SL · Madrid
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a
              href="https://lexhouse-ai.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-white/35 transition-colors hover:text-white"
            >
              Términos
            </a>
            <a
              href="https://lexhouse-ai.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-white/35 transition-colors hover:text-white"
            >
              Privacidad
            </a>
            <a
              href="https://lexhouse-ai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] transition-colors hover:text-white"
              style={{ color: GOLD }}
            >
              lexhouse-ai.com
            </a>
            <span className="font-mono text-[10px] text-white/25">· Español</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

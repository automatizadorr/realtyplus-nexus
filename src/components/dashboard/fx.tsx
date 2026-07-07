import { useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion, type MotionValue } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Info } from "lucide-react";

// ── Kit visual "4D" futurista — versión CLARA ──────────────────────────────────
// Glassmorphism sobre blanco con glows de color RE/MAX, gauges radiales e
// inclinación 3D. Mismo lenguaje futurista que antes pero en claro.

export const FX_EASE = [0.16, 1, 0.3, 1] as const;

// Fondo de panel: rejilla sutil + glows RE/MAX que laten (suaves para claro).
export function FxBackground() {
  const reduce = useReducedMotion();
  const gridBg =
    "linear-gradient(rgba(30,64,140,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,140,0.05) 1px, transparent 1px)";
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: gridBg, backgroundSize: "34px 34px", maskImage: "radial-gradient(120% 90% at 50% 0%, #000 55%, transparent 100%)" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#003DA5]/12 blur-[90px]"
        animate={reduce ? undefined : { opacity: [0.5, 0.8, 0.5], scale: [1, 1.12, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-[#DC1C2E]/10 blur-[90px]"
        animate={reduce ? undefined : { opacity: [0.4, 0.65, 0.4], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    </>
  );
}

// Contenedor de panel claro con vidrio + glow (borde de la sección).
export function FxPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-sky-50/50 text-slate-800 ring-1 ring-slate-200/70 shadow-[0_20px_60px_-28px_rgba(20,50,110,0.35)] ${className}`}
    >
      <FxBackground />
      <div className="relative">{children}</div>
    </section>
  );
}

// Tarjeta con inclinación 3D (perspectiva real).
export function Tilt3D({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 });
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: rx as MotionValue<number>, rotateY: ry as MotionValue<number>, transformPerspective: 900, transformStyle: "preserve-3d" }}
      className="relative h-full"
    >
      {children}
    </motion.div>
  );
}

// Anillo radial (gauge) animado con gradiente + glow.
export function Gauge({ value, from, to, id }: { value: number; from: string; to: string; id: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 76 76" className="h-[68px] w-[68px] shrink-0 -rotate-90" style={{ filter: `drop-shadow(0 0 6px ${to}55)` }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="6.5" />
      <motion.circle
        cx="38" cy="38" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="6.5" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - Math.min(value, 100) / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: FX_EASE }}
      />
    </svg>
  );
}

export interface StatTileProps {
  title: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon: React.ElementType;
  from: string;
  to: string;
  glow: string; // "r,g,b"
  gauge?: boolean; // si true, `value` es un porcentaje 0–100 y se muestra el anillo
  hint?: string;
  explain?: string; // resumen que se muestra al hacer clic (qué es y para qué sirve)
  onClick?: () => void;
  index?: number;
}

export function StatTile({ title, value, decimals = 0, suffix = "", icon: Icon, from, to, glow, gauge, hint, explain, onClick, index = 0 }: StatTileProps) {
  const reduce = useReducedMotion();
  const clickable = !!(explain || onClick);

  const inner = (
    <>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${to}, transparent)` }} />
      <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `0 0 28px -8px rgba(${glow},0.55)` }} />
      {explain && (
        <Info className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
      )}
      <div className="flex items-center gap-3" style={{ transform: "translateZ(30px)" }}>
        {gauge ? (
          <div className="relative grid place-items-center">
            <Gauge value={value} from={from} to={to} id={`gauge-${title.replace(/\s+/g, "")}-${index}`} />
            <Icon className="absolute h-5 w-5" style={{ color: to }} />
          </div>
        ) : (
          <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl" style={{ background: `linear-gradient(135deg, ${from}26, ${to}0d)`, boxShadow: `inset 0 0 0 1px ${to}33` }}>
            <Icon className="h-5 w-5" style={{ color: to }} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight" style={{ color: to, textShadow: `0 0 20px rgba(${glow},0.28)` }}>
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[11px] leading-tight text-slate-400">{hint}</p>}
    </>
  );

  const tileClass = `group relative h-full w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 p-4 text-left shadow-sm ring-1 ring-white/60 backdrop-blur-md transition-shadow duration-300 ${clickable ? "cursor-pointer" : ""}`;

  const body = explain ? (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={tileClass}>{inner}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `linear-gradient(135deg, ${from}26, ${to}0d)`, boxShadow: `inset 0 0 0 1px ${to}33` }}>
            <Icon className="h-4 w-4" style={{ color: to }} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-medium uppercase tracking-[0.18em] text-slate-400">{title}</p>
            <p className="text-xl font-bold tabular-nums leading-none" style={{ color: to }}>
              {(gauge || suffix === "%" ? value.toFixed(decimals) : value.toLocaleString())}{suffix}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{explain}</p>
      </PopoverContent>
    </Popover>
  ) : (
    <div onClick={onClick} className={tileClass}>{inner}</div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: FX_EASE }}
    >
      <Tilt3D disabled={!!reduce}>{body}</Tilt3D>
    </motion.div>
  );
}

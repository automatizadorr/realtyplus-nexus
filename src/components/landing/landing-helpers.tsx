import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useMotionValue, useSpring, animate } from "framer-motion";

// ── Paleta de marca RE/MAX ────────────────────────────────────────────────────
export const INK     = "#021B4D";
export const INK2    = "#0A2E6E";
export const BLUE    = "#003DA5";
export const BLUE_LT = "#7FA8FF";
export const BRAND   = "#DC1C2E";
export const SIGNAL  = "#25D366";
export const HOT     = "#F59E0B";
export const EASE    = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ── Secuencia de entrada orquestada del hero ──────────────────────────────────
export const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};
export const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    const upd = () => setFine(mq.matches);
    upd();
    mq.addEventListener?.("change", upd);
    return () => mq.removeEventListener?.("change", upd);
  }, []);
  return fine;
}

// ── Componentes de animación ──────────────────────────────────────────────────
export function FadeSection({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setValue(target); return; }
    const ctrl = animate(0, target, { duration: 1.6, ease: "easeOut", onUpdate: (v) => setValue(Math.round(v)) });
    return () => ctrl.stop();
  }, [inView, target, reduce]);
  return <span ref={ref}>{value.toLocaleString("es")}{suffix}</span>;
}

// Acento editorial: Fraunces itálica dentro de un titular sans
export function Serif({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-serif italic font-medium tracking-normal ${className}`}>{children}</span>;
}

// CTA magnético — sigue sutilmente al cursor (solo puntero fino)
export function Magnetic({ children, strength = 0.35, className = "" }: {
  children: React.ReactNode; strength?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const on = fine && !reduce;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 170, damping: 15, mass: 0.1 });
  const sy = useSpring(y, { stiffness: 170, damping: 15, mass: 0.1 });
  return (
    <motion.span
      ref={ref}
      className={`inline-flex ${className}`}
      style={{ x: on ? sx : 0, y: on ? sy : 0 }}
      onMouseMove={(e) => {
        if (!on || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}

// Card con tilt 3D al hover (solo puntero fino)
export function TiltCard({ children, className = "", max = 7 }: {
  children: React.ReactNode; className?: string; max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const fine = useFinePointer();
  const on = fine && !reduce;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });
  return (
    <div style={{ perspective: 900 }} className={className}>
      <motion.div
        ref={ref}
        className="h-full [transform-style:preserve-3d]"
        style={{ rotateX: on ? srx : 0, rotateY: on ? sry : 0 }}
        onMouseMove={(e) => {
          if (!on || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          ry.set(((e.clientX - r.left) / r.width - 0.5) * max);
          rx.set(-((e.clientY - r.top) / r.height - 0.5) * max);
        }}
        onMouseLeave={() => { rx.set(0); ry.set(0); }}
      >
        {children}
      </motion.div>
    </div>
  );
}

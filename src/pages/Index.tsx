import { useEffect, useRef, useState } from "react";
import {
  motion, useInView, useReducedMotion, animate,
  useScroll, useTransform, useSpring, useMotionValue,
} from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, CalendarCheck, Tags, Megaphone, ScanLine, Mic,
  FileSpreadsheet, LayoutDashboard, ArrowRight, Check, Menu, X,
  ChevronDown, Phone, Sparkles, Clock, Globe, ShieldCheck,
} from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

// ── Paleta de marca RE/MAX (azul · rojo · blanco) ─────────────────────────────
const INK = "#021B4D";       // navy-azul RE/MAX (secciones oscuras y texto)
const INK2 = "#0A2E6E";      // navy-azul elevado
const BLUE = "#003DA5";      // AZUL RE/MAX (marca, sobre fondos claros)
const BLUE_LT = "#7FA8FF";   // azul claro (acentos sobre fondos oscuros)
const BRAND = "#DC1C2E";     // ROJO RE/MAX (acción)
const SIGNAL = "#25D366";    // verde WhatsApp — SOLO dentro del canal WhatsApp
const HOT = "#F59E0B";       // lead caliente

// easeOutExpo — se siente "caro" (skill diseno-web-lujo)
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ¿el puntero es fino (mouse/trackpad)? — para desactivar tilt/magnético en touch
function useFinePointer() {
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

// Secuencia de entrada orquestada del hero (stagger)
const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

// ── Helpers de animación ──────────────────────────────────────────────────────
function FadeSection({ children, className = "", delay = 0 }: {
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

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
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

// Botón/CTA magnético — el elemento sigue sutilmente al cursor (solo puntero fino)
function Magnetic({ children, strength = 0.35, className = "" }: {
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

// Card con tilt 3D al hover (solo puntero fino) — reacciona a la posición del cursor
function TiltCard({ children, className = "", max = 7 }: {
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
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          ry.set(px * max);
          rx.set(-py * max);
        }}
        onMouseLeave={() => { rx.set(0); ry.set(0); }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── SIGNATURE: conversación que se auto-clasifica ─────────────────────────────
const THREAD = [
  { from: "lead",   text: "Hola, vi el mensaje sobre la franquicia 👀" },
  { from: "isabel", text: "¡Claro! Te cuento. ¿Buscas empezar tú solo o montar oficina con equipo?" },
  { from: "lead",   text: "con equipo, estoy en Madrid" },
  { from: "isabel", text: "Perfecto, eso encaja con el modelo QUARTZ. ¿Te agendo una reunión el jueves a las 10:00?" },
  { from: "lead",   text: "sí, me viene bien" },
];

function LiveConversation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setStep(THREAD.length); return; }
    setStep(0);
    const id = setInterval(() => {
      setStep((s) => (s >= THREAD.length ? s : s + 1));
    }, 900);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const agendada = step >= THREAD.length;

  return (
    <div ref={ref} className="relative w-full max-w-md mx-auto">
      {/* Tarjeta de estado del lead (flota arriba) */}
      <div className="absolute -top-5 -right-3 z-20 sm:right-2">
        <div
          className="rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur transition-colors duration-500"
          style={{
            background: "rgba(255,255,255,0.96)",
            borderColor: agendada ? `${BLUE}66` : "#e5e7eb",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors duration-500"
              style={{
                background: agendada ? `${BLUE}1f` : "#f1f5f9",
                color: agendada ? BLUE : "#64748b",
              }}
            >
              {agendada ? "CITA AGENDADA" : "SIGUE EN CAMPAÑA"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="font-mono text-[10px]" style={{ color: INK }}>
              score <b style={{ color: agendada ? BLUE : HOT }}>{agendada ? "92" : "—"}</b>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {agendada ? "jue · 10:00" : "esperando…"}
            </span>
          </div>
        </div>
      </div>

      {/* Hilo de WhatsApp */}
      <div className="rounded-[26px] border border-white/10 bg-[#0b1730] overflow-hidden shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: INK2 }}>
          <div className="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-sm shrink-0"
               style={{ background: `linear-gradient(135deg, ${BRAND}, ${INK})` }}>
            iS
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight">iSabel · Asesora IA</div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: SIGNAL }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SIGNAL }} />
              en línea
            </div>
          </div>
          <span className="ml-auto font-mono text-[10px] text-white/30">WhatsApp</span>
        </div>

        {/* Mensajes */}
        <div className="px-3.5 py-4 space-y-2.5 min-h-[300px]"
             style={{ background: "linear-gradient(180deg,#0b1730,#0d1c3a)" }}>
          {THREAD.slice(0, step).map((m, i) => {
            const lead = m.from === "lead";
            return (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${lead ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-3.5 py-2 text-[13px] leading-snug rounded-2xl"
                  style={
                    lead
                      ? { background: SIGNAL, color: "#06251a", borderBottomRightRadius: 4 }
                      : { background: "#ffffff", color: INK, borderBottomLeftRadius: 4 }
                  }
                >
                  {m.text}
                </div>
              </motion.div>
            );
          })}
          {!agendada && step > 0 && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl bg-white/90" style={{ borderBottomLeftRadius: 4 }}>
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pie: lo que hizo el sistema */}
      <div
        className="mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all duration-500"
        style={{
          background: agendada ? `${BLUE}1f` : "rgba(255,255,255,0.04)",
          borderColor: agendada ? `${BLUE_LT}55` : "rgba(255,255,255,0.1)",
        }}
      >
        <CalendarCheck className="w-4 h-4 shrink-0" style={{ color: agendada ? BLUE_LT : "#64748b" }} />
        <span className="text-[12px]" style={{ color: agendada ? "#bcd0ff" : "rgba(255,255,255,0.5)" }}>
          {agendada
            ? "Reunión creada en Google Calendar · lead enviado al reporte de jefatura"
            : "iSabel está calificando al lead…"}
        </span>
      </div>
    </div>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "¿Usa mi número de WhatsApp actual?", a: "Sí. iSabel se conecta a tu WhatsApp existente y le agrega respuestas automáticas, agenda y clasificación. Sigues con el mismo número de siempre." },
  { q: "¿La IA agenda reuniones de verdad?", a: "Sí. Cuando el lead confirma día y hora, iSabel crea el evento en tu Google Calendar (con un mínimo de 18 horas de antelación) y envía la invitación por correo." },
  { q: "¿Cómo clasifica los leads?", a: "Lee la conversación y le asigna un estado por intención: Cita agendada, Solo quiere propiedades, No interesa, Sigue en campaña… Así sabes de un vistazo quién está caliente." },
  { q: "¿Recibo un resumen de los leads?", a: "Cada mañana a las 08:00 (hora de Madrid) recibes un reporte consolidado con los leads del día, agrupados por etiqueta y con sus conversaciones. Sin abrir el panel." },
  { q: "¿Necesito saber de tecnología?", a: "No. Si sabes usar WhatsApp, sabes usar RealtyPlus. El inbox, las campañas y los reportes están pensados para agentes, no para técnicos." },
  { q: "¿Mis datos están seguros?", a: "Tus conversaciones y leads viven en tu propia base con control de acceso por roles (RLS). No vendemos ni compartimos datos de tus clientes." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-semibold text-[15px]" style={{ color: INK }}>{q}</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: BRAND }} />
      </button>
      {open && <p className="pb-5 -mt-1 text-[14px] leading-relaxed text-slate-500">{a}</p>}
    </div>
  );
}

// ── WhatsApp flotante ───────────────────────────────────────────────────────────
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/56971806730"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex w-14 h-14 rounded-full items-center justify-center shadow-lg transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ background: SIGNAL, boxShadow: `0 10px 30px ${SIGNAL}55` }}
    >
      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: SIGNAL }} />
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white relative z-10" aria-hidden="true">
        <path d={WA_PATH} />
      </svg>
    </a>
  );
}

// ── Datos de secciones ──────────────────────────────────────────────────────────
const STEPS = [
  { k: "01", title: "Llega el mensaje", desc: "WhatsApp, campaña o web — todo entra a un inbox unificado. Ningún lead se pierde a las 11 de la noche.", icon: MessageSquare },
  { k: "02", title: "iSabel responde y agenda", desc: "La IA contesta en segundos con tu conocimiento de marca, califica al lead y agenda la reunión en tu calendario.", icon: Sparkles },
  { k: "03", title: "Se etiqueta por intención", desc: "Cada conversación queda clasificada: cita agendada, solo quiere propiedades, no interesa… Sabes quién está caliente.", icon: Tags },
  { k: "04", title: "Reporte a jefatura · 08:00", desc: "Cada mañana, un informe consolidado de los leads del día agrupados por etiqueta. Automático, sin abrir el panel.", icon: Clock },
];

const FEATURES = [
  { title: "Inbox unificado", desc: "Todas tus conversaciones de WhatsApp en un solo panel, con notas, búsqueda y respuestas rápidas.", icon: MessageSquare },
  { title: "iSabel · Asesora con IA", desc: "Responde 24/7 con memoria de la conversación, tu base de conocimiento y agenda en Google Calendar.", icon: Sparkles },
  { title: "Etiquetado inteligente", desc: "La IA clasifica cada lead por intención de compra automáticamente. Tú solo trabajas a los calientes.", icon: Tags },
  { title: "Campañas segmentadas", desc: "Envía mensajes personalizados a miles de contactos por país, etiqueta o estado, sin copiar y pegar.", icon: Megaphone },
  { title: "Scanner de leads", desc: "Importa tu base desde Excel o CSV; deduplica y deja todo listo para contactar en minutos.", icon: ScanLine },
  { title: "VoiceCRM", desc: "Un agente de voz que atiende y cualifica por llamada, integrado al mismo flujo de leads.", icon: Mic },
  { title: "Exportar y reportar", desc: "Descarga leads y conversaciones en Excel, Word o HTML, o envíalos a expansión con un clic.", icon: FileSpreadsheet },
  { title: "Dashboard en vivo", desc: "Leads del día, calientes, citas y tasa de respuesta — todo en tiempo real.", icon: LayoutDashboard },
];

// Mock del reporte diario (lo que llega a jefatura)
const REPORT_TAGS = [
  { name: "Cita agendada", count: 6, color: BLUE_LT },
  { name: "Solo quiere propiedades", count: 9, color: "#3b82f6" },
  { name: "Sin respuesta clara", count: 4, color: HOT },
  { name: "No interesa", count: 2, color: "#94a3b8" },
];

// ── Página ───────────────────────────────────────────────────────────────────────
export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  // Parallax sutil del hero (solo transform · rAF interno de framer)
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -46]);

  useEffect(() => {
    if (!authLoading && session) navigate("/dashboard", { replace: true });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [["#como", "Cómo funciona"], ["#funciones", "Funciones"], ["#reporte", "Reporte diario"], ["#faq", "FAQ"]];

  return (
    <div className="relative bg-white font-sans" style={{ color: INK }}>
      {/* Loading */}
      <div
        className="fixed inset-0 z-50 bg-white grid place-items-center transition-opacity duration-500"
        style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "all" }}
        aria-hidden={loaded}
      >
        <img src={realtyplusLogo} alt="RealtyPlus" className="w-36 animate-pulse" width="144" height="54" />
      </div>

      <WhatsAppFloat />

      {/* Nav */}
      <nav
        aria-label="Navegación principal"
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={realtyplusLogo} alt="RealtyPlus Nexus" className="h-8 w-auto" width="120" height="32" />
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-[#E11D34] transition-colors">{label}</a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/auth" className="px-4 py-2 text-sm text-slate-600 hover:text-[#0A1228] transition-colors">Iniciar sesión</Link>
            <Link to="/auth" className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-transform hover:scale-105" style={{ background: BRAND }}>
              Comenzar gratis
            </Link>
          </div>
          <button
            aria-label={mobileMenu ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenu}
            className="md:hidden text-slate-600 p-1"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex flex-col gap-3">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="text-slate-600 text-sm py-1" onClick={() => setMobileMenu(false)}>{label}</a>
            ))}
            <Link to="/auth" className="mt-1 px-5 py-2.5 text-sm font-semibold text-white rounded-lg text-center" style={{ background: BRAND }} onClick={() => setMobileMenu(false)}>
              Comenzar gratis
            </Link>
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ── */}
        <section ref={heroRef} className="relative overflow-hidden" style={{ background: INK }} aria-labelledby="hero-heading">
          {/* fondo: grid sutil + glows (parallax sutil al hacer scroll) */}
          <motion.div className="absolute inset-0 opacity-[0.06] will-change-transform" aria-hidden="true"
               style={{ y: reduce ? 0 : gridY, backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
          <motion.div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-25 will-change-transform" style={{ y: reduce ? 0 : glowY, background: BRAND }} aria-hidden="true" />
          <motion.div className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-25 will-change-transform" style={{ y: reduce ? 0 : glowY, background: BLUE }} aria-hidden="true" />

          <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-20 lg:pt-32 lg:pb-28">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
              {/* Columna izquierda: secuencia de entrada orquestada */}
              <motion.div
                variants={heroContainer}
                initial={reduce ? false : "hidden"}
                animate={reduce ? false : (loaded ? "show" : "hidden")}
              >
                <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 mb-7">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND }} />
                  <span className="font-mono text-[11px] tracking-wide text-white/70">CRM inmobiliario · sobre WhatsApp</span>
                </motion.div>

                <h1 id="hero-heading" className="font-display font-extrabold text-white leading-[1.02] tracking-tight text-[2.6rem] sm:text-6xl">
                  <motion.span variants={heroItem} className="block">De un “hola” en WhatsApp</motion.span>
                  <motion.span variants={heroItem} className="block">
                    a una <span style={{ color: BRAND }}>cita agendada</span>.
                  </motion.span>
                </h1>

                <motion.p variants={heroItem} className="mt-6 text-lg leading-relaxed text-white/60 max-w-xl">
                  <strong className="text-white/90">iSabel</strong>, tu asesora con IA, responde en segundos,
                  califica cada lead por intención y agenda la reunión en tu calendario.
                  Tú solo cierras.
                </motion.p>

                <motion.div variants={heroItem} className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Magnetic>
                    <Link to="/auth" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 font-bold text-white rounded-xl text-[15px] transition-transform hover:scale-[1.03]" style={{ background: BRAND, boxShadow: `0 12px 30px ${BRAND}40` }}>
                      Comenzar gratis
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </Link>
                  </Magnetic>
                  <a href="#como" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 font-semibold text-white rounded-xl text-[15px] border border-white/15 hover:bg-white/5 transition-colors">
                    Ver cómo funciona
                  </a>
                </motion.div>

                <motion.div variants={heroItem} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-white/40">
                  {["Sobre tu propio WhatsApp", "Agenda en Google Calendar", "Reporte diario 08:00"].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Columna derecha: tarjeta de conversación con parallax sutil */}
              <motion.div className="pt-6 lg:pt-0 will-change-transform" style={{ y: reduce ? 0 : cardY }}>
                <LiveConversation />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Cómo funciona (secuencia real) ── */}
        <section id="como" className="py-24 px-6 bg-white" aria-labelledby="como-heading">
          <div className="max-w-7xl mx-auto">
            <FadeSection className="max-w-2xl mb-14">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>El recorrido de un lead</span>
              <h2 id="como-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
                Cuatro pasos, cero trabajo manual.
              </h2>
            </FadeSection>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map((s, i) => (
                <FadeSection key={s.k} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <div className="relative h-full p-6 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-card transition-all duration-300">
                      <div className="flex items-center justify-between mb-5">
                        <span className="font-mono text-sm font-bold text-slate-300" style={{ transform: "translateZ(28px)" }}>{s.k}</span>
                        <s.icon className="w-5 h-5" style={{ color: BRAND, transform: "translateZ(28px)" }} aria-hidden="true" />
                      </div>
                      <h3 className="font-display font-semibold text-lg mb-2" style={{ transform: "translateZ(20px)" }}>{s.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
                      {i < STEPS.length - 1 && (
                        <span className="hidden lg:block absolute top-7 -right-2.5 text-slate-200" aria-hidden="true">→</span>
                      )}
                    </div>
                  </TiltCard>
                </FadeSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── Funciones reales ── */}
        <section id="funciones" className="py-24 px-6" style={{ background: "#F6F7FB" }} aria-labelledby="func-heading">
          <div className="max-w-7xl mx-auto">
            <FadeSection className="max-w-2xl mb-14">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>La plataforma</span>
              <h2 id="func-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
                Todo lo que de verdad usas, en un solo lugar.
              </h2>
              <p className="mt-4 text-slate-500 text-lg">Ocho herramientas conectadas alrededor de la misma conversación.</p>
            </FadeSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f, i) => (
                <FadeSection key={f.title} delay={(i % 4) * 0.06}>
                  <div className="h-full p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#E11D34]/25 hover:shadow-card transition-all duration-300">
                    <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `${BRAND}10` }}>
                      <f.icon className="w-5 h-5" style={{ color: BRAND }} aria-hidden="true" />
                    </div>
                    <h3 className="font-semibold text-[15px] mb-1.5">{f.title}</h3>
                    <p className="text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── Reporte diario (lo que construimos) ── */}
        <section id="reporte" className="py-24 px-6" style={{ background: INK }} aria-labelledby="rep-heading">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <FadeSection>
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BLUE_LT }}>Automático · 08:00</span>
              <h2 id="rep-heading" className="font-display font-bold text-3xl sm:text-4xl text-white mt-3 leading-tight">
                Cada mañana, los leads del día en tu correo.
              </h2>
              <p className="mt-5 text-white/60 text-lg leading-relaxed">
                A las 08:00 (hora de Madrid) jefatura recibe un reporte consolidado: todos los leads
                que se movieron en las últimas 24 horas, agrupados por etiqueta y con su conversación
                completa. Los que aún no responden quedan fuera — solo lo que importa.
              </p>
              <ul className="mt-7 space-y-3">
                {["Agrupado por intención del lead", "Conversación completa de cada uno", "Excluye automáticamente a los que no respondieron"].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-white/75 text-sm">
                    <Check className="w-4 h-4 shrink-0" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
                  </li>
                ))}
              </ul>
            </FadeSection>

            <FadeSection delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10" style={{ background: INK2 }}>
                  <span className="font-display font-semibold text-white text-sm">Reporte de leads · hoy</span>
                  <span className="font-mono text-[10px] text-white/40">21 leads · 4 etiquetas</span>
                </div>
                <div className="divide-y divide-white/5">
                  {REPORT_TAGS.map((t) => (
                    <div key={t.name} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="text-white/80 text-sm flex-1">{t.name}</span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: `${t.color}1f`, color: t.color }}>
                        {t.count} leads
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 text-center font-mono text-[10px] text-white/30 bg-white/[0.02]">
                  enviado a jefatura@realty-plus.es · 08:00
                </div>
              </div>
            </FadeSection>
          </div>
        </section>

        {/* ── Datos honestos ── */}
        <section className="py-20 px-6 bg-white" aria-label="Datos">
          <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {[
              { icon: Globe, value: 25, suffix: "+", label: "Países en la red RealtyPlus" },
              { icon: Sparkles, value: 24, suffix: "/7", label: "iSabel atendiendo leads" },
              { icon: Clock, value: 8, suffix: ":00", label: "Reporte diario a jefatura" },
              { icon: Tags, value: 100, suffix: "%", label: "Leads clasificados por IA" },
            ].map((s, i) => (
              <FadeSection key={s.label} delay={i * 0.08} className="text-center">
                <s.icon className="w-6 h-6 mx-auto mb-3" style={{ color: BRAND }} aria-hidden="true" />
                <div className="font-display font-extrabold text-4xl sm:text-5xl" style={{ color: INK }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-2 text-sm text-slate-500">{s.label}</div>
              </FadeSection>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-24 px-6" style={{ background: "#F6F7FB" }} aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto">
            <FadeSection className="mb-8">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>Preguntas frecuentes</span>
              <h2 id="faq-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3">Lo que sueles preguntar.</h2>
            </FadeSection>
            <FadeSection>
              <div className="rounded-2xl bg-white border border-slate-100 px-6">
                {FAQS.map((f) => <FAQItem key={f.q} {...f} />)}
              </div>
            </FadeSection>
            <FadeSection className="mt-8 text-center">
              <a href="https://wa.me/56971806730" target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 transition-colors hover:text-white"
                 style={{ borderColor: SIGNAL, color: "#15803d" }}
                 onMouseEnter={(e) => (e.currentTarget.style.background = SIGNAL)}
                 onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <Phone className="w-4 h-4" aria-hidden="true" />¿Otra pregunta? Escríbenos por WhatsApp
              </a>
            </FadeSection>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="py-24 px-6 bg-white" aria-labelledby="cta-heading">
          <FadeSection>
            <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden px-8 py-16 sm:px-16 sm:py-20 text-center" style={{ background: INK }}>
              <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: BRAND }} aria-hidden="true" />
              <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: BLUE }} aria-hidden="true" />
              <div className="relative">
                <ShieldCheck className="w-10 h-10 mx-auto mb-5" style={{ color: BLUE_LT }} aria-hidden="true" />
                <h2 id="cta-heading" className="font-display font-extrabold text-3xl sm:text-5xl text-white leading-tight">
                  Deja que iSabel atienda.
                  <br />Tú dedícate a cerrar.
                </h2>
                <p className="mt-5 text-white/60 text-lg max-w-lg mx-auto">
                  Conecta tu WhatsApp y empieza gratis. Sin tarjeta, sin contratos.
                </p>
                <Magnetic className="mt-9" strength={0.3}>
                  <Link to="/auth" className="group inline-flex items-center gap-2 px-9 py-4 font-bold text-white rounded-xl text-lg transition-transform hover:scale-105" style={{ background: BRAND, boxShadow: `0 14px 36px ${BRAND}50` }}>
                    Comenzar gratis
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Link>
                </Magnetic>
              </div>
            </div>
          </FadeSection>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="py-14 px-6" style={{ background: INK }} aria-label="Pie de página">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <img src={realtyplusLogo} alt="RealtyPlus" className="h-9 w-auto mb-4 brightness-0 invert" width="120" height="36" />
              <p className="text-white/40 text-sm leading-relaxed">CRM inmobiliario sobre WhatsApp, con IA que responde, agenda y clasifica.</p>
            </div>
            {[
              { title: "Plataforma", links: ["Inbox unificado", "iSabel · Asesora IA", "Etiquetado IA", "Campañas", "Scanner", "VoiceCRM"] },
              { title: "Recursos", links: ["Reporte diario", "Exportar leads", "Dashboard", "Integraciones"] },
              { title: "RealtyPlus", links: ["Red de franquicias", "Soporte", "Privacidad", "Términos"] },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="font-mono text-white/70 text-xs uppercase tracking-widest mb-4">{col.title}</h3>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}><span className="text-white/45 text-sm">{l}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/30 text-xs">
            <span>© {new Date().getFullYear()} RealtyPlus · Servicios Inmobiliarios Plus Sur SL</span>
            <span className="font-mono">Hecho por AI-MaX Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

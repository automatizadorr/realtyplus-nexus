import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion, AnimatePresence, useInView, useReducedMotion, animate,
  useScroll, useTransform, useSpring, useMotionValue,
} from "framer-motion";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, CalendarCheck, Tags, Megaphone, ScanLine, Mic,
  FileSpreadsheet, LayoutDashboard, ArrowRight, Check, Menu, X,
  ChevronDown, ChevronLeft, ChevronRight, Phone, PhoneCall, PhoneOff,
  Volume2, Sparkles, Clock, Globe, ShieldCheck,
} from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";
import { HydroRipple, HydroRippleHandle } from "@/components/ui/hydro-ripple";

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

// Acento editorial: Fraunces itálica dentro de un titular sans (eco del hero)
function Serif({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-serif italic font-medium tracking-normal ${className}`}>{children}</span>;
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

// ── Carrusel "IA y leads" (imágenes reales · Ken Burns · autoplay · swipe) ──────
const SLIDES = [
  { img: "/landing/data-analytics.jpg", tag: "Datos en vivo",  title: "Cada lead, medido",             desc: "Score, intención y actividad de cada contacto en tiempo real." },
  { img: "/landing/leads-team.jpg",     tag: "Tu equipo",      title: "Todo el equipo, un solo inbox", desc: "Nadie pisa una conversación; cada agente sabe qué le toca." },
  { img: "/landing/ai-chip.jpg",        tag: "Inteligencia",   title: "IA entrenada en tu negocio",    desc: "iSabel responde con tu conocimiento de marca, no con respuestas genéricas." },
  { img: "/landing/closing-deal.jpg",   tag: "Resultado",      title: "Del primer «hola» al cierre",   desc: "Menos tareas manuales, más reuniones agendadas cada semana." },
  { img: "/landing/realestate.jpg",     tag: "Inmobiliario",   title: "Pensado para vender propiedades", desc: "Flujos, etiquetas y reportes hechos a la medida del sector." },
];

function LeadsCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const n = SLIDES.length;
  const go = (d: number) => setIdx((i) => (i + d + n) % n);

  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % n), 5000);
    return () => clearInterval(id);
  }, [paused, reduce, n]);

  const s = SLIDES[idx];
  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#0b1730] aspect-[16/10] sm:aspect-[16/9]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence>
        <motion.div
          key={idx}
          className="absolute inset-0 will-change-transform"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}
        >
          <img
            src={s.img}
            alt={s.title}
            className={`w-full h-full object-cover select-none pointer-events-none ${reduce ? "" : "animate-kenburns"}`}
            loading="lazy"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>

      {/* overlay para legibilidad del texto */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `linear-gradient(180deg, ${INK}22 0%, ${INK}00 32%, ${INK}e6 100%)` }} />

      {/* caption */}
      <div className="absolute left-0 bottom-0 p-6 sm:p-9 max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3 text-white"
                  style={{ background: BRAND }}>{s.tag}</span>
            <h3 className="font-display font-bold text-white text-2xl sm:text-3xl leading-tight">{s.title}</h3>
            <p className="mt-2 text-white/70 text-sm sm:text-[15px] leading-relaxed">{s.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* flechas */}
      <button aria-label="Imagen anterior" onClick={() => go(-1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>
      <button aria-label="Imagen siguiente" onClick={() => go(1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* dots */}
      <div className="absolute right-5 bottom-6 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button key={i} aria-label={`Ir a la imagen ${i + 1}`} onClick={() => setIdx(i)}
            className="h-1.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            style={{ width: i === idx ? 26 : 8, background: i === idx ? BRAND : "rgba(255,255,255,0.4)" }} />
        ))}
      </div>
    </div>
  );
}

// ── Agente de voz (VoiceCRM): mockup de llamada FUSIONADO con el agente real
//    de ElevenLabs (@elevenlabs/react · WebRTC). El mockup ES la llamada. ──────────
const VOICE_AGENT_ID = "agent_2401ksxkp4fgfw0vwt0yt1tnz7r2";
type VState = "idle" | "connecting" | "listening" | "speaking";

// Waveform reactiva a la amplitud REAL del micrófono cuando hay llamada activa
function LiveWave({ amp, active, color }: { amp: number; active: boolean; color: string }) {
  const reduce = useReducedMotion();
  const bars = 26;
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const peak = Math.max(0.12, Math.min(1, 0.18 + amp * (0.55 + Math.abs(Math.sin(phase)))));
        return (
          <motion.span key={i}
            className="w-[3px] h-full rounded-full origin-center will-change-transform"
            style={{ background: i % 3 === 0 ? color : "rgba(255,255,255,0.5)" }}
            animate={reduce ? { scaleY: 0.14 } : active ? { scaleY: peak } : { scaleY: [0.14, 0.3 + (i % 6) * 0.06, 0.14] }}
            transition={reduce ? { duration: 0 } : active
              ? { duration: 0.12, ease: "easeOut" }
              : { duration: 0.9 + (i % 5) * 0.12, repeat: Infinity, ease: "easeInOut", delay: (i % 6) * 0.05 }}
          />
        );
      })}
    </div>
  );
}

export function VoiceCallLive() {
  return (
    <ConversationProvider>
      <VoiceCallLiveInner />
    </ConversationProvider>
  );
}

function VoiceCallLiveInner() {
  const reduce = useReducedMotion();
  const [state, setState] = useState<VState>("idle");
  const [amp, setAmp] = useState(0);
  const [sec, setSec] = useState(0);

  const stateRef = useRef<VState>("idle");
  const ampRef = useRef(0);
  const rafAudioRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { ampRef.current = amp; }, [amp]);

  // SDK oficial de ElevenLabs (WebRTC)
  const conversation = useConversation({
    onConnect: () => setState("listening"),
    onDisconnect: () => { setState("idle"); stopMicRef.current?.(); },
    onError: (err: unknown) => { console.error("[ElevenLabs]", err); setState("idle"); stopMicRef.current?.(); },
    onModeChange: ({ mode }: { mode: string }) => {
      if (mode === "speaking") setState("speaking");
      else if (mode === "listening") setState("listening");
    },
  } as any);

  const active = state === "listening" || state === "speaking";

  // cronómetro de llamada
  useEffect(() => {
    if (!active) { setSec(0); return; }
    const id = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // fallback de estado listening/speaking por silencio del micro (si el SDK no emite modo)
  useEffect(() => {
    if (!active) return;
    const MIC_THRESHOLD = 0.04, SILENCE_MS = 800;
    const iv = setInterval(() => {
      if (ampRef.current > MIC_THRESHOLD) {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (stateRef.current === "speaking") setState("listening");
      } else if (!silenceTimerRef.current) {
        silenceTimerRef.current = window.setTimeout(() => {
          silenceTimerRef.current = null;
          if (stateRef.current === "listening") setState("speaking");
        }, SILENCE_MS);
      }
    }, 90);
    return () => { clearInterval(iv); if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; } };
  }, [active]);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(rafAudioRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null; audioCtxRef.current = null;
    setAmp(0);
  }, []);
  useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);
  useEffect(() => () => stopMic(), [stopMic]);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const actx = new AudioContext();
      audioCtxRef.current = actx;
      const analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      actx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        setAmp(Math.min(1, Math.sqrt(sum / data.length) * 4));
        rafAudioRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch (e) {
      console.error("[mic] permiso denegado", e);
      return false;
    }
  };

  const startCall = async () => {
    if (state !== "idle") return;
    setState("connecting");
    const ok = await startMic();
    if (!ok) { setState("idle"); alert("Necesitamos permiso de micrófono para hablar con iSabel."); return; }
    try {
      await conversation.startSession({ agentId: VOICE_AGENT_ID, connectionType: "webrtc" } as any);
    } catch (e) {
      console.error("[ElevenLabs] startSession falló", e);
      stopMic(); setState("idle");
    }
  };

  const endCall = async () => {
    try { await conversation.endSession(); } catch { /* noop */ }
    stopMic(); setState("idle");
  };

  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const accent = state === "listening" ? BRAND : state === "speaking" ? BLUE_LT : SIGNAL;
  const status =
    state === "connecting" ? "Conectando con iSabel…" :
    state === "listening"  ? "Te escucha — habla ahora" :
    state === "speaking"   ? "iSabel está respondiendo…" :
                             "Toca llamar y habla con iSabel";

  return (
    <div className="relative mx-auto max-w-[340px] rounded-[34px] p-3 shadow-2xl border border-white/10"
         style={{ background: "linear-gradient(160deg,#0c1a38,#0a1730)" }}>
      <div className="rounded-[26px] overflow-hidden" style={{ background: INK }}>
        {/* cabecera: foto real animada (Ken Burns) */}
        <div className="relative h-44 overflow-hidden">
          <img src="/landing/voice-headset.jpg" alt="Asesora de RealtyPlus"
               className={`w-full h-full object-cover object-center ${reduce ? "" : "animate-kenburns"}`} loading="lazy" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${INK}11, ${INK})` }} />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
            <span className="font-mono text-[10px] text-white/80">
              {active ? `EN LLAMADA · ${mm}:${ss}` : state === "connecting" ? "CONECTANDO…" : "AGENTE IA · 24/7"}
            </span>
          </div>
        </div>

        {/* avatar + estado */}
        <div className="px-6 pb-6 -mt-10 relative text-center">
          <div className="relative inline-block">
            <span className={`absolute inset-0 rounded-full opacity-30 ${active && !reduce ? "animate-ping" : ""}`} style={{ background: accent }} />
            <div className="relative w-20 h-20 rounded-full border-4 overflow-hidden transition-colors duration-300"
                 style={{ borderColor: active ? accent : INK }}>
              <img src="/landing/voice-headset.jpg" alt="iSabel · Voz IA" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
          <h3 className="mt-3 font-display font-bold text-white text-lg">iSabel · Voz IA</h3>
          <motion.p key={status} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-white/50 text-xs">{status}</motion.p>

          <div className="mt-4"><LiveWave amp={amp} active={active} color={accent} /></div>

          {/* controles reales */}
          <div className="mt-5 flex items-center justify-center gap-4">
            {state === "idle" ? (
              <button onClick={startCall} aria-label="Llamar a iSabel"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: SIGNAL, boxShadow: `0 10px 26px ${SIGNAL}55` }}>
                <PhoneCall className="w-4 h-4" aria-hidden="true" /> Llamar
              </button>
            ) : (
              <>
                <span className="w-11 h-11 rounded-full grid place-items-center bg-white/10 text-white/80"><Mic className="w-4 h-4" aria-hidden="true" /></span>
                <button onClick={endCall} aria-label="Terminar llamada" disabled={state === "connecting"}
                  className="w-14 h-14 rounded-full grid place-items-center text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: BRAND }}>
                  <PhoneOff className="w-5 h-5" aria-hidden="true" />
                </button>
                <span className="w-11 h-11 rounded-full grid place-items-center bg-white/10 text-white/80"><Volume2 className="w-4 h-4" aria-hidden="true" /></span>
              </>
            )}
          </div>

          <p className="mt-4 text-[10px] text-white/25 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: SIGNAL }} />
            Powered by ElevenLabs Conversational AI
          </p>
        </div>
      </div>
    </div>
  );
}

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

  // Efecto "hidro" (agua): el hero captura el mouse y lo pasa al canvas del ripple
  const rippleRef = useRef<HydroRippleHandle>(null);
  const heroLastPos = useRef({ x: -9999, y: -9999 });
  const onHeroEnter = useCallback((e: React.MouseEvent) => {
    rippleRef.current?.triggerSplash(e.clientX, e.clientY, "enter");
    heroLastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onHeroMove = useCallback((e: React.MouseEvent) => {
    const dx = e.clientX - heroLastPos.current.x;
    const dy = e.clientY - heroLastPos.current.y;
    if (dx * dx + dy * dy < 38 * 38) return;
    rippleRef.current?.triggerSplash(e.clientX, e.clientY, "trail");
    heroLastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

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

  const navLinks = [["#como", "Cómo funciona"], ["#funciones", "Funciones"], ["#voz", "Voz IA"], ["#reporte", "Reporte diario"], ["#faq", "FAQ"]];

  return (
    <div className="relative bg-white font-sans" style={{ color: INK }}>
      {/* Loading — logo encapsulado en tarjeta con barra de carga de marca */}
      <div
        className="fixed inset-0 z-50 grid place-items-center transition-opacity duration-500"
        style={{
          opacity: loaded ? 0 : 1,
          pointerEvents: loaded ? "none" : "all",
          background: "radial-gradient(130% 120% at 50% -10%, #eef3fb 0%, #ffffff 58%)",
        }}
        aria-hidden={loaded}
        role="status"
        aria-label="Cargando RealtyPlus"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="flex flex-col items-center gap-6 rounded-[28px] bg-white px-12 py-10 border border-slate-100"
          style={{ boxShadow: "0 24px 70px -24px rgba(2,27,77,0.28), 0 2px 8px -2px rgba(2,27,77,0.08)" }}
        >
          <img src={realtyplusLogo} alt="RealtyPlus" className="w-44 h-auto" width={176} height={68} />
          {/* barra de carga indeterminada (azul → rojo RE/MAX) */}
          <div className="w-44 h-1 rounded-full overflow-hidden" style={{ background: "#eef1f6" }}>
            {reduce ? (
              <div className="h-full w-1/2 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${BLUE}, ${BRAND})` }} />
            ) : (
              <motion.div
                className="h-full w-2/5 rounded-full"
                style={{ background: `linear-gradient(90deg, ${BLUE}, ${BRAND})` }}
                animate={{ x: ["-120%", "320%"] }}
                transition={{ repeat: Infinity, duration: 1.15, ease: "easeInOut" }}
              />
            )}
          </div>
        </motion.div>
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
        <section ref={heroRef} className="relative overflow-hidden" style={{ background: INK }}
                 aria-labelledby="hero-heading" onMouseEnter={onHeroEnter} onMouseMove={onHeroMove}>
          {/* fondo: imagen real con efecto HIDRO (agua) + overlay navy (legibilidad) */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <HydroRipple ref={rippleRef} src="/landing/hero-office.jpg" alt="" cover passthrough
                         className="absolute inset-0 w-full h-full" imgClassName="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: `linear-gradient(180deg, ${INK}cc 0%, ${INK}a6 48%, ${INK}e0 100%)` }} />
          </div>
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

                <h1 id="hero-heading" className="font-display font-extrabold text-white leading-[1.02] tracking-tight text-[2.6rem] sm:text-6xl"
                    style={{ textShadow: "0 2px 30px rgba(2,27,77,0.6)" }}>
                  <motion.span variants={heroItem} className="block">De un “hola” en WhatsApp</motion.span>
                  <motion.span variants={heroItem} className="block">
                    a una{" "}
                    <span className="font-serif italic font-medium tracking-normal text-[1.06em]" style={{ color: BRAND }}>
                      cita agendada
                    </span>.
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

        {/* ── Carrusel: IA aplicada a tus leads ── */}
        <section id="carrusel" className="py-24 px-6 bg-white" aria-labelledby="carr-heading">
          <div className="max-w-6xl mx-auto">
            <FadeSection className="max-w-2xl mb-10">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>IA aplicada a tus leads</span>
              <h2 id="carr-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
                Inteligencia que <Serif>trabaja tus contactos</Serif>.
              </h2>
              <p className="mt-4 text-slate-500 text-lg">De la primera respuesta al cierre, cada paso con datos e IA de por medio.</p>
            </FadeSection>
            <FadeSection><LeadsCarousel /></FadeSection>
          </div>
        </section>

        {/* ── Cómo funciona (secuencia real) ── */}
        <section id="como" className="py-24 px-6 bg-white" aria-labelledby="como-heading">
          <div className="max-w-7xl mx-auto">
            <FadeSection className="max-w-2xl mb-14">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>El recorrido de un lead</span>
              <h2 id="como-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
                Cuatro pasos, <Serif>cero trabajo manual</Serif>.
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
                Todo lo que de verdad usas, <Serif>en un solo lugar</Serif>.
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

        {/* ── Agente de voz (VoiceCRM) ── */}
        <section id="voz" className="py-24 px-6 relative overflow-hidden" style={{ background: INK }} aria-labelledby="voz-heading">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: BLUE }} aria-hidden="true" />
          <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <FadeSection>
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BLUE_LT }}>VoiceCRM · agente de voz</span>
              <h2 id="voz-heading" className="font-display font-bold text-3xl sm:text-4xl text-white mt-3 leading-tight">
                Tu asesora también <Serif>atiende por teléfono</Serif>.
              </h2>
              <p className="mt-5 text-white/60 text-lg leading-relaxed">
                iSabel no solo escribe: llama y contesta. Cualifica al lead por voz, resuelve dudas y agenda la visita
                — con la misma memoria de la conversación y el mismo criterio que en WhatsApp.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Atiende y realiza llamadas de cualificación",
                  "Voz natural en español, con el tono de tu marca",
                  "Agenda la visita y la confirma por WhatsApp",
                  "Cada llamada queda registrada en la ficha del lead",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-white/75 text-sm">
                    <Check className="w-4 h-4 shrink-0" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
                  </li>
                ))}
              </ul>
              <Magnetic className="mt-8" strength={0.3}>
                <Link to="/auth" className="group inline-flex items-center gap-2 px-7 py-3.5 font-bold text-white rounded-xl text-[15px] transition-transform hover:scale-[1.03]" style={{ background: BRAND, boxShadow: `0 12px 30px ${BRAND}40` }}>
                  <PhoneCall className="w-4 h-4" aria-hidden="true" />
                  Probar VoiceCRM
                </Link>
              </Magnetic>
            </FadeSection>

            <FadeSection delay={0.1}>
              <VoiceCallLive />
            </FadeSection>
          </div>
        </section>

        {/* ── Reporte diario (lo que construimos) ── */}
        <section id="reporte" className="py-24 px-6" style={{ background: INK }} aria-labelledby="rep-heading">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <FadeSection>
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BLUE_LT }}>Automático · 08:00</span>
              <h2 id="rep-heading" className="font-display font-bold text-3xl sm:text-4xl text-white mt-3 leading-tight">
                <Serif>Cada mañana</Serif>, los leads del día en tu correo.
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
              <h2 id="faq-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3">Lo que <Serif>sueles preguntar</Serif>.</h2>
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
                  <br />Tú dedícate a <Serif className="font-semibold">cerrar</Serif>.
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

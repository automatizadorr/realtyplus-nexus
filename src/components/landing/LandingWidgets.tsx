import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import {
  MessageSquare, Tags, Megaphone, ScanLine, Mic,
  FileSpreadsheet, LayoutDashboard, CalendarCheck, Sparkles,
  ChevronLeft, ChevronRight, Check, Phone,
} from "lucide-react";
import { INK, INK2, BLUE, BLUE_LT, BRAND, SIGNAL, HOT, EASE } from "./landing-helpers";

// ── Datos de contenido ────────────────────────────────────────────────────────
const THREAD = [
  { from: "lead",  text: "Hola, vi el mensaje sobre la franquicia 👀" },
  { from: "sofia", text: "¡Claro! Te cuento. ¿Buscas empezar tú solo o montar oficina con equipo?" },
  { from: "lead",  text: "con equipo, estoy en Madrid" },
  { from: "sofia", text: "Perfecto, eso encaja con el modelo QUARTZ. ¿Te agendo una reunión el jueves a las 10:00?" },
  { from: "lead",  text: "sí, me viene bien" },
];

export const STEPS = [
  { k: "01", title: "Llega el mensaje", desc: "WhatsApp, campaña o web — todo entra a un inbox unificado. Ningún lead se pierde a las 11 de la noche.", icon: MessageSquare },
  { k: "02", title: "Sofía responde y agenda", desc: "La IA contesta en segundos con tu conocimiento de marca, califica al lead y agenda la reunión en tu calendario.", icon: Sparkles },
  { k: "03", title: "Se etiqueta por intención", desc: "Cada conversación queda clasificada: cita agendada, solo quiere propiedades, no interesa… Sabes quién está caliente.", icon: Tags },
  { k: "04", title: "Reporte a jefatura · 08:00", desc: "Cada mañana, un informe consolidado de los leads del día agrupados por etiqueta. Automático, sin abrir el panel.", icon: CalendarCheck },
];

export const FEATURES = [
  { title: "Inbox unificado", desc: "Todas tus conversaciones de WhatsApp en un solo panel, con notas, búsqueda y respuestas rápidas.", icon: MessageSquare },
  { title: "Sofía · Asesora con IA", desc: "Responde 24/7 con memoria de la conversación, tu base de conocimiento y agenda en Google Calendar.", icon: Sparkles },
  { title: "Etiquetado inteligente", desc: "La IA clasifica cada lead por intención de compra automáticamente. Tú solo trabajas a los calientes.", icon: Tags },
  { title: "Campañas segmentadas", desc: "Envía mensajes personalizados a miles de contactos por país, etiqueta o estado, sin copiar y pegar.", icon: Megaphone },
  { title: "Scanner de leads", desc: "Importa tu base desde Excel o CSV; deduplica y deja todo listo para contactar en minutos.", icon: ScanLine },
  { title: "VoiceCRM", desc: "Un agente de voz que atiende y cualifica por llamada, integrado al mismo flujo de leads.", icon: Mic },
  { title: "Exportar y reportar", desc: "Descarga leads y conversaciones en Excel, Word o HTML, o envíalos a expansión con un clic.", icon: FileSpreadsheet },
  { title: "Dashboard en vivo", desc: "Leads del día, calientes, citas y tasa de respuesta — todo en tiempo real.", icon: LayoutDashboard },
];

export const REPORT_TAGS = [
  { name: "Cita agendada", count: 6, color: BLUE_LT },
  { name: "Solo quiere propiedades", count: 9, color: "#3b82f6" },
  { name: "Sin respuesta clara", count: 4, color: HOT },
  { name: "No interesa", count: 2, color: "#94a3b8" },
];

export const FAQS = [
  { q: "¿Usa mi número de WhatsApp actual?", a: "Sí. Sofía se conecta a tu WhatsApp existente y le agrega respuestas automáticas, agenda y clasificación. Sigues con el mismo número de siempre." },
  { q: "¿La IA agenda reuniones de verdad?", a: "Sí. Cuando el lead confirma día y hora, Sofía crea el evento en tu Google Calendar (con un mínimo de 18 horas de antelación) y envía la invitación por correo." },
  { q: "¿Cómo clasifica los leads?", a: "Lee la conversación y le asigna un estado por intención: Cita agendada, Solo quiere propiedades, No interesa, Sigue en campaña… Así sabes de un vistazo quién está caliente." },
  { q: "¿Recibo un resumen de los leads?", a: "Cada mañana a las 08:00 (hora de Madrid) recibes un reporte consolidado con los leads del día, agrupados por etiqueta y con sus conversaciones. Sin abrir el panel." },
  { q: "¿Necesito saber de tecnología?", a: "No. Si sabes usar WhatsApp, sabes usar RealtyPlus. El inbox, las campañas y los reportes están pensados para agentes, no para técnicos." },
  { q: "¿Mis datos están seguros?", a: "Tus conversaciones y leads viven en tu propia base con control de acceso por roles (RLS). No vendemos ni compartimos datos de tus clientes." },
];

const SLIDES = [
  { img: "/landing/data-analytics.jpg", tag: "Datos en vivo",  title: "Cada lead, medido",              desc: "Score, intención y actividad de cada contacto en tiempo real." },
  { img: "/landing/leads-team.jpg",     tag: "Tu equipo",      title: "Todo el equipo, un solo inbox",  desc: "Nadie pisa una conversación; cada agente sabe qué le toca." },
  { img: "/landing/ai-chip.jpg",        tag: "Inteligencia",   title: "IA entrenada en tu negocio",     desc: "Sofía responde con tu conocimiento de marca, no con respuestas genéricas." },
  { img: "/landing/closing-deal.jpg",   tag: "Resultado",      title: "Del primer «hola» al cierre",    desc: "Menos tareas manuales, más reuniones agendadas cada semana." },
  { img: "/landing/realestate.jpg",     tag: "Inmobiliario",   title: "Pensado para vender propiedades", desc: "Flujos, etiquetas y reportes hechos a la medida del sector." },
];

// ── Componentes ───────────────────────────────────────────────────────────────
export function LiveConversation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setStep(THREAD.length); return; }
    setStep(0);
    const id = setInterval(() => setStep((s) => (s >= THREAD.length ? s : s + 1)), 1400);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const agendada = step >= THREAD.length;

  return (
    <div ref={ref} className="relative w-full max-w-md mx-auto">
      <div className="absolute -top-5 -right-3 z-20 sm:right-2">
        <div className="rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur transition-colors duration-500"
             style={{ background: "rgba(255,255,255,0.96)", borderColor: agendada ? `${BLUE}66` : "#e5e7eb" }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors duration-500"
                  style={{ background: agendada ? `${BLUE}1f` : "#f1f5f9", color: agendada ? BLUE : "#64748b" }}>
              {agendada ? "CITA AGENDADA" : "SIGUE EN CAMPAÑA"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="font-mono text-[10px]" style={{ color: INK }}>
              score <b style={{ color: agendada ? BLUE : HOT }}>{agendada ? "92" : "—"}</b>
            </span>
            <span className="font-mono text-[10px] text-slate-400">{agendada ? "jue · 10:00" : "esperando…"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-white/10 bg-[#0b1730] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: INK2 }}>
          <div className="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-sm shrink-0"
               style={{ background: `linear-gradient(135deg, ${BRAND}, ${INK})` }}>So</div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight">Sofía · Asesora IA</div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: SIGNAL }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SIGNAL }} />en línea
            </div>
          </div>
          <span className="ml-auto font-mono text-[10px] text-white/30">WhatsApp</span>
        </div>

        <div className="px-3.5 py-4 space-y-2.5 min-h-[300px]"
             style={{ background: "linear-gradient(180deg,#0b1730,#0d1c3a)" }}>
          {THREAD.slice(0, step).map((m, i) => {
            const lead = m.from === "lead";
            return (
              <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}
                          className={`flex ${lead ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] px-3.5 py-2 text-[13px] leading-snug rounded-2xl"
                     style={lead
                       ? { background: SIGNAL, color: "#06251a", borderBottomRightRadius: 4 }
                       : { background: "#ffffff", color: INK, borderBottomLeftRadius: 4 }}>
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
          {agendada && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={reduce ? undefined : { type: "spring", stiffness: 210, damping: 20, delay: 0.2 }} className="pt-1.5">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl">
                <img src="/landing/appointment.jpg" alt="Reunión de expansión agendada"
                     className={`w-full h-32 object-cover object-[center_78%] ${reduce ? "" : "animate-kenburns"}`} loading="lazy" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(2,27,77,0.12) 0%, ${INK}f2 100%)` }} />
                <motion.div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full grid place-items-center shadow-lg"
                            style={{ background: BLUE }} initial={reduce ? false : { scale: 0, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={reduce ? undefined : { type: "spring", stiffness: 400, damping: 13, delay: 0.5 }}>
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  {!reduce && (
                    <motion.span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${BLUE_LT}` }}
                                 initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.9, opacity: 0 }}
                                 transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.7 }} />
                  )}
                </motion.div>
                <motion.div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2.5"
                            initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={reduce ? undefined : { duration: 0.4, delay: 0.45, ease: EASE }}>
                  <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${BLUE}e6` }}>
                    <CalendarCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-[13px] font-semibold leading-tight">Reunión confirmada</div>
                    <div className="font-mono text-[10px] text-white/70">jueves · 10:00 · Google Calendar</div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all duration-500"
           style={{ background: agendada ? `${BLUE}1f` : "rgba(255,255,255,0.04)", borderColor: agendada ? `${BLUE_LT}55` : "rgba(255,255,255,0.1)" }}>
        <CalendarCheck className="w-4 h-4 shrink-0" style={{ color: agendada ? BLUE_LT : "#64748b" }} />
        <span className="text-[12px]" style={{ color: agendada ? "#bcd0ff" : "rgba(255,255,255,0.5)" }}>
          {agendada ? "Reunión creada en Google Calendar · lead enviado al reporte de jefatura" : "Sofía está calificando al lead…"}
        </span>
      </div>
    </div>
  );
}

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button className="w-full flex items-center justify-between gap-4 py-5 text-left"
              onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-semibold text-[15px]" style={{ color: INK }}>{q}</span>
        <ChevronLeft className={`w-5 h-5 shrink-0 transition-transform duration-200 -rotate-90 ${open ? "rotate-90" : ""}`} style={{ color: BRAND }} />
      </button>
      {open && <p className="pb-5 -mt-1 text-[14px] leading-relaxed text-slate-500">{a}</p>}
    </div>
  );
}

const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

export function WhatsAppFloat() {
  return (
    <a href="https://wa.me/56971806730" target="_blank" rel="noopener noreferrer"
       aria-label="Escríbenos por WhatsApp"
       className="fixed bottom-6 right-6 z-40 flex w-14 h-14 rounded-full items-center justify-center shadow-lg transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
       style={{ background: SIGNAL, boxShadow: `0 10px 30px ${SIGNAL}55` }}>
      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: SIGNAL }} />
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white relative z-10" aria-hidden="true">
        <path d={WA_PATH} />
      </svg>
    </a>
  );
}

export function LeadsCarousel() {
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
    <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#0b1730] aspect-[16/10] sm:aspect-[16/9]"
         onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <AnimatePresence>
        <motion.div key={idx} className="absolute inset-0 will-change-transform"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: EASE }}
                    drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15}
                    onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}>
          <img src={s.img} alt={s.title}
               className={`w-full h-full object-cover select-none pointer-events-none ${reduce ? "" : "animate-kenburns"}`}
               loading="lazy" draggable={false} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `linear-gradient(180deg, ${INK}22 0%, ${INK}00 32%, ${INK}e6 100%)` }} />
      <div className="absolute left-0 bottom-0 p-6 sm:p-9 max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.5, ease: EASE }}>
            <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3 text-white"
                  style={{ background: BRAND }}>{s.tag}</span>
            <h3 className="font-display font-bold text-white text-2xl sm:text-3xl leading-tight">{s.title}</h3>
            <p className="mt-2 text-white/70 text-sm sm:text-[15px] leading-relaxed">{s.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <button aria-label="Imagen anterior" onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>
      <button aria-label="Imagen siguiente" onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
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

export function WaLink() {
  return (
    <a href="https://wa.me/56971806730" target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 transition-colors hover:text-white"
       style={{ borderColor: SIGNAL, color: "#15803d" }}
       onMouseEnter={(e) => (e.currentTarget.style.background = SIGNAL)}
       onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <Phone className="w-4 h-4" aria-hidden="true" />¿Otra pregunta? Escríbenos por WhatsApp
    </a>
  );
}

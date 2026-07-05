import { motion } from "framer-motion";
import { MessageCircle, Zap, Globe2, Users, CheckCheck } from "lucide-react";

const NAVY = "#003DA5";
const RED = "#DC1C2E";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const STATS = [
  { icon: Users, value: "1.800+", label: "Agentes" },
  { icon: Globe2, value: "14", label: "Países" },
  { icon: Zap, value: "24/7", label: "Sofía IA" },
];

const MESSAGES = [
  { from: "bot", text: "¡Hola Juan! 👋 Vi que estás buscando piso en Madrid. ¿Cuándo podemos hablar?" },
  { from: "user", text: "Hola, sí! Me interesa el de la calle Serrano." },
  { from: "bot", text: "Perfecto, tengo un hueco mañana a las 10:00. ¿Te viene bien?" },
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: NAVY, opacity: 0.5 }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function CrmMockup() {
  return (
    <motion.div
      className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,61,165,0.10)" }}
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Header de la card */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ background: `linear-gradient(135deg, ${NAVY}, #1a5ccc)` }}>
            So
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Sofía IA</p>
            <p className="text-[10px] text-emerald-500 font-medium">en línea ahora</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: RED }}>
            🔥 Caliente
          </span>
        </div>
      </div>

      {/* Conversación */}
      <div className="px-4 py-3 space-y-2.5 min-h-[170px]">
        {/* Lead info */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">JT</div>
          <div>
            <p className="text-xs font-semibold text-slate-800">Juan Torres</p>
            <p className="text-[10px] text-slate-400">+34 612 345 678 · Madrid</p>
          </div>
          <CheckCheck className="ml-auto h-3.5 w-3.5 text-blue-400" />
        </div>

        {MESSAGES.map((msg, i) => (
          <motion.div
            key={i}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.35 + 0.3, duration: 0.4, ease: EASE }}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[11px] leading-relaxed shadow-sm`}
              style={
                msg.from === "bot"
                  ? { background: `rgba(0,61,165,0.07)`, color: "#1e293b" }
                  : { background: NAVY, color: "white" }
              }
            >
              {msg.text}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <motion.div
          className="flex justify-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <div className="rounded-2xl px-3 py-2 shadow-sm" style={{ background: "rgba(0,61,165,0.07)" }}>
            <TypingDots />
          </div>
        </motion.div>
      </div>

      {/* Footer de la card */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5 text-slate-300" />
        <div className="flex-1 h-6 rounded-full bg-slate-100 flex items-center px-3">
          <span className="text-[10px] text-slate-400">Responder como Sofía…</span>
        </div>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ background: RED }}>
          ↑
        </div>
      </div>
    </motion.div>
  );
}

export function BrandShowcase() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Imagen de fondo — cuadrícula geométrica clara */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1, 1.04] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
      >
        <img
          src="/landing/tech-grid.jpg"
          alt=""
          aria-hidden
          className="w-full h-full object-cover object-center"
          style={{ opacity: 0.55 }}
        />
      </motion.div>

      {/* Overlay de color RE/MAX: tinte navy muy sutil + gradiente */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, rgba(0,61,165,0.08) 0%, rgba(255,255,255,0.60) 45%, rgba(220,28,46,0.04) 100%)",
        }}
      />

      {/* Gradiente de viñeta lateral */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(248,250,252,0.75) 100%)",
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 h-full flex flex-col justify-between p-10 lg:p-12">

        {/* Cabecera */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ color: NAVY, opacity: 0.6 }}>
            <span className="block h-px w-8" style={{ background: RED }} />
            Red Internacional
          </div>
          <h2 className="text-3xl lg:text-4xl font-display font-extrabold leading-tight" style={{ color: NAVY }}>
            Tu equipo IA que{" "}
            <span className="font-serif italic font-normal" style={{ color: RED }}>nunca duerme.</span>
          </h2>
          <p className="mt-3 text-sm font-sans text-slate-500 max-w-xs leading-relaxed">
            Sofía gestiona tus leads 24/7 por WhatsApp, los clasifica con IA y te avisa cuando están listos para cerrar.
          </p>
        </motion.div>

        {/* Mockup central */}
        <motion.div
          className="flex justify-center my-6"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: EASE }}
        >
          <CrmMockup />
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {STATS.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i + 0.4, duration: 0.5, ease: EASE }}
              className="rounded-xl p-3 text-center hover:-translate-y-0.5 transition-transform"
              style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,61,165,0.08)", boxShadow: "0 2px 12px rgba(0,61,165,0.06)" }}
            >
              <Icon className="h-4 w-4 mx-auto mb-1.5" style={{ color: RED }} />
              <p className="text-xl font-display font-extrabold tracking-tight" style={{ color: NAVY }}>{value}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

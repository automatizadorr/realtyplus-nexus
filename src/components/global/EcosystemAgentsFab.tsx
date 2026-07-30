import { useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mic } from "lucide-react";

// Lazy: el chat de Sofía y (sobre todo) el modal de voz cargan el SDK de
// ElevenLabs (~490 KB). Se difieren hasta el primer clic para no pesar en el
// bundle inicial de las páginas públicas.
const SofiaChatPanel = lazy(() =>
  import("@/components/global/SofiaChatPanel").then(m => ({ default: m.SofiaChatPanel })));
const VoiceAgentModal = lazy(() =>
  import("@/components/global/VoiceAgentModal").then(m => ({ default: m.VoiceAgentModal })));

const WA_URL =
  "https://api.whatsapp.com/send?phone=56930620321&text=Hola,%20necesito%20asesor%C3%ADa%20experta%20en%20Lex%20House";

// Foto del agente Lex — misma que usa la landing (Pexels, licencia libre).
const AGENT_PHOTO =
  "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop&facepad=3";

// Foto de Sofía — misma que usa la landing (Pexels #774909, licencia libre).
const SOFIA_PHOTO =
  "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop&facepad=3";

const AZABACHE = "#0B0B0F"; // negro azabache
const GOLD     = "#D4AF37";

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Ícono WhatsApp (SVG oficial) ─────────────────────────────────────────────
function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tip({ title, sub }: { title: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.94 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="absolute right-full mr-3.5 flex flex-col whitespace-nowrap rounded-2xl border border-white/10 bg-[#060c1a]/95 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
      style={{ pointerEvents: "none" }}
    >
      <span className="text-[13px] font-bold text-white">{title}</span>
      <span className="mt-0.5 font-mono text-[10px] text-white/45">{sub}</span>
      {/* Flecha */}
      <div className="absolute right-[-5px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rotate-45 rounded-sm border-r border-t border-white/10 bg-[#060c1a]/95" />
    </motion.div>
  );
}

// ── Botón flotante individual ─────────────────────────────────────────────────
function FloatBtn({
  children, color, glow, onClick, href, label, tip, sub, delay, reduce,
}: {
  children: React.ReactNode;
  color: string;
  glow: string;
  onClick?: () => void;
  href?: string;
  label: string;
  tip: string;
  sub: string;
  delay: number;
  reduce: boolean | null;
}) {
  const [hover, setHover] = useState(false);

  const inner = (
    <>
      {/* Pulse ring */}
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-2xl"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 1.38], opacity: [0.28, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {children}
    </>
  );

  const shared = {
    "aria-label": label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    className:
      "relative flex h-14 w-14 sm:h-[60px] sm:w-[60px] items-center justify-center rounded-2xl text-white",
    style: {
      background: color,
      boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 8px 28px ${glow}`,
    } as React.CSSProperties,
  };

  return (
    <div className="relative flex items-center">
      <AnimatePresence>{hover && <Tip title={tip} sub={sub} />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
      >
        {href ? (
          // eslint-disable-next-line react/jsx-no-target-blank
          <a href={href} target="_blank" rel="noopener noreferrer" {...shared}>
            {inner}
          </a>
        ) : (
          <button type="button" onClick={onClick} {...shared}>
            {inner}
          </button>
        )}
      </motion.div>
    </div>
  );
}

// ── Burbuja del Agente de Voz (ElevenLabs) — medallón blanco con anillo azabache ─
function VoiceBubble({
  onClick, delay, reduce,
}: {
  onClick: () => void;
  delay: number;
  reduce: boolean | null;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div className="relative flex items-center">
      <AnimatePresence>
        {hover && <Tip title="Habla con Lex" sub="Agente de voz · En vivo" />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        className="relative"
      >
        {/* Latido dorado "en vivo" (anillo que se expande) */}
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: GOLD }}
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label="Hablar con el agente de voz Lex"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-[60px] sm:w-[60px]"
          style={{
            boxShadow: `0 0 0 3px ${AZABACHE}, 0 8px 26px rgba(11,11,15,0.42)`,
            ["--tw-ring-color" as string]: AZABACHE,
          } as React.CSSProperties}
        >
          {/* Foto del agente Lex al medio */}
          <img
            src={AGENT_PHOTO}
            alt=""
            draggable={false}
            loading="lazy"
            className="h-full w-full rounded-full object-cover object-top p-[3px]"
          />

          {/* Badge de micrófono — comunica que es por voz */}
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white"
            style={{ backgroundColor: AZABACHE }}
          >
            <Mic className="h-3 w-3 text-white" />
          </span>
        </button>
      </motion.div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
// Trae los 3 agentes IA del ecosistema LexHouse (voz Lex, chat Sofía, WhatsApp)
// a las páginas públicas de captación de este sitio.
export function EcosystemAgentsFab() {
  const location = useLocation();
  const reduce   = useReducedMotion();

  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatLoaded,  setChatLoaded]  = useState(false);
  const [voiceOpen,   setVoiceOpen]   = useState(false);
  const [voiceLoaded, setVoiceLoaded] = useState(false);

  // Visible solo en las páginas públicas de captación (no en /auth ni el área logueada).
  const p = location.pathname;
  const visible = p === "/" || p.startsWith("/blog");

  if (!visible) return null;

  const bottomPx = 20;

  return (
    <>
      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3 sm:right-6"
        style={{ bottom: bottomPx }}
      >
        {/* Agente de Voz (ElevenLabs) — arriba de todo */}
        <VoiceBubble onClick={() => { setVoiceLoaded(true); setVoiceOpen(true); }} delay={0} reduce={reduce} />

        {/* Chat de texto con Sofía (IA) */}
        <FloatBtn
          color="linear-gradient(135deg,#003DA5 0%,#1a56db 100%)"
          glow="rgba(0,61,165,0.55)"
          onClick={() => { setChatLoaded(true); setChatOpen((v) => !v); }}
          label="Abrir chat con Sofía"
          tip="Chatea con Sofía"
          sub="Asistente IA · Escríbenos"
          delay={0.1}
          reduce={reduce}
        >
          <img
            src={SOFIA_PHOTO}
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute inset-0 h-full w-full rounded-2xl object-cover object-top p-[3px]"
          />
        </FloatBtn>

        {/* WhatsApp */}
        <FloatBtn
          color="linear-gradient(135deg,#25D366 0%,#128C7E 100%)"
          glow="rgba(37,211,102,0.45)"
          href={WA_URL}
          label="Contactar por WhatsApp con Camil-AI"
          tip="Camil-AI"
          sub="Agente WhatsApp · en línea"
          delay={0.22}
          reduce={reduce}
        >
          {/* Foto de la agente + badge con el logo de WhatsApp para diferenciarla */}
          <img
            src="/agente-whatsapp.webp"
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute inset-0 h-full w-full rounded-2xl object-cover object-top p-[3px]"
          />
          <span
            className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <WhatsAppIcon size={13} />
          </span>
        </FloatBtn>
      </div>

      {/* Panel de chat de Sofía — se monta al primer uso */}
      {chatLoaded && (
        <Suspense fallback={null}>
          <SofiaChatPanel
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            bottomOffset={bottomPx + 148}
          />
        </Suspense>
      )}

      {/* Modal del Agente de Voz (ElevenLabs) — se monta al primer uso */}
      {voiceLoaded && (
        <Suspense fallback={null}>
          <VoiceAgentModal open={voiceOpen} onOpenChange={setVoiceOpen} />
        </Suspense>
      )}
    </>
  );
}

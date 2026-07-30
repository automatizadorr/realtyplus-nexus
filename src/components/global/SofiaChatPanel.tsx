import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AGENT_PHOTO =
  "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&facepad=3";
const EASE = [0.16, 1, 0.3, 1] as const;

const WELCOME =
  "¡Hola! 👋 Soy Sofía, tu asistente de LexHouse. ¿En qué te ayudo? Puedo contarte sobre los módulos IA, planes y precios, o cómo empezar.";

const QUICK = [
  "¿Cuánto cuesta?",
  "¿Cómo funciona el agente de WhatsApp?",
  "¿Qué incluye el plan gratis?",
  "¿En cuánto tiempo está listo?",
];

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Distancia desde el fondo (sube cuando hay barra de propiedades). */
  bottomOffset?: number;
}

export function SofiaChatPanel({ open, onClose, bottomOffset = 160 }: Props) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // En móvil el panel es una hoja casi completa; en desktop, tarjeta flotante.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const showQuick = messages.length <= 1 && !loading;

  // Auto-scroll al final cuando llega un mensaje
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Foco al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("sofia-chat", {
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      const reply = (data as { reply?: string })?.reply;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || "Disculpa, no pude responder. ¿Puedes reformular tu pregunta? También puedes escribirnos por WhatsApp." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Uy, tuve un problema para responder 😅. Intenta de nuevo en un momento o escríbenos por WhatsApp." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[9997]"
            style={{ background: "rgba(6,12,26,0.45)", backdropFilter: "blur(2px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            className={`fixed z-[9998] flex flex-col overflow-hidden bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] ${
              isMobile
                ? "inset-x-2.5 rounded-2xl"
                : "right-6 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl"
            }`}
            style={
              isMobile
                ? {
                    // Hoja anclada abajo que SIEMPRE cabe (respeta el notch inferior).
                    bottom: "max(0.625rem, env(safe-area-inset-bottom))",
                    height: "min(600px, calc(100dvh - 1.25rem))",
                  }
                : {
                    // Tarjeta flotante: la altura descuenta el offset para no cortarse arriba.
                    bottom: bottomOffset,
                    height: `min(560px, calc(100dvh - ${bottomOffset + 24}px))`,
                  }
            }
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 bg-[#003DA5] px-4 py-3.5">
              <div className="relative shrink-0">
                <img src={AGENT_PHOTO} alt="Sofía"
                  className="h-9 w-9 rounded-full border-2 border-white/30 object-cover object-top"
                  loading="lazy" draggable={false} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#003DA5] bg-emerald-400">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-white">Sofía · Asistente IA</p>
                <p className="font-mono text-[9px] text-white/55">● En línea · Responde al instante</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar chat"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  {m.role === "assistant" && (
                    <img src={AGENT_PHOTO} alt="" className="h-6 w-6 shrink-0 rounded-full border border-[#003DA5]/15 object-cover object-top" loading="lazy" draggable={false} />
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-sm bg-[#003DA5] text-white"
                      : "rounded-bl-sm border border-slate-100 bg-white text-slate-700"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {/* Typing */}
              {loading && (
                <div className="flex items-end gap-2">
                  <img src={AGENT_PHOTO} alt="" className="h-6 w-6 shrink-0 rounded-full border border-[#003DA5]/15 object-cover object-top" loading="lazy" draggable={false} />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="h-2 w-2 rounded-full bg-slate-400"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick replies */}
              {showQuick && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => send(q)}
                      className="rounded-full border border-[#003DA5]/20 bg-white px-3 py-1.5 text-[12px] font-medium text-[#003DA5] transition-colors hover:bg-[#003DA5]/6">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white px-3 py-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta…"
                maxLength={1500}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] text-slate-700 outline-none transition-colors focus:border-[#003DA5]/40 focus:bg-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003DA5] text-white transition-all hover:bg-[#002d7a] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            {/* Pie */}
            <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/60 py-1.5">
              <Sparkles className="h-2.5 w-2.5 text-[#D4AF37]" />
              <span className="font-mono text-[9px] text-slate-400">Asistente IA de LexHouse</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

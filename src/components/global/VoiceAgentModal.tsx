import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Phone, PhoneOff } from "lucide-react";

// Agente de voz Lex del ecosistema LexHouse (el mismo que usa VoiceCallLive, ya
// habilitado para estos dominios). El de la landing (6801…) no conecta aquí.
const VOICE_AGENT_ID = "agent_2401ksxkp4fgfw0vwt0yt1tnz7r2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const aiMaxLogo = { url: "https://raw.githubusercontent.com/automatizadorr/imagenes-y-videos-para-sitios-web/main/logo%20lexhouse2026.jpg" };

interface VoiceAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Audio Wave Visualization Component (navy/red palette)
function AudioWaves({
  isActive,
  isSpeaking,
  getOutputVolume,
  getInputVolume,
}: {
  isActive: boolean;
  isSpeaking: boolean;
  getOutputVolume: () => number;
  getInputVolume: () => number;
}) {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0.1));
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive) {
      setBars(Array(20).fill(0.1));
      return;
    }

    const animate = () => {
      const volume = isSpeaking ? getOutputVolume() : getInputVolume();
      const baseHeight = Math.max(0.1, volume);

      setBars(prev => prev.map((_, i) => {
        const centerDistance = Math.abs(i - 9.5) / 9.5;
        const randomFactor = 0.3 + Math.random() * 0.7;
        const waveOffset = Math.sin(Date.now() / 200 + i * 0.5) * 0.3;
        return Math.min(1, Math.max(0.1,
          baseHeight * (1 - centerDistance * 0.5) * randomFactor + waveOffset * baseHeight
        ));
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, isSpeaking, getOutputVolume, getInputVolume]);

  return (
    <div className="flex items-center justify-center gap-1 h-32 w-full">
      {bars.map((height, i) => {
        // Carve out center for the logo by collapsing the middle bars
        const centerDistance = Math.abs(i - 9.5);
        const isCenterGap = centerDistance < 3;
        return (
          <motion.div
            key={i}
            className={`w-2 rounded-full ${
              isSpeaking
                ? "bg-gradient-to-t from-[#DC1C2E] to-[#ff5566]"
                : "bg-gradient-to-t from-[#003DA5] to-[#3b82f6]"
            }`}
            animate={{
              height: isCenterGap ? "0%" : `${height * 100}%`,
              opacity: isCenterGap ? 0 : isActive ? 0.8 + height * 0.2 : 0.3,
            }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}


// Pulsing Rings Animation (navy/red)
function PulsingRings({ isActive, isSpeaking }: { isActive: boolean; isSpeaking: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full border-2 ${
            isSpeaking ? "border-[#DC1C2E]/30" : "border-[#003DA5]/30"
          }`}
          initial={{ width: 100, height: 100, opacity: 0 }}
          animate={isActive ? {
            width: [100, 200 + i * 50],
            height: [100, 200 + i * 50],
            opacity: [0.6, 0],
          } : { width: 100, height: 100, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
// Reactive logo — driven by ref (no re-renders) with exponential smoothing for flicker-free sync
function ReactiveLogo({
  src,
  isActive,
  isSpeaking,
  getOutputVolume,
  getInputVolume,
}: {
  src: string;
  isActive: boolean;
  isSpeaking: boolean;
  getOutputVolume: () => number;
  getInputVolume: () => number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const smoothedRef = useRef(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (!isActive) {
      smoothedRef.current = 0;
      wrapper.style.transform = "translate(-50%, -50%) scale(1)";
      return;
    }

    const tick = () => {
      let v = 0;
      try {
        v = isSpeaking ? getOutputVolume() : getInputVolume();
      } catch {
        v = 0;
      }
      if (!Number.isFinite(v)) v = 0;
      // Exponential smoothing eliminates flicker and keeps perfect lock with the bars
      smoothedRef.current = smoothedRef.current * 0.78 + v * 0.22;
      const scale = 1 + Math.min(0.28, smoothedRef.current * 0.5);
      wrapper.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, isSpeaking, getOutputVolume, getInputVolume]);

  const ringColor = isSpeaking ? "#DC1C2E" : "#003DA5";

  return (
    <div
      ref={wrapperRef}
      className="absolute top-1/2 left-1/2 pointer-events-none will-change-transform"
      style={{ transform: "translate(-50%, -50%) scale(1)" }}
    >
      <div
        className="relative w-20 h-20 rounded-full overflow-hidden bg-white flex items-center justify-center"
        style={{
          boxShadow: `0 0 0 3px ${ringColor}33, 0 0 24px ${ringColor}55, 0 8px 24px rgba(10,31,77,0.18)`,
          transition: "box-shadow 0.2s ease-out",
        }}
      >
        <img src={src} alt="LexHouse AI" className="w-full h-full object-cover" draggable={false} />
      </div>
    </div>
  );
}


function VoiceAgentModalInner({ open, onOpenChange }: VoiceAgentModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setIsConnecting(false);
      setError(null);
    },
    onDisconnect: () => {},
    onError: (err) => {
      console.error("Voice agent error:", err);
      setError("Error de conexión. Por favor, intenta de nuevo.");
      setIsConnecting(false);
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: VOICE_AGENT_ID,
        connectionType: "webrtc",
      } as any);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Permiso de micrófono denegado. Habilita el micrófono para usar el agente de voz.");
      } else {
        setError("No se pudo iniciar la conversación. Por favor, intenta de nuevo.");
      }
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const handleClose = useCallback(() => {
    if (conversation.status === "connected") {
      stopConversation();
    }
    onOpenChange(false);
  }, [conversation.status, stopConversation, onOpenChange]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-[#0a1f4d] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center flex items-center justify-center gap-3">
            <img src={aiMaxLogo.url} alt="Ley-IA" className="w-10 h-10 object-contain" />
            <span>
              Asistente de Voz{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#003DA5] to-[#DC1C2E]">
                Ley-IA
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative py-8 min-h-[220px] flex flex-col items-center justify-center">
          <PulsingRings isActive={isConnected} isSpeaking={isSpeaking} />

          <div className="relative z-10 w-full flex items-center justify-center">
            <AudioWaves
              isActive={isConnected}
              isSpeaking={isSpeaking}
              getOutputVolume={conversation.getOutputVolume}
              getInputVolume={conversation.getInputVolume}
            />
            {/* Reactive logo perfectly fused & synced with the waves */}
            <ReactiveLogo
              src={aiMaxLogo.url}
              isActive={isConnected}
              isSpeaking={isSpeaking}
              getOutputVolume={conversation.getOutputVolume}
              getInputVolume={conversation.getInputVolume}
            />
          </div>


          <div className="text-center mt-6 space-y-2">
            <AnimatePresence mode="wait">
              {isConnecting ? (
                <motion.p key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-500">
                  Conectando con el asistente...
                </motion.p>
              ) : isConnected ? (
                <motion.div key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                  <p className={`font-medium ${isSpeaking ? "text-[#DC1C2E]" : "text-[#003DA5]"}`}>
                    {isSpeaking ? "🎙️ Ley-IA está hablando..." : "🎤 Te escucho..."}
                  </p>
                  <p className="text-sm text-slate-500">
                    Habla naturalmente para consultar sobre inmuebles, precios o servicios
                  </p>
                </motion.div>
              ) : error ? (
                <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[#DC1C2E] text-sm">
                  {error}
                </motion.p>
              ) : (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-500">
                  Presiona el botón para hablar con Ley-IA
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-center gap-4 pb-4">
          {!isConnected ? (
            <Button
              size="lg"
              onClick={startConversation}
              disabled={isConnecting}
              className="bg-gradient-to-r from-[#003DA5] to-[#0052cc] hover:from-[#002d7a] hover:to-[#003DA5] text-white rounded-full h-16 w-16 p-0 shadow-lg shadow-[#003DA5]/30"
            >
              {isConnecting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Mic className="w-6 h-6" />
                </motion.div>
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={stopConversation}
              className="bg-[#DC1C2E] hover:bg-[#a8131f] text-white rounded-full h-16 w-16 p-0 shadow-lg shadow-[#DC1C2E]/30"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          )}
        </div>

        <div className="text-center text-xs text-slate-500 pb-2">
          <p>💡 Prueba: "¿Cuánto vale un departamento en Las Condes?"</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// En @elevenlabs/react v1.x, useConversation DEBE ir dentro de un ConversationProvider.
export function VoiceAgentModal(props: VoiceAgentModalProps) {
  return (
    <ConversationProvider>
      <VoiceAgentModalInner {...props} />
    </ConversationProvider>
  );
}

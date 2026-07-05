import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, PhoneCall, PhoneOff, Volume2 } from "lucide-react";

const VOICE_AGENT_ID = "agent_2401ksxkp4fgfw0vwt0yt1tnz7r2";
const INK    = "#021B4D";
const BRAND  = "#DC1C2E";
const BLUE_LT = "#7FA8FF";
const SIGNAL = "#25D366";

type VState = "idle" | "connecting" | "listening" | "speaking";

function LiveWave({ amp, active, color }: { amp: number; active: boolean; color: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: 26 }).map((_, i) => {
        const phase = (i / 26) * Math.PI * 2;
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

  useEffect(() => {
    if (!active) { setSec(0); return; }
    const id = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

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
    } catch (e) { console.error("[mic] permiso denegado", e); return false; }
  };

  const startCall = async () => {
    if (state !== "idle") return;
    setState("connecting");
    const ok = await startMic();
    if (!ok) { setState("idle"); alert("Necesitamos permiso de micrófono para hablar con Sofía."); return; }
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
    state === "connecting" ? "Conectando con Sofía…" :
    state === "listening"  ? "Te escucha — habla ahora" :
    state === "speaking"   ? "Sofía está respondiendo…" :
                             "Toca llamar y habla con Sofía";

  return (
    <div className="relative mx-auto max-w-[340px] rounded-[34px] p-3 shadow-2xl border border-white/10"
         style={{ background: "linear-gradient(160deg,#0c1a38,#0a1730)" }}>
      <div className="rounded-[26px] overflow-hidden" style={{ background: INK }}>
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

        <div className="px-6 pb-6 -mt-10 relative text-center">
          <div className="relative inline-block">
            <span className={`absolute inset-0 rounded-full opacity-30 ${active && !reduce ? "animate-ping" : ""}`} style={{ background: accent }} />
            <div className="relative w-20 h-20 rounded-full border-4 overflow-hidden transition-colors duration-300" style={{ borderColor: active ? accent : INK }}>
              <img src="/landing/voice-headset.jpg" alt="Sofía · Voz IA" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
          <h3 className="mt-3 font-display font-bold text-white text-lg">Sofía · Voz IA</h3>
          <motion.p key={status} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-white/50 text-xs">{status}</motion.p>

          <div className="mt-4"><LiveWave amp={amp} active={active} color={accent} /></div>

          <div className="mt-5 flex items-center justify-center gap-4">
            {state === "idle" ? (
              <button onClick={startCall} aria-label="Llamar a Sofía"
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

export function VoiceCallLive() {
  return (
    <ConversationProvider>
      <VoiceCallLiveInner />
    </ConversationProvider>
  );
}

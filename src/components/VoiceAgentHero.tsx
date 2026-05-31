import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, PhoneOff } from "lucide-react";
import { useConversation } from "@elevenlabs/react";

const AGENT_ID = "agent_2401ksxkp4fgfw0vwt0yt1tnz7r2";

type AgentState = "idle" | "connecting" | "listening" | "speaking";


// ─── 3D Sphere Canvas ─────────────────────────────────────────────────────────
function drawSphere(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  t: number, amp: number, state: AgentState,
) {
  const cx = w / 2, cy = h / 2;
  const base = Math.min(w, h) * 0.38;
  const r = base * (1 + amp * 0.18);

  ctx.clearRect(0, 0, w, h);

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.7);
  if (state === "listening") {
    glow.addColorStop(0, "rgba(207,20,43,0.28)");
    glow.addColorStop(0.5, "rgba(207,20,43,0.10)");
  } else if (state === "speaking") {
    glow.addColorStop(0, "rgba(15,43,90,0.32)");
    glow.addColorStop(0.5, "rgba(15,43,90,0.12)");
  } else {
    glow.addColorStop(0, "rgba(150,150,180,0.18)");
    glow.addColorStop(0.5, "rgba(150,150,180,0.06)");
  }
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
  ctx.fillStyle = glow; ctx.fill();

  // Sphere body
  const body = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.32, r * 0.05, cx, cy, r);
  if (state === "listening") {
    body.addColorStop(0, "#ff8899"); body.addColorStop(0.45, "#cf142b"); body.addColorStop(1, "#6b0000");
  } else if (state === "speaking") {
    body.addColorStop(0, "#4da6ff"); body.addColorStop(0.45, "#0f2b5a"); body.addColorStop(1, "#040d1e");
  } else {
    body.addColorStop(0, "#e8e8f0"); body.addColorStop(0.45, "#9090b0"); body.addColorStop(1, "#404060");
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill();

  // Wireframe latitude ellipses
  const wireAlpha = state === "idle" ? 0.3 : 0.5;
  const wireColor =
    state === "listening" ? `rgba(255,150,160,${wireAlpha})` :
    state === "speaking"  ? `rgba(100,160,255,${wireAlpha})` :
                             `rgba(200,200,220,${wireAlpha})`;
  ctx.strokeStyle = wireColor; ctx.lineWidth = 0.9;
  for (let i = 1; i < 7; i++) {
    const lat = (Math.PI * i) / 7 - Math.PI / 2;
    const latR = r * Math.cos(lat);
    const y = cy + r * Math.sin(lat);
    const tiltFactor = Math.abs(Math.sin(t * 0.7 + i * 0.3)) * 0.6 + 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, y, latR, latR * tiltFactor, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Wireframe longitude arcs
  for (let i = 0; i < 9; i++) {
    const lon = (Math.PI * 2 * i) / 9 + t;
    ctx.beginPath();
    for (let j = 0; j <= 60; j++) {
      const lat = (Math.PI * j) / 60 - Math.PI / 2;
      const x = cx + r * Math.cos(lat) * Math.cos(lon);
      const y2 = cy + r * Math.sin(lat);
      const zD = Math.cos(lat) * Math.sin(lon);
      const a = (wireAlpha * ((zD + 1) / 2 + 0.05)).toFixed(2);
      ctx.strokeStyle = wireColor.replace(/[\d.]+\)$/, `${a})`);
      j === 0 ? ctx.moveTo(x, y2) : ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }

  // Specular highlight
  const spec = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.38, 0, cx - r * 0.28, cy - r * 0.28, r * 0.52);
  spec.addColorStop(0, "rgba(255,255,255,0.45)");
  spec.addColorStop(0.6, "rgba(255,255,255,0.10)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = spec; ctx.fill();

  // Equatorial ring when active
  if (state !== "idle") {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.04, r * 0.12, 0, 0, Math.PI * 2);
    ctx.strokeStyle = state === "listening" ? "rgba(207,20,43,0.6)" : "rgba(15,43,90,0.7)";
    ctx.lineWidth = 2 + amp * 4; ctx.stroke();
  }
}

// ─── Sonar Ring ───────────────────────────────────────────────────────────────
function SonarRing({ delay, state, amp }: { delay: number; state: AgentState; amp: number }) {
  const color = state === "listening" ? "#cf142b" : state === "speaking" ? "#0f2b5a" : "#9090b0";
  return (
    <motion.div
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{ border: `1.5px solid ${color}` }}
      animate={
        state !== "idle"
          ? { scale: [1, 1.55 + amp * 0.6], opacity: [0.55, 0] }
          : { scale: 1, opacity: 0.08 }
      }
      transition={
        state !== "idle"
          ? { repeat: Infinity, duration: 2, delay, ease: "easeOut" }
          : { duration: 0.4 }
      }
    />
  );
}

// ─── Waveform bars ────────────────────────────────────────────────────────────
function WaveBars({ amp, state }: { amp: number; state: AgentState }) {
  const color = state === "listening" ? "#cf142b" : "#0f2b5a";
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: 24 }).map((_, i) => {
        const phase = (i / 24) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            className="w-1.5 rounded-full"
            style={{ background: color }}
            animate={{
              height: [
                4 + Math.sin(phase) * 3,
                4 + amp * 48 * (0.4 + Math.abs(Math.sin(phase))) + Math.random() * 4,
                4 + Math.sin(phase) * 3,
              ],
            }}
            transition={{ repeat: Infinity, duration: 0.25 + (i % 5) * 0.06, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function VoiceAgentHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<AgentState>("idle");
  const [amp, setAmp] = useState(0);

  const rafDrawRef = useRef<number>(0);
  const rafAudioRef = useRef<number>(0);
  const tRef = useRef(0);
  const ampRef = useRef(0);
  const stateRef = useRef<AgentState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { ampRef.current = amp; }, [amp]);

  // ── SDK oficial de ElevenLabs (WebRTC, sin widget embed) ──
  const conversation = useConversation({
    onConnect: () => setState("listening"),
    onDisconnect: () => { setState("idle"); stopMicRef.current?.(); },
    onError: (err) => { console.error("[ElevenLabs]", err); setState("idle"); stopMicRef.current?.(); },
    onModeChange: ({ mode }: { mode: string }) => {
      if (mode === "speaking") setState("speaking");
      else if (mode === "listening") setState("listening");
    },
  } as any);

  const stopMicRef = useRef<(() => void) | null>(null);


  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      tRef.current += 0.007 + ampRef.current * 0.025;
      drawSphere(ctx, rect.width, rect.height, tRef.current, ampRef.current, stateRef.current);
      rafDrawRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafDrawRef.current); };
  }, []);

  // ── Detecta modo speaking/listening por silencio del micrófono ──
  // Cuando el usuario calla por >800ms → agente habla (azul)
  // Cuando el usuario vuelve a hablar → escucha (rojo)
  const silenceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (state !== "listening" && state !== "speaking") return;
    const MIC_THRESHOLD = 0.04;
    const SILENCE_MS = 800;

    const interval = setInterval(() => {
      if (ampRef.current > MIC_THRESHOLD) {
        // Usuario habla — estado "listening"
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (stateRef.current === "speaking") setState("listening");
      } else {
        // Silencio — después de SILENCE_MS → agente habla
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(() => {
            silenceTimerRef.current = null;
            if (stateRef.current === "listening") setState("speaking");
          }, SILENCE_MS);
        }
      }
    }, 80);

    return () => {
      clearInterval(interval);
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
  }, [state]);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(rafAudioRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null; audioCtxRef.current = null;
    setAmp(0);
  }, []);

  // Mic para visualización de onda
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
      console.error("[mic] permission denied", e);
      return false;
    }
  };

  useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);
  useEffect(() => () => stopMic(), [stopMic]);

  // Click en el orbe — un solo clic inicia el agente
  const handleClick = async () => {
    if (state !== "idle") return;
    setState("connecting");
    const micOk = await startMic();
    if (!micOk) {
      setState("idle");
      alert("Necesitamos permiso de micrófono para hablar con el agente.");
      return;
    }
    try {
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      } as any);
      // onConnect pasará a "listening"
    } catch (e) {
      console.error("[ElevenLabs] startSession failed", e);
      stopMic();
      setState("idle");
    }
  };

  const handleEnd = async () => {
    try { await conversation.endSession(); } catch {}
    stopMic();
    setState("idle");
  };


  const labels: Record<AgentState, string> = {
    idle:       "Toca el orbe para hablar con el agente IA",
    connecting: "Iniciando…",
    listening:  "Escuchando — habla ahora",
    speaking:   "El agente está respondiendo",
  };
  const subLabels: Record<AgentState, string> = {
    idle:       "Pregunta cualquier cosa sobre RealtyPlus · 24/7",
    connecting: "Conectando con el agente…",
    listening:  "El agente te escucha en tiempo real",
    speaking:   "Respuesta generada por IA",
  };
  const accentColor = state === "listening" ? "#cf142b" : state === "speaking" ? "#0f2b5a" : "#9090b0";

  return (
    <section id="agente-voz" className="relative py-24 px-6 overflow-hidden bg-gradient-to-b from-gray-50 to-white">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#cf142b" }} />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#0f2b5a" }} />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-14">
          <span className="text-[#cf142b] text-sm font-bold uppercase tracking-widest block mb-3">Agente de voz IA</span>
          <h2 className="text-4xl md:text-5xl font-black text-[#040d1e] mb-4">Habla con nuestro agente</h2>
          <p className="text-[#040d1e]/55 text-lg max-w-xl mx-auto leading-relaxed">
            Disponible 24/7. Responde al instante sobre precios, propiedades y cómo funciona RealtyPlus.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* Orb */}
          <div className="relative" style={{ width: 300, height: 300 }}>
            {[0, 0.5, 1.0, 1.5].map((delay, i) => (
              <SonarRing key={i} delay={delay} state={state} amp={amp} />
            ))}

            <motion.button
              onClick={handleClick}
              disabled={state !== "idle"}
              className="absolute inset-6 rounded-full focus:outline-none cursor-pointer disabled:cursor-default"
              style={{ boxShadow: `0 0 ${24 + amp * 40}px ${amp * 20}px ${accentColor}44` }}
              whileHover={state === "idle" ? { scale: 1.04 } : {}}
              whileTap={state === "idle" ? { scale: 0.96 } : {}}
              animate={{ scale: 1 + amp * 0.12 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              aria-label={labels[state]}
            >
              <canvas ref={canvasRef} className="w-full h-full rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  {state === "connecting" && (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-12 h-12 text-white animate-spin drop-shadow-lg" />
                    </motion.div>
                  )}
                  {state === "idle" && (
                    <motion.div key="mic" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                      <Mic className="w-12 h-12 text-white drop-shadow-lg" />
                    </motion.div>
                  )}
                  {state === "listening" && (
                    <motion.div key="listen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                      <Mic className="w-8 h-8 text-white drop-shadow-lg" />
                      <motion.div className="w-2 h-2 rounded-full bg-white" animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
                    </motion.div>
                  )}
                  {state === "speaking" && (
                    <motion.div key="speak" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                      {[0,1,2,3,4].map(i => (
                        <motion.div key={i} className="w-2 rounded-full bg-white"
                          animate={{ height: [8, 28 + amp * 24, 8] }}
                          transition={{ repeat: Infinity, duration: 0.45, delay: i * 0.08, ease: "easeInOut" }} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          </div>

          {/* Status */}
          <div className="text-center">
            <motion.p className="text-lg font-bold text-[#040d1e] mb-1" key={state} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {labels[state]}
            </motion.p>
            <motion.p className="text-sm text-[#040d1e]/45" key={state + "s"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
              {subLabels[state]}
            </motion.p>
          </div>

          {/* Waveform */}
          <AnimatePresence>
            {(state === "listening" || state === "speaking") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <WaveBars amp={amp} state={state} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* End call */}
          <AnimatePresence>
            {(state === "listening" || state === "speaking") && (
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                onClick={handleEnd}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-[#cf142b] text-[#040d1e]/60 text-sm font-semibold transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> Terminar conversación
              </motion.button>
            )}
          </AnimatePresence>

          <p className="text-xs text-[#040d1e]/25 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Powered by ElevenLabs Conversational AI
          </p>
        </div>
      </div>

    </section>
  );
}

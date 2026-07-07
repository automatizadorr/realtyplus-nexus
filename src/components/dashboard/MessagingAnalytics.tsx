import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, CartesianGrid } from "recharts";
import { CheckCheck, Eye, Reply, AlertTriangle, Clock3, Radio } from "lucide-react";
import { tickFase, SENAL_META } from "@/lib/acuse";
import { FxBackground, Gauge, Tilt3D } from "@/components/dashboard/fx";

// ── Analítica de mensajería (WhatsApp) — módulo "4D" futurista ──────────────────
// KPIs especializados de una operación conversacional, calculados sobre los
// acuses (estado_envio / wamid): embudo, tasas de entrega/lectura/respuesta/fallo,
// semáforo comercial y mejor hora. Presentación: panel de vidrio oscuro con neón
// RE/MAX, tarjetas con inclinación 3D, gauges radiales y glow animado.

export interface MsgLite {
  direccion: string;
  created_at: string;
  telefono: string;
  estado_envio?: string | null;
}

const normPhone = (t: string) => String(t || "").split("@")[0].replace(/\D/g, "");
const pct = (num: number, den: number) => (den > 0 ? +((num / den) * 100).toFixed(1) : 0);

interface PhoneAgg {
  anyOut: boolean; anyIn: boolean; ackOut: boolean;
  delivered: boolean; read: boolean; failed: boolean;
  lastOutAt: number; lastOutFase: ReturnType<typeof tickFase>; lastInAt: number;
}

export function MessagingAnalytics({ messages }: { messages: MsgLite[] }) {
  const reduce = useReducedMotion();

  const s = useMemo(() => {
    let mSent = 0, mDelivered = 0, mRead = 0, mFailed = 0, mAck = 0;
    const perPhone = new Map<string, PhoneAgg>();
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, "0"), Salientes: 0, Entrantes: 0 }));

    for (const m of messages) {
      const ph = normPhone(m.telefono);
      if (!ph) continue;
      const t = m.created_at ? Date.parse(m.created_at) : 0;
      const h = m.created_at ? new Date(m.created_at).getHours() : 0;
      let e = perPhone.get(ph);
      if (!e) { e = { anyOut: false, anyIn: false, ackOut: false, delivered: false, read: false, failed: false, lastOutAt: 0, lastOutFase: null, lastInAt: 0 }; perPhone.set(ph, e); }

      if (m.direccion === "outbound") {
        e.anyOut = true;
        if (h >= 0 && h < 24) hourly[h].Salientes++;
        const f = tickFase(m.estado_envio);
        if (f) { e.ackOut = true; mAck++; }
        if (f === "enviado") mSent++;
        else if (f === "entregado") { mDelivered++; e.delivered = true; }
        else if (f === "leido") { mRead++; e.read = true; e.delivered = true; }
        else if (f === "fallido") { mFailed++; e.failed = true; }
        if (t >= e.lastOutAt) { e.lastOutAt = t; e.lastOutFase = f; }
      } else if (m.direccion === "inbound") {
        e.anyIn = true;
        if (h >= 0 && h < 24) hourly[h].Entrantes++;
        if (t >= e.lastInAt) e.lastInAt = t;
      }
    }

    let fEnviados = 0, fEntregados = 0, fLeidos = 0, fRespondieron = 0;
    const senalCount: Record<string, number> = { caliente: 0, tibio: 0, frio: 0, fallido: 0, sin_datos: 0 };

    for (const e of perPhone.values()) {
      if (e.ackOut) {
        fEnviados++;
        if (e.delivered) fEntregados++;
        if (e.read) fLeidos++;
        if (e.anyIn) fRespondieron++;
      }
      if (!e.anyOut) continue;
      let senal: string;
      if (e.lastOutFase === "fallido") senal = "fallido";
      else if (e.anyIn && (e.lastOutAt === 0 || e.lastInAt >= e.lastOutAt)) senal = "caliente";
      else if (e.lastOutFase === "leido") senal = "tibio";
      else if (e.lastOutFase === "entregado" || e.lastOutFase === "enviado") senal = "frio";
      else senal = "sin_datos";
      senalCount[senal]++;
    }

    const mSentPlus = mSent + mDelivered + mRead;
    const mDeliveredPlus = mDelivered + mRead;

    return {
      hasAck: mAck > 0,
      tasaEntrega: pct(mDeliveredPlus, mSentPlus),
      tasaLectura: pct(mRead, mDeliveredPlus),
      tasaFallo: pct(mFailed, mAck),
      tasaRespuesta: pct(fRespondieron, fEnviados),
      funnel: [
        { key: "enviados", label: "Contactados", count: fEnviados, from: "#818cf8", to: "#6366f1" },
        { key: "entregados", label: "Entregados", count: fEntregados, from: "#38bdf8", to: "#0ea5e9" },
        { key: "leidos", label: "Leídos", count: fLeidos, from: "#22d3ee", to: "#06b6d4" },
        { key: "respondieron", label: "Respondieron", count: fRespondieron, from: "#34d399", to: "#10b981" },
      ],
      senalData: (["caliente", "tibio", "frio", "fallido"] as const)
        .map((k) => ({ key: k, label: SENAL_META[k].label.split(" · ")[0], value: senalCount[k], color: SENAL_META[k].color }))
        .filter((d) => d.value > 0),
      senalTotal: senalCount.caliente + senalCount.tibio + senalCount.frio + senalCount.fallido,
      hourly,
      peakHour: hourly.reduce((best, cur) => (cur.Entrantes > best.Entrantes ? cur : best), hourly[0]),
    };
  }, [messages]);

  const funnelBase = s.funnel[0].count || 1;

  const cards = [
    { title: "Tasa de entrega", value: s.tasaEntrega, icon: CheckCheck, hint: "de los salientes llegaron al teléfono", from: "#38bdf8", to: "#0ea5e9", glow: "56,189,248" },
    { title: "Tasa de lectura", value: s.tasaLectura, icon: Eye, hint: "de los entregados fueron leídos (open rate)", from: "#22d3ee", to: "#06b6d4", glow: "34,211,238" },
    { title: "Tasa de respuesta", value: s.tasaRespuesta, icon: Reply, hint: "de los contactados respondieron", from: "#34d399", to: "#10b981", glow: "52,211,153" },
    { title: "Tasa de fallo", value: s.tasaFallo, icon: AlertTriangle, hint: "de los envíos con acuse fallaron", from: "#fb7185", to: "#f43f5e", glow: "251,113,133" },
  ];

  const hourlyConfig = {
    Salientes: { label: "Salientes", color: "#38bdf8" },
    Entrantes: { label: "Entrantes", color: "#34d399" },
  } as const;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#070b1e] via-[#0a1430] to-[#0a0f26] p-5 text-white ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,20,80,0.6)] sm:p-6">
      <FxBackground />

      <div className="relative">
        {/* Encabezado */}
        <div className="mb-5 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-sky-300/80">Read receipts · WhatsApp</p>
            <h2 className="text-xl font-bold tracking-tight">Analítica de mensajería</h2>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur sm:inline-flex">
            <Radio className="h-3.5 w-3.5 text-emerald-400" /> En vivo
          </span>
        </div>

        {!s.hasAck && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Aún no hay acuses de WhatsApp registrados. Las tasas se poblarán a medida que se envíen y lean mensajes nuevos.
          </div>
        )}

        {/* KPI cards con gauge + tilt 3D */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <Tilt3D disabled={!!reduce}>
                <div
                  className="group relative h-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-shadow duration-300"
                  style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06)` }}
                >
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${c.to}, transparent)` }} />
                  <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `0 0 30px -6px rgba(${c.glow},0.5)` }} />
                  <div className="flex items-center gap-3" style={{ transform: "translateZ(30px)" }}>
                    <div className="relative grid place-items-center">
                      <Gauge value={c.value} from={c.from} to={c.to} id={`gauge-${i}`} />
                      <c.icon className="absolute h-5 w-5" style={{ color: c.to }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">{c.title}</p>
                      <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight" style={{ color: c.to, textShadow: `0 0 18px rgba(${c.glow},0.45)` }}>
                        <AnimatedNumber value={c.value} decimals={1} suffix="%" />
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-tight text-white/45">{c.hint}</p>
                </div>
              </Tilt3D>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Embudo de conversación */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md lg:col-span-2">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">Recorrido del lead</p>
            <h3 className="mt-1 text-base font-semibold">Embudo de conversación</h3>
            <div className="mt-4 space-y-4">
              {s.funnel.map((stage, i) => {
                const rel = pct(stage.count, funnelBase);
                const conv = i === 0 ? null : pct(stage.count, s.funnel[i - 1].count);
                return (
                  <div key={stage.key}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-white/90">{stage.label}</span>
                      <span className="tabular-nums text-white/50">
                        <span className="font-semibold text-white"><AnimatedNumber value={stage.count} /></span>
                        {conv !== null && <span className="ml-2 text-xs">↳ {conv}%</span>}
                      </span>
                    </div>
                    <div className="relative h-4 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/5">
                      <motion.div
                        className="relative h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${stage.from}, ${stage.to})`, boxShadow: `0 0 16px -2px ${stage.to}aa` }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.max(rel, 3)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                      >
                        {!reduce && (
                          <motion.span
                            className="absolute inset-y-0 w-1/3 -skew-x-12"
                            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
                            animate={{ x: ["-120%", "420%"] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 + i * 0.15 }}
                          />
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-white/35">Base: leads con al menos un saliente con acuse de WhatsApp.</p>
          </div>

          {/* Semáforo comercial (dona con glow) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">Prioridad comercial</p>
            <h3 className="mt-1 text-base font-semibold">Semáforo de leads</h3>
            {s.senalTotal === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">Sin datos de señal todavía.</p>
            ) : (
              <>
                <div className="relative mt-2">
                  {!reduce && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 m-auto h-[150px] w-[150px] rounded-full"
                      style={{ background: "conic-gradient(from 0deg, #22c55e, #f59e0b, #94a3b8, #f43f5e, #22c55e)", filter: "blur(18px)", opacity: 0.35 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                      aria-hidden
                    />
                  )}
                  <ChartContainer config={{ value: { label: "Leads" } }} className="relative mx-auto h-[190px] w-full [&_.recharts-sector]:drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                      <Pie data={s.senalData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={82} paddingAngle={3} strokeWidth={2}>
                        {s.senalData.map((d) => <Cell key={d.key} fill={d.color} stroke="#0a1430" />)}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-white" style={{ textShadow: "0 0 18px rgba(255,255,255,0.35)" }}>
                      <AnimatedNumber value={s.senalTotal} />
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">leads</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {s.senalData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
                      <span className="flex-1 text-white/80">{d.label}</span>
                      <span className="font-medium tabular-nums text-white/60">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mejor hora para escribir */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">Ritmo del día</p>
              <h3 className="mt-1 text-base font-semibold">Actividad por hora</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <Clock3 className="h-3.5 w-3.5" /> Pico: {s.peakHour.hora}:00 h
            </span>
          </div>
          <ChartContainer config={hourlyConfig} className="mt-3 h-[240px] w-full">
            <BarChart data={s.hourly} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="barOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="barIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="hora" tickLine={false} axisLine={false} tickMargin={8} interval={1} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="Salientes" fill="url(#barOut)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
              <Bar dataKey="Entrantes" fill="url(#barIn)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </section>
  );
}

export default MessagingAnalytics;

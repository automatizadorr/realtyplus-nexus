import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, CartesianGrid } from "recharts";
import { CheckCheck, Eye, Reply, AlertTriangle, Clock3, Radio } from "lucide-react";
import { tickFase, SENAL_META, type TickFase } from "@/lib/acuse";
import { FxPanel, StatTile } from "@/components/dashboard/fx";

// ── Analítica de mensajería (WhatsApp) — módulo "4D" claro ──────────────────────
// KPIs derivados de las conversaciones REALES: si un lead respondió DESPUÉS de un
// mensaje, ese mensaje fue entregado y leído (acuse real por conversación). Se
// combina con los acuses de WhatsApp cuando existen. Así entrega/lectura reflejan
// lo que pasó de verdad, sin depender de que Meta envíe los delivery/read.

export interface MsgLite {
  direccion: string;
  created_at: string;
  telefono: string;
  estado_envio?: string | null;
}

const normPhone = (t: string) => String(t || "").split("@")[0].replace(/\D/g, "");
const pct = (num: number, den: number) => (den > 0 ? +((num / den) * 100).toFixed(1) : 0);

interface PhoneAgg {
  anyOut: boolean; anyIn: boolean;
  lastInAt: number; lastOutAt: number; lastOutFase: TickFase;
  read: boolean; failed: boolean;
}

export function MessagingAnalytics({ messages }: { messages: MsgLite[] }) {
  const reduce = useReducedMotion();

  const s = useMemo(() => {
    const perPhone = new Map<string, PhoneAgg>();
    const outs: { ph: string; t: number; fase: TickFase }[] = [];
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, "0"), Salientes: 0, Entrantes: 0 }));

    // Paso 1: recorrer mensajes, guardar salientes y el último inbound por teléfono
    for (const m of messages) {
      const ph = normPhone(m.telefono);
      if (!ph) continue;
      const t = m.created_at ? Date.parse(m.created_at) : 0;
      const h = m.created_at ? new Date(m.created_at).getHours() : 0;
      let e = perPhone.get(ph);
      if (!e) { e = { anyOut: false, anyIn: false, lastInAt: 0, lastOutAt: 0, lastOutFase: null, read: false, failed: false }; perPhone.set(ph, e); }

      if (m.direccion === "outbound") {
        e.anyOut = true;
        if (h >= 0 && h < 24) hourly[h].Salientes++;
        const f = tickFase(m.estado_envio);
        outs.push({ ph, t, fase: f });
        if (t >= e.lastOutAt) { e.lastOutAt = t; e.lastOutFase = f; }
      } else if (m.direccion === "inbound") {
        e.anyIn = true;
        if (h >= 0 && h < 24) hourly[h].Entrantes++;
        if (t >= e.lastInAt) e.lastInAt = t;
      }
    }

    // Paso 2: clasificar cada saliente = acuse REAL de WhatsApp, o inferido de la
    // conversación (si el lead respondió después, estaba leído).
    let mDelivered = 0, mRead = 0, mFailed = 0;
    for (const o of outs) {
      const e = perPhone.get(o.ph)!;
      let cls: "read" | "delivered" | "failed";
      if (o.fase === "fallido") cls = "failed";
      else if (o.fase === "leido") cls = "read"; // acuse real de lectura
      else if (e.lastInAt > 0 && e.lastInAt >= o.t) cls = "read"; // respondió después → leído
      else cls = "delivered"; // enviado sin respuesta posterior → asumimos entregado
      if (cls === "read") { mRead++; e.read = true; }
      else if (cls === "delivered") mDelivered++;
      else { mFailed++; e.failed = true; }
    }

    const totalOut = outs.length;
    const entregados = mDelivered + mRead; // llegaron al teléfono (todo salvo fallos)

    // Nivel lead: contactados, respondieron, y semáforo comercial
    let fContactados = 0, fRespondieron = 0;
    const senalCount: Record<string, number> = { caliente: 0, tibio: 0, frio: 0, fallido: 0, sin_datos: 0 };
    for (const e of perPhone.values()) {
      if (!e.anyOut) continue;
      fContactados++;
      if (e.anyIn) fRespondieron++;
      let senal: string;
      if (e.failed && !e.read && !e.anyIn) senal = "fallido";
      else if (e.anyIn && (e.lastOutAt === 0 || e.lastInAt >= e.lastOutAt)) senal = "caliente";
      else if (e.read || e.anyIn) senal = "tibio";
      else senal = "frio";
      senalCount[senal]++;
    }

    return {
      hasData: totalOut > 0,
      tasaEntrega: totalOut > 0 ? pct(entregados, totalOut) : null,
      tasaLectura: entregados > 0 ? pct(mRead, entregados) : null,
      tasaFallo: totalOut > 0 ? pct(mFailed, totalOut) : null,
      tasaRespuesta: fContactados > 0 ? pct(fRespondieron, fContactados) : null,
      funnel: [
        { key: "contactados", label: "Contactados", count: fContactados, from: "#818cf8", to: "#6366f1" },
        { key: "entregados", label: "Entregados", count: fContactados, from: "#38bdf8", to: "#0ea5e9" },
        { key: "leidos", label: "Leídos / respondieron", count: fRespondieron, from: "#22d3ee", to: "#06b6d4" },
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

  // El embudo colapsa "Leídos" y "Respondieron" (a nivel lead, leído confirmado =
  // respondió), para no repetir la misma barra.
  const funnelStages = [s.funnel[0], s.funnel[1], s.funnel[3]];
  const funnelBase = s.funnel[0].count || 1;

  const cards = [
    { title: "Tasa de entrega", value: s.tasaEntrega, icon: CheckCheck, hint: "de los salientes llegaron al teléfono", from: "#38bdf8", to: "#0ea5e9", glow: "56,189,248", explain: "De los mensajes salientes, cuántos llegaron al teléfono del lead. Se asume entregado salvo los que fallaron (número inválido, sin WhatsApp o bloqueado)." },
    { title: "Tasa de lectura", value: s.tasaLectura, icon: Eye, hint: "de los entregados fueron leídos", from: "#22d3ee", to: "#06b6d4", glow: "34,211,238", explain: "Porcentaje de mensajes que fueron leídos. Se infiere de la conversación real: si el lead respondió DESPUÉS de un mensaje, ese mensaje estaba leído (más los acuses 'read' reales de WhatsApp cuando llegan). Es un piso confiable de tu open rate." },
    { title: "Tasa de respuesta", value: s.tasaRespuesta, icon: Reply, hint: "de los contactados respondieron", from: "#34d399", to: "#10b981", glow: "52,211,153", explain: "De los leads contactados, cuántos respondieron al menos una vez. Es REAL y el mejor indicador de calidad de la base y del mensaje." },
    { title: "Tasa de fallo", value: s.tasaFallo, icon: AlertTriangle, hint: "de los envíos que fallaron", from: "#fb7185", to: "#f43f5e", glow: "251,113,133", explain: "De los envíos, cuántos fallaron. Es REAL. Si sube de golpe, suele ser saldo/pago en Meta o una base sucia que conviene depurar." },
  ];

  const hourlyConfig = {
    Salientes: { label: "Salientes", color: "#38bdf8" },
    Entrantes: { label: "Entrantes", color: "#34d399" },
  } as const;

  return (
    <FxPanel className="p-5 sm:p-6">
      {/* Encabezado */}
      <div className="mb-5 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-sky-600">Read receipts · WhatsApp</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Analítica de mensajería</h2>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] text-slate-500 backdrop-blur sm:inline-flex">
          <Radio className="h-3.5 w-3.5 text-emerald-500" /> En vivo
        </span>
      </div>

      {!s.hasData ? (
        <div className="mb-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Aún no hay mensajes salientes registrados para analizar.
        </div>
      ) : (
        <p className="mb-4 text-xs text-slate-400">
          Entrega y lectura se calculan de las <strong>conversaciones reales</strong> (si el lead respondió después de un
          mensaje, estaba leído) y de los acuses de WhatsApp cuando llegan.
        </p>
      )}

      {/* KPI cards con gauge + tilt 3D */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <StatTile key={c.title} index={i} gauge decimals={1} suffix="%" {...c} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Embudo de conversación */}
        <div className="rounded-xl border border-slate-200/70 bg-white/60 p-5 shadow-sm backdrop-blur-md lg:col-span-2">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Recorrido del lead</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Embudo de conversación</h3>
          <div className="mt-4 space-y-4">
            {funnelStages.map((stage, i) => {
              const rel = pct(stage.count, funnelBase);
              const conv = i === 0 ? null : pct(stage.count, funnelStages[i - 1].count);
              return (
                <div key={stage.key}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-slate-700">{stage.label}</span>
                    <span className="tabular-nums text-slate-400">
                      <span className="font-semibold text-slate-900"><AnimatedNumber value={stage.count} /></span>
                      {conv !== null && <span className="ml-2 text-xs">↳ {conv}%</span>}
                    </span>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/60">
                    <motion.div
                      className="relative h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${stage.from}, ${stage.to})`, boxShadow: `0 0 14px -3px ${stage.to}` }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.max(rel, 3)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                    >
                      {!reduce && (
                        <motion.span
                          className="absolute inset-y-0 w-1/3 -skew-x-12"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
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
          <p className="mt-4 text-xs text-slate-400">Base: leads con al menos un mensaje saliente.</p>
        </div>

        {/* Semáforo comercial (dona con glow) */}
        <div className="rounded-xl border border-slate-200/70 bg-white/60 p-5 shadow-sm backdrop-blur-md">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Prioridad comercial</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">Semáforo de leads</h3>
          {s.senalTotal === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Sin datos de señal todavía.</p>
          ) : (
            <>
              <div className="relative mt-2">
                {!reduce && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 m-auto h-[150px] w-[150px] rounded-full"
                    style={{ background: "conic-gradient(from 0deg, #22c55e, #f59e0b, #94a3b8, #f43f5e, #22c55e)", filter: "blur(20px)", opacity: 0.22 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                    aria-hidden
                  />
                )}
                <ChartContainer config={{ value: { label: "Leads" } }} className="relative mx-auto h-[190px] w-full [&_.recharts-sector]:drop-shadow-[0_2px_6px_rgba(15,23,42,0.12)]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    <Pie data={s.senalData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={82} paddingAngle={3} strokeWidth={2}>
                      {s.senalData.map((d) => <Cell key={d.key} fill={d.color} stroke="#ffffff" />)}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-slate-900">
                    <AnimatedNumber value={s.senalTotal} />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">leads</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {s.senalData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}66` }} />
                    <span className="flex-1 text-slate-600">{d.label}</span>
                    <span className="font-medium tabular-nums text-slate-400">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mejor hora para escribir */}
      <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/60 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Ritmo del día</p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">Actividad por hora</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
            <Clock3 className="h-3.5 w-3.5" /> Pico: {s.peakHour.hora}:00 h
          </span>
        </div>
        <ChartContainer config={hourlyConfig} className="mt-3 h-[240px] w-full">
          <BarChart data={s.hourly} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="barOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="barIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#a7f3d0" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
            <XAxis dataKey="hora" tickLine={false} axisLine={false} tickMargin={8} interval={1} tick={{ fill: "rgba(15,23,42,0.45)", fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="Salientes" fill="url(#barOut)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
            <Bar dataKey="Entrantes" fill="url(#barIn)" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
          </BarChart>
        </ChartContainer>
      </div>
    </FxPanel>
  );
}

export default MessagingAnalytics;

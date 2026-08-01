import type { ReactNode } from "react";

/*
  Infografías lúdicas del blog (SEO): bloques visuales auto-explicativos que
  aumentan el tiempo en página y la compartibilidad del contenido. Cada una es
  un componente sin dependencias externas (solo CSS inline + emojis), con la
  paleta LexHouse (azul #003DA5, rojo #DC1C2E, dorado #D4AF37, tinta #0F1B2D).
  Son aria-hidden para lectores de pantalla (el contenido real va en el texto).
*/

const BLUE = "#003DA5";
const RED = "#DC1C2E";
const GOLD = "#D4AF37";
const INK = "#0F1B2D";

// ─── Wrapper común: título mono + tarjeta ────────────────────────────────
function Infographic({
  title,
  children,
  accent = BLUE,
}: {
  title: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <figure
      aria-hidden="true"
      className="not-prose my-8 overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50/80 shadow-sm"
      style={{ borderColor: `${accent}33` }}
    >
      <figcaption className="flex items-center gap-2 px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }}>
        <span aria-hidden>📊</span> {title}
      </figcaption>
      <div className="p-5">{children}</div>
    </figure>
  );
}

// Tarjeta pequeña dentro de una infografía.
function Chip({
  emoji,
  label,
  sub,
  tone = BLUE,
}: {
  emoji: string;
  label: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 border-white bg-white px-3 py-3 text-center shadow-sm">
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-[12px] font-bold leading-tight" style={{ color: tone }}>{label}</span>
      {sub && <span className="text-[10px] leading-tight text-slate-500">{sub}</span>}
    </div>
  );
}

// ─── 1. Pipeline de pasos con flechas (scraping → mensaje → canal → respuesta) ───
export function PipelineSteps({
  title = "El pipeline de captación en 4 pasos",
  steps = [
    { emoji: "🕵️", label: "Scraping", sub: "encuentra prospectos reales" },
    { emoji: "✍️", label: "IA redacta", sub: "mensaje personalizado" },
    { emoji: "📤", label: "Se envía", sub: "WhatsApp o email" },
    { emoji: "🤖", label: "Responde IA", sub: "califica y agenda" },
  ],
}: {
  title?: string;
  steps?: { emoji: string; label: string; sub?: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-1 items-center gap-1">
            <Chip emoji={s.emoji} label={s.label} sub={s.sub} />
            {i < steps.length - 1 && (
              <span className="hidden text-xl sm:block" style={{ color: GOLD }}>➜</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">
        sin copiar y pegar · sin planillas
      </div>
    </Infographic>
  );
}

// ─── 2. Línea de tiempo (reactivación / agenda) ───
export function Timeline({
  title = "Cuándo y cómo reactivar",
  items = [
    { when: "30 días", emoji: "👋", label: "1er re-enganche", sub: "novedad: propiedad nueva" },
    { when: "60–90 días", emoji: "💰", label: "2º ángulo", sub: "financiamiento o zona" },
    { when: "6 meses", emoji: "📅", label: "Ciclo amplio", sub: "re-agendar visita" },
    { when: "Archivo", emoji: "🗄️", label: "Rotar base", sub: "máx. 3-4 toques" },
  ],
}: {
  title?: string;
  items?: { when: string; emoji: string; label: string; sub?: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="grid gap-2 sm:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="relative flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed bg-white px-2 py-4 text-center" style={{ borderColor: `${BLUE}40` }}>
            <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: BLUE }}>{it.when}</span>
            <span className="mt-1 text-2xl">{it.emoji}</span>
            <span className="text-[12px] font-bold text-slate-700">{it.label}</span>
            {it.sub && <span className="text-[10px] text-slate-500">{it.sub}</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        <span aria-hidden>⚖️</span> regla de oro: cada toque suma valor, nunca presión
      </div>
    </Infographic>
  );
}

// ─── 3. Comparativa tipo «carrera» (velocidad de respuesta) ───
export function Race({
  title = "¿A qué velocidad se pierde un lead?",
  lanes = [
    { emoji: "⚡", label: "En minutos", pct: 90, tone: "#16a34a", note: "ganas la conversación" },
    { emoji: "🕐", label: "En horas", pct: 55, tone: GOLD, note: "empiezas a enfriarlo" },
    { emoji: "🐌", label: "Al día siguiente", pct: 25, tone: RED, note: "probablemente se fue" },
  ],
}: {
  title?: string;
  lanes?: { emoji: string; label: string; pct: number; tone: string; note: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="space-y-3">
        {lanes.map((l, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-center text-xl">{l.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-slate-700">{l.label}</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: l.tone }}>{l.pct}%</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200/70">
                <div className="h-full rounded-full transition-all" style={{ width: `${l.pct}%`, background: `linear-gradient(90deg, ${l.tone}, ${l.tone}88)` }} />
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">{l.note}</div>
            </div>
          </div>
        ))}
      </div>
    </Infographic>
  );
}

// ─── 4. Embudo (leads → calientes → citas → cierres) ───
export function Funnel({
  title = "El embudo inmobiliario en números",
  stages = [
    { emoji: "📥", label: "100 leads", sub: "entran por portales, web y redes", tone: BLUE },
    { emoji: "🔥", label: "30 calientes", sub: "con intención real de compra", tone: GOLD },
    { emoji: "📅", label: "12 citas", sub: "agendadas con visita concreta", tone: RED },
    { emoji: "🤝", label: "4 cierres", sub: "ventas concretadas al mes", tone: "#16a34a" },
  ],
}: {
  title?: string;
  stages?: { emoji: string; label: string; sub: string; tone: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="flex flex-col items-center gap-1.5">
        {stages.map((s, i) => (
          <div key={i} className="flex w-full flex-col items-center gap-1">
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-2.5 text-white shadow-sm"
              style={{ width: `${100 - i * 18}%`, background: `linear-gradient(90deg, ${s.tone}, ${s.tone}bb)` }}
            >
              <span className="text-lg">{s.emoji}</span>
              <div className="flex-1">
                <div className="text-[13px] font-bold leading-tight">{s.label}</div>
                <div className="text-[10px] opacity-80">{s.sub}</div>
              </div>
            </div>
            {i < stages.length - 1 && <span className="text-slate-300" aria-hidden>⬇</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-white px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">
        cada etapa se pierde sin respuesta rápida + seguimiento
      </div>
    </Infographic>
  );
}

// ─── 5. Bandeja de entrada (email) ───
export function InboxBattle({
  title = "¿Dónde cae tu correo?",
  rows = [
    { emoji: "📥", label: "Bandeja principal", pct: 70, tone: "#16a34a", note: "SPF + DKIM + DMARC configurados" },
    { emoji: "📋", label: "Promociones", pct: 25, tone: GOLD, note: "muchas imágenes y botones" },
    { emoji: "☠️", label: "Spam", pct: 5, tone: RED, note: "sin autenticar dominio" },
  ],
}: {
  title?: string;
  rows?: { emoji: string; label: string; pct: number; tone: string; note: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-center text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-slate-700">{r.label}</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: r.tone }}>{r.pct}%</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200/70">
                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: `linear-gradient(90deg, ${r.tone}, ${r.tone}88)` }} />
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">{r.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-white px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">
        ✉️ consejo: incluye List-Unsubscribe y evita el look «promoción»
      </div>
    </Infographic>
  );
}

// ─── 6. Voz → CRM (dictado que se convierte en acciones) ───
export function VoiceFlow({
  title = "Hablas, y el CRM se actualiza",
  steps = [
    { emoji: "🗣️", label: "Dictas", sub: "«quedó interesada, llama el jueves»" },
    { emoji: "🧠", label: "IA entiende", sub: "detecta intención y datos" },
    { emoji: "✅", label: "Actualiza", sub: "estado + nota + siguiente paso" },
  ],
}: {
  title?: string;
  steps?: { emoji: string; label: string; sub: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Chip emoji={s.emoji} label={s.label} sub={s.sub} tone={BLUE} />
            {i < steps.length - 1 && <span className="hidden text-xl sm:block" style={{ color: GOLD }}>➜</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        ⏱️ 30 segundos, sin tipear nada
      </div>
    </Infographic>
  );
}

// ─── 7. Importación (Excel → Scanner → CRM) ───
export function ImportFlow({
  title = "Del Excel al pipeline en 3 pasos",
  steps = [
    { emoji: "📄", label: "Excel / CSV", sub: "tu base ya tiene los datos" },
    { emoji: "🔍", label: "Scanner IA", sub: "detecta columnas y contactos" },
    { emoji: "🗂️", label: "CRM deduplicado", sub: "sin duplicados, lista para trabajar" },
  ],
}: {
  title?: string;
  steps?: { emoji: string; label: string; sub: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-0">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Chip emoji={s.emoji} label={s.label} sub={s.sub} tone={BLUE} />
            {i < steps.length - 1 && <span className="hidden text-xl sm:block" style={{ color: GOLD }}>➜</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        🎯 mismo teléfono o email = 1 solo lead, siempre
      </div>
    </Infographic>
  );
}

// ─── 8. Agenda (horarios propuestos por IA) ───
export function CalendarPicks({
  title = "Proponer horarios concretos gana",
  picks = [
    { emoji: "🗓️", label: "Lun 11:00", sub: "disponible", ok: true },
    { emoji: "🗓️", label: "Mié 17:00", sub: "disponible", ok: true },
    { emoji: "🗓️", label: "Jue 09:30", sub: "disponible", ok: true },
  ],
  win = "⚡ El lead que elige ya está medio agendado",
}: {
  title?: string;
  picks?: { emoji: string; label: string; sub: string; ok?: boolean }[];
  win?: string;
}) {
  return (
    <Infographic title={title}>
      <div className="grid gap-2 sm:grid-cols-3">
        {picks.map((p, i) => (
          <div key={i} className="rounded-2xl border-2 bg-white px-3 py-4 text-center" style={{ borderColor: p.ok ? "#16a34a66" : `${BLUE}40` }}>
            <div className="text-2xl">{p.ok ? "✅" : "🔵"}</div>
            <div className="mt-1 text-[13px] font-bold text-slate-700">{p.label}</div>
            <div className="text-[10px] text-slate-500">{p.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        {win}
      </div>
    </Infographic>
  );
}

// ─── 9. Reporte de la mañana ───
export function MorningReport({
  title = "Tu reporte llega solo, a las 8:00",
  items = [
    { emoji: "🆕", label: "12 leads nuevos", sub: "3 calientes" },
    { emoji: "💬", label: "8 respondieron", sub: "2 sin atender aún" },
    { emoji: "📅", label: "5 citas hoy", sub: "3 confirmadas" },
    { emoji: "⚠️", label: "2 alertas", sub: "leads sin seguimiento" },
  ],
}: {
  title?: string;
  items?: { emoji: string; label: string; sub?: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col items-center gap-1 rounded-2xl bg-white px-2 py-3 text-center shadow-sm">
            <span className="text-2xl">{it.emoji}</span>
            <span className="text-[12px] font-bold leading-tight text-slate-700">{it.label}</span>
            {it.sub && <span className="text-[10px] text-slate-500">{it.sub}</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        ⏰ sin que nadie arme la planilla
      </div>
    </Infographic>
  );
}

// ─── 10. Mandato (la propuesta que convence al propietario) ───
export function MandatoDeal({
  title = "La propuesta que gana el encargo",
  left = {
    emoji: "😟",
    label: "La competencia",
    points: ["«lo dejo en portales»", "valuación a ojo", "sin reportes"],
    tone: "#94a3b8",
  },
  right = {
    emoji: "😎",
    label: "Tu propuesta con IA",
    points: ["respuesta 24/7 a interesados", "valuación con datos", "reporte semanal de avance"],
    tone: BLUE,
  },
}: {
  title?: string;
  left?: { emoji: string; label: string; points: string[]; tone?: string };
  right?: { emoji: string; label: string; points: string[]; tone?: string };
}) {
  return (
    <Infographic title={title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {[left, right].map((c, i) => (
          <div key={i} className="rounded-2xl border-2 border-white bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-[13px] font-bold" style={{ color: c.tone ?? INK }}>{c.label}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {c.points.map((pt, j) => (
                <li key={j} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                  <span aria-hidden>{i === 0 ? "✗" : "✓"}</span> {pt}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        🏆 el propietario elige a quien le transmite control
      </div>
    </Infographic>
  );
}

// ─── 11. Kit de herramientas por etapa ───
export function Toolbox({
  title = "Tu kit de IA, etapa por etapa",
  rows = [
    { emoji: "📥", label: "Captación", sub: "scraping + chatbot 24/7", tone: BLUE },
    { emoji: "⚡", label: "Primera respuesta", sub: "agente IA en WhatsApp", tone: GOLD },
    { emoji: "📑", label: "Contratos", sub: "revisión legal con IA", tone: RED },
    { emoji: "💰", label: "Valuación", sub: "precio con datos de mercado", tone: "#16a34a" },
  ],
}: {
  title?: string;
  rows?: { emoji: string; label: string; sub: string; tone: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${r.tone}1a` }}>{r.emoji}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-slate-700">{r.label}</div>
              <div className="text-[10px] text-slate-500">{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Infographic>
  );
}

// ─── 12. Puntaje de oportunidad (scoring) ───
export function ScoreMeter({
  title = "¿Cómo se puntúa un prospecto?",
  items = [
    { emoji: "💬", label: "Intención", sub: "«quiero agendar» = +30" },
    { emoji: "⚡", label: "Velocidad", sub: "responde en minutos = +25" },
    { emoji: "💰", label: "Presupuesto", sub: "menciona financiamiento = +20" },
    { emoji: "🏠", label: "Propiedades", sub: "mira varias = +15" },
  ],
  score = { label: "Score 90", note: "Oportunidad caliente: llámalo YA", tone: RED },
}: {
  title?: string;
  items?: { emoji: string; label: string; sub: string }[];
  score?: { label: string; note: string; tone?: string };
}) {
  return (
    <Infographic title={title}>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <span className="text-2xl">{it.emoji}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-slate-700">{it.label}</div>
              <div className="text-[10px] text-slate-500">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(90deg, ${score.tone ?? RED}, ${score.tone ?? RED}bb)` }}>
        <span className="font-mono text-sm font-bold">{score.label}</span>
        <span className="text-[11px] font-medium opacity-90">{score.note}</span>
      </div>
    </Infographic>
  );
}

// ─── 13. Errores comunes (checklist de "no hacer") ───
export function MistakesCard({
  title = "Errores que cuestan caros",
  items = [
    "Prospectar dos veces al mismo negocio",
    "Responder leads «cuando se pueda»",
    "Enviar el mismo mensaje a todos",
    "Dejar que los leads se enfríen en un Excel",
  ],
}: {
  title?: string;
  items?: string[];
}) {
  return (
    <Infographic title={title}>
      <ul className="space-y-2">
        {items.map((m, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] leading-snug text-slate-600 shadow-sm">
            <span aria-hidden>❌</span> {m}
          </li>
        ))}
      </ul>
    </Infographic>
  );
}

// ─── 14. Banner de dato clave (métrica destacada) ───
export function KeyStat({
  value,
  label,
  tone = BLUE,
}: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <figure
      aria-hidden="true"
      className="not-prose my-8 flex flex-col items-center gap-1 overflow-hidden rounded-3xl border-2 px-6 py-8 text-center"
      style={{ borderColor: `${tone}33`, background: `linear-gradient(135deg, ${tone}0d, ${tone}1a)` }}
    >
      <div className="font-display text-5xl font-black tracking-tight" style={{ color: tone }}>{value}</div>
      <div className="max-w-sm font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
    </figure>
  );
}

// ─── 15. Tarjetas de "esto funciona" (mejores prácticas) ───
export function BestPractices({
  title = "Lo que sí funciona",
  items = [
    { emoji: "🎯", label: "Mensaje con contexto", sub: "lee su web antes de escribir" },
    { emoji: "⏱️", label: "Respuesta en minutos", sub: "el 78% contrata al primero" },
    { emoji: "📅", label: "Horario concreto", sub: "no preguntas abiertas" },
    { emoji: "📊", label: "Registro de todo", sub: "historial que nunca olvida" },
  ],
}: {
  title?: string;
  items?: { emoji: string; label: string; sub: string }[];
}) {
  return (
    <Infographic title={title}>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <span className="text-2xl">{it.emoji}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-bold leading-tight text-slate-700">{it.label}</div>
              <div className="text-[10px] text-slate-500">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Infographic>
  );
}

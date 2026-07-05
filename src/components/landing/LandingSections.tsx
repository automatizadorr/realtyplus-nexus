import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Check, Globe, Sparkles, Clock, Tags, ShieldCheck, PhoneCall, ArrowRight } from "lucide-react";
import { FadeSection, Serif, TiltCard, AnimatedCounter, Magnetic } from "./landing-helpers";
import { INK, INK2, BLUE, BLUE_LT, BRAND, SIGNAL } from "./landing-helpers";
import { LeadsCarousel, STEPS, FEATURES, REPORT_TAGS, FAQS, FAQItem, WaLink } from "./LandingWidgets";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

const VoiceCallLive = lazy(() =>
  import("@/components/landing/VoiceCallLive").then((m) => ({ default: m.VoiceCallLive })),
);

// ── Secciones exportadas ──────────────────────────────────────────────────────

export function CarruselSection() {
  return (
    <section id="carrusel" className="py-24 px-6 bg-white" aria-labelledby="carr-heading">
      <div className="max-w-6xl mx-auto">
        <FadeSection className="max-w-2xl mb-10">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>IA aplicada a tus leads</span>
          <h2 id="carr-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
            Inteligencia que <Serif>trabaja tus contactos</Serif>.
          </h2>
          <p className="mt-4 text-slate-500 text-lg">De la primera respuesta al cierre, cada paso con datos e IA de por medio.</p>
        </FadeSection>
        <FadeSection><LeadsCarousel /></FadeSection>
      </div>
    </section>
  );
}

export function ComoSection() {
  return (
    <section id="como" className="py-24 px-6 bg-white" aria-labelledby="como-heading">
      <div className="max-w-7xl mx-auto">
        <FadeSection className="max-w-2xl mb-14">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>El recorrido de un lead</span>
          <h2 id="como-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
            Cuatro pasos, <Serif>cero trabajo manual</Serif>.
          </h2>
        </FadeSection>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <FadeSection key={s.k} delay={i * 0.08}>
              <TiltCard className="h-full">
                <div className="relative h-full p-6 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-card transition-all duration-300">
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono text-sm font-bold text-slate-300" style={{ transform: "translateZ(28px)" }}>{s.k}</span>
                    <s.icon className="w-5 h-5" style={{ color: BRAND, transform: "translateZ(28px)" }} aria-hidden="true" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2" style={{ transform: "translateZ(20px)" }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <span className="hidden lg:block absolute top-7 -right-2.5 text-slate-200" aria-hidden="true">→</span>
                  )}
                </div>
              </TiltCard>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FuncionesSection() {
  return (
    <section id="funciones" className="py-24 px-6" style={{ background: "#F6F7FB" }} aria-labelledby="func-heading">
      <div className="max-w-7xl mx-auto">
        <FadeSection className="max-w-2xl mb-14">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>La plataforma</span>
          <h2 id="func-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3 leading-tight">
            Todo lo que de verdad usas, <Serif>en un solo lugar</Serif>.
          </h2>
          <p className="mt-4 text-slate-500 text-lg">Ocho herramientas conectadas alrededor de la misma conversación.</p>
        </FadeSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <FadeSection key={f.title} delay={(i % 4) * 0.06}>
              <div className="h-full p-6 rounded-2xl bg-white border border-slate-100 hover:border-[#E11D34]/25 hover:shadow-card transition-all duration-300">
                <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `${BRAND}10` }}>
                  <f.icon className="w-5 h-5" style={{ color: BRAND }} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-[15px] mb-1.5">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            </FadeSection>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VozSection() {
  return (
    <section id="voz" className="py-24 px-6 relative overflow-hidden" style={{ background: INK }} aria-labelledby="voz-heading">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: BLUE }} aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <FadeSection>
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BLUE_LT }}>VoiceCRM · agente de voz</span>
          <h2 id="voz-heading" className="font-display font-bold text-3xl sm:text-4xl text-white mt-3 leading-tight">
            Tu asesora también <Serif>atiende por teléfono</Serif>.
          </h2>
          <p className="mt-5 text-white/60 text-lg leading-relaxed">
            Sofía no solo escribe: llama y contesta. Cualifica al lead por voz, resuelve dudas y agenda la visita
            — con la misma memoria de la conversación y el mismo criterio que en WhatsApp.
          </p>
          <ul className="mt-7 space-y-3">
            {["Atiende y realiza llamadas de cualificación", "Voz natural en español, con el tono de tu marca",
              "Agenda la visita y la confirma por WhatsApp", "Cada llamada queda registrada en la ficha del lead"].map((t) => (
              <li key={t} className="flex items-center gap-3 text-white/75 text-sm">
                <Check className="w-4 h-4 shrink-0" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
              </li>
            ))}
          </ul>
          <Magnetic className="mt-8" strength={0.3}>
            <Link to="/auth" className="group inline-flex items-center gap-2 px-7 py-3.5 font-bold text-white rounded-xl text-[15px] transition-transform hover:scale-[1.03]"
                  style={{ background: BRAND, boxShadow: `0 12px 30px ${BRAND}40` }}>
              <PhoneCall className="w-4 h-4" aria-hidden="true" />Probar VoiceCRM
            </Link>
          </Magnetic>
        </FadeSection>
        <FadeSection delay={0.1}>
          <Suspense fallback={<div className="mx-auto max-w-[340px] h-[420px] rounded-[34px] bg-white/5 animate-pulse" />}>
            <VoiceCallLive />
          </Suspense>
        </FadeSection>
      </div>
    </section>
  );
}

export function ReporteSection() {
  return (
    <section id="reporte" className="py-24 px-6" style={{ background: INK }} aria-labelledby="rep-heading">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <FadeSection>
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BLUE_LT }}>Automático · 08:00</span>
          <h2 id="rep-heading" className="font-display font-bold text-3xl sm:text-4xl text-white mt-3 leading-tight">
            <Serif>Cada mañana</Serif>, los leads del día en tu correo.
          </h2>
          <p className="mt-5 text-white/60 text-lg leading-relaxed">
            A las 08:00 (hora de Madrid) recibe un reporte consolidado: todos los leads que se movieron en las
            últimas 24 horas, agrupados por etiqueta y con su conversación completa.
          </p>
          <ul className="mt-7 space-y-3">
            {["Agrupado por intención del lead", "Conversación completa de cada uno",
              "Excluye automáticamente a los que no respondieron"].map((t) => (
              <li key={t} className="flex items-center gap-3 text-white/75 text-sm">
                <Check className="w-4 h-4 shrink-0" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
              </li>
            ))}
          </ul>
        </FadeSection>
        <FadeSection delay={0.1}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10" style={{ background: INK2 }}>
              <span className="font-display font-semibold text-white text-sm">Reporte de leads · hoy</span>
              <span className="font-mono text-[10px] text-white/40">21 leads · 4 etiquetas</span>
            </div>
            <div className="divide-y divide-white/5">
              {REPORT_TAGS.map((t) => (
                <div key={t.name} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-white/80 text-sm flex-1">{t.name}</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{ background: `${t.color}1f`, color: t.color }}>{t.count} leads</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 text-center font-mono text-[10px] text-white/30 bg-white/[0.02]">
              enviado a jefatura@realty-plus.es · 08:00
            </div>
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

export function StatsSection() {
  const items = [
    { icon: Globe,    value: 25,  suffix: "+",  label: "Países en la red RealtyPlus" },
    { icon: Sparkles, value: 24,  suffix: "/7", label: "Sofía atendiendo leads" },
    { icon: Clock,    value: 8,   suffix: ":00", label: "Reporte diario a jefatura" },
    { icon: Tags,     value: 100, suffix: "%",  label: "Leads clasificados por IA" },
  ];
  return (
    <section className="py-20 px-6 bg-white" aria-label="Datos">
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
        {items.map((s, i) => (
          <FadeSection key={s.label} delay={i * 0.08} className="text-center">
            <s.icon className="w-6 h-6 mx-auto mb-3" style={{ color: BRAND }} aria-hidden="true" />
            <div className="font-display font-extrabold text-4xl sm:text-5xl" style={{ color: INK }}>
              <AnimatedCounter target={s.value} suffix={s.suffix} />
            </div>
            <div className="mt-2 text-sm text-slate-500">{s.label}</div>
          </FadeSection>
        ))}
      </div>
    </section>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-24 px-6" style={{ background: "#F6F7FB" }} aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <FadeSection className="mb-8">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>Preguntas frecuentes</span>
          <h2 id="faq-heading" className="font-display font-bold text-3xl sm:text-4xl mt-3">Lo que <Serif>sueles preguntar</Serif>.</h2>
        </FadeSection>
        <FadeSection>
          <div className="rounded-2xl bg-white border border-slate-100 px-6">
            {FAQS.map((f) => <FAQItem key={f.q} {...f} />)}
          </div>
        </FadeSection>
        <FadeSection className="mt-8 text-center"><WaLink /></FadeSection>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="py-24 px-6 bg-white" aria-labelledby="cta-heading">
      <FadeSection>
        <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden px-8 py-16 sm:px-16 sm:py-20 text-center" style={{ background: INK }}>
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: BRAND }} aria-hidden="true" />
          <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ background: BLUE }} aria-hidden="true" />
          <div className="relative">
            <ShieldCheck className="w-10 h-10 mx-auto mb-5" style={{ color: BLUE_LT }} aria-hidden="true" />
            <h2 id="cta-heading" className="font-display font-extrabold text-3xl sm:text-5xl text-white leading-tight">
              Deja que Sofía atienda.<br />Tú dedícate a <Serif className="font-semibold">cerrar</Serif>.
            </h2>
            <p className="mt-5 text-white/60 text-lg max-w-lg mx-auto">
              Conecta tu WhatsApp y empieza gratis. Sin tarjeta, sin contratos.
            </p>
            <Magnetic className="mt-9" strength={0.3}>
              <Link to="/auth" className="group inline-flex items-center gap-2 px-9 py-4 font-bold text-white rounded-xl text-lg transition-transform hover:scale-105"
                    style={{ background: BRAND, boxShadow: `0 14px 36px ${BRAND}50` }}>
                Comenzar gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </FadeSection>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="py-14 px-6" style={{ background: INK }} aria-label="Pie de página">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          <div>
            <img src={realtyplusLogo} alt="RealtyPlus" className="h-9 w-auto mb-4 brightness-0 invert" width="120" height="36" />
            <p className="text-white/40 text-sm leading-relaxed">CRM inmobiliario sobre WhatsApp, con IA que responde, agenda y clasifica.</p>
          </div>
          {[
            { title: "Plataforma", links: ["Inbox unificado", "Sofía · Asesora IA", "Etiquetado IA", "Campañas", "Scanner", "VoiceCRM"] },
            { title: "Recursos", links: ["Reporte diario", "Exportar leads", "Dashboard", "Integraciones"] },
            { title: "RealtyPlus", links: ["Red de franquicias", "Soporte", "Privacidad", "Términos"] },
          ].map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-white/70 text-xs uppercase tracking-widest mb-4">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => <li key={l}><span className="text-white/45 text-sm">{l}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/30 text-xs">
          <span>© {new Date().getFullYear()} RealtyPlus · Servicios Inmobiliarios Plus Sur SL</span>
          <span className="font-mono">Hecho por AI-MaX Intelligence</span>
        </div>
      </div>
    </footer>
  );
}

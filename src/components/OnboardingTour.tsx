import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowRight, ArrowLeft, X, Sparkles, Bot,
  Megaphone, Radar, ScanSearch, MessagesSquare,
  MessageCircle, LayoutDashboard, CheckCircle2, Zap,
} from "lucide-react";
import lexLogo from "@/assets/lexhouse-logo.webp";

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const STORAGE_KEY = "nexus_onboarding_v1_done";

const MODULOS = [
  { icon: LayoutDashboard, label: "Dashboard",      num: "01" },
  { icon: Megaphone,       label: "Campañas · IA",  num: "02" },
  { icon: Radar,           label: "Buscar Leads",   num: "03" },
  { icon: ScanSearch,      label: "Escáner",        num: "04" },
  { icon: MessagesSquare,  label: "Inbox IA",       num: "05" },
  { icon: MessageCircle,   label: "Reactivación",   num: "06" },
];

const FLUJO = [
  { icon: Megaphone,    label: "Campaña",      desc: "Lanzas a tu base de contactos" },
  { icon: Bot,          label: "Sofía responde", desc: "IA atiende 24/7 por WhatsApp" },
  { icon: ScanSearch,   label: "Califica",     desc: "Leads organizados por intención" },
  { icon: CheckCircle2, label: "Tú cierras",   desc: "Solo los leads que valen tu tiempo" },
];

/* ─── Componente principal ───────────────────────────────────────────────── */

export function OnboardingTour() {
  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const navigate              = useNavigate();
  const finishedRef           = useRef(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => setActive(true), 650);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => {
    setAnimKey(k => k + 1);
    setStep(Math.max(0, Math.min(3, next)));
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    localStorage.setItem(STORAGE_KEY, "1");
    document.body.style.overflow = "";
    setActive(false);
  };

  const handleCTA = () => {
    finish();
    navigate("/campaigns");
  };

  if (!active) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a LexHouse PLUS"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        background: "rgba(0,30,60,0.82)",
        backdropFilter: "blur(4px)",
        cursor: "default",
      }}
    >
      <div style={{
        position: "relative", width: "100%", maxWidth: "672px",
        overflow: "hidden", borderRadius: "16px",
        background: "#fff", border: "1px solid #dde3ee",
        boxShadow: "0 32px 64px -12px rgba(0,30,60,0.45)",
      }}>

        {/* ── Header ── */}
        <div style={{ background: "#003366", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "1rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                borderRadius: "10px", background: "rgba(255,255,255,0.12)", padding: "6px",
              }}>
                <img src={lexLogo} alt="LexHouse PLUS" style={{ height: "28px", width: "auto" }} />
              </span>
              <div style={{ lineHeight: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#fff" }}>LexHouse PLUS</p>
                <p style={{ margin: "3px 0 0", fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#ff6b6b", fontFamily: "monospace" }}>
                  CRM · Onboarding
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}
                    className="hidden sm:inline">
                Paso 0{step + 1} de 04
              </span>
              <button
                onClick={finish}
                aria-label="Cerrar"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "28px", width: "28px", borderRadius: "50%",
                  border: "none", background: "transparent",
                  color: "rgba(255,255,255,0.45)", cursor: "pointer",
                  transition: "background 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Barra de progreso en rojo */}
          <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                height: "3px", flex: 1, borderRadius: "999px",
                background: i <= step ? "#cf142b" : "rgba(255,255,255,0.12)",
                transition: "background 0.4s ease",
              }} />
            ))}
          </div>
        </div>

        {/* ── Contenido animado ── */}
        <div key={animKey} style={{ padding: "2.25rem 2.5rem", animation: "nexObUp 0.35s cubic-bezier(.25,.46,.45,.94) both" }}
             className="sm:px-10">
          {step === 0 && <StepBienvenida onNext={() => go(1)} onSkip={finish} />}
          {step === 1 && <StepModulos    onNext={() => go(2)} onSkip={finish} />}
          {step === 2 && <StepFlujo      onNext={() => go(3)} onSkip={finish} />}
          {step === 3 && <StepListos     onCTA={handleCTA}   onSkip={finish} />}
        </div>

        {/* ── Pie de navegación ── */}
        {step > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 2rem", borderTop: "1px solid #eef1f8", background: "#f8f9fc",
          }}>
            <button
              onClick={() => go(step - 1)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: "#334155", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
            >
              <ArrowLeft size={14} /> Atrás
            </button>
            <button
              onClick={finish}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: "#334155", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
            >
              <X size={14} /> Cerrar (retomar luego)
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes nexObUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* ─── Estilos compartidos ────────────────────────────────────────────────── */

const EYEBROW: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "8px",
  borderRadius: "999px", padding: "4px 12px",
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
  fontFamily: "monospace", color: "#003366",
  background: "#eef3fa", border: "1px solid #d0daea",
};

const H2: React.CSSProperties = {
  margin: "14px 0 0",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontWeight: 700,
  fontSize: "clamp(1.5rem, 4vw, 2.1rem)",
  lineHeight: 1.12,
  color: "#0d1f33",
};

const BODY: React.CSSProperties = {
  margin: "14px 0 0", fontSize: "15px", lineHeight: 1.65, color: "#334155",
};

const BTN_RED: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  background: "#cf142b", color: "#fff",
  fontWeight: 700, fontSize: "14px", padding: "10px 22px",
  borderRadius: "8px", border: "none", cursor: "pointer",
  transition: "background 0.2s, transform 0.15s",
};

const BTN_NAVY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  background: "#003366", color: "#fff",
  fontWeight: 700, fontSize: "14px", padding: "10px 22px",
  borderRadius: "8px", border: "none", cursor: "pointer",
  transition: "background 0.2s, transform 0.15s",
};

const SKIP: React.CSSProperties = {
  fontSize: "13px", color: "#334155", background: "none", border: "none",
  cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px",
};

const ICON_CELL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: "32px", width: "32px", borderRadius: "8px",
  background: "rgba(0,51,102,0.08)", color: "#003366", flexShrink: 0,
};

/* ─── Paso 1 — Bienvenida ────────────────────────────────────────────────── */

function StepBienvenida({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const bullets = [
    { icon: Bot,          text: "Sofía, tu asesora IA, responde y califica leads por WhatsApp las 24/7" },
    { icon: Megaphone,    text: "Lanza campañas masivas y mide cada conversión en tiempo real" },
    { icon: ScanSearch,   text: "El Escáner detecta nuevos leads antes de que te contacten ellos" },
  ];
  return (
    <div>
      <span style={EYEBROW}><Sparkles size={13} /> Paso 01 · Bienvenido</span>
      <h2 style={H2}>
        Tu CRM que captura leads,{" "}
        <em style={{ color: "#cf142b", fontStyle: "italic" }}>mientras Sofía los trabaja.</em>
      </h2>
      <p style={BODY}>
        LexHouse PLUS es el CRM inmobiliario con IA para agencias que quieren captar más sin trabajar el doble. Automatiza el primer contacto, clasifica la intención y organiza tu pipeline.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: "12px" }}>
        {bullets.map(({ icon: Icon, text }) => (
          <li key={text} style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px", color: "#334155" }}>
            <span style={{ ...ICON_CELL, marginTop: "2px" }}><Icon size={15} /></span>
            {text}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <button style={BTN_RED} onClick={onNext}>
          Comenzar <ArrowRight size={15} style={{ marginLeft: "8px" }} />
        </button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

/* ─── Paso 2 — Módulos ───────────────────────────────────────────────────── */

function StepModulos({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><Zap size={13} /> Paso 02 · Módulos del CRM</span>
      <h2 style={H2}>
        Todo el flujo.{" "}
        <em style={{ color: "#cf142b", fontStyle: "italic" }}>Un solo panel.</em>
      </h2>
      <p style={BODY}>Cada sección del menú cubre una etapa de la captación. Úsalas en orden o salta directo a la que necesites.</p>
      <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}
           className="sm:grid-cols-3">
        {MODULOS.map(({ icon: Icon, label, num }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: "10px",
            borderRadius: "12px", padding: "12px 14px",
            background: "#eef3fa", border: "1px solid #d0daea",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 700, color: "#cf142b", flexShrink: 0 }}>{num}</span>
            <Icon size={15} style={{ color: "#003366", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0d1f33" }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <button style={BTN_RED} onClick={onNext}>
          Siguiente <ArrowRight size={15} style={{ marginLeft: "8px" }} />
        </button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

/* ─── Paso 3 — El flujo ──────────────────────────────────────────────────── */

function StepFlujo({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const nodes: React.ReactNode[] = [];
  FLUJO.forEach(({ icon: Icon, label, desc }, i) => {
    nodes.push(
      <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "44px", width: "44px", borderRadius: "12px", marginBottom: "8px",
          background: "#eef3fa", border: "1px solid #d0daea",
        }}>
          <Icon size={19} style={{ color: "#003366" }} />
        </span>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#0d1f33" }}>{label}</p>
        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#7a8a9a", lineHeight: 1.3 }}>{desc}</p>
      </div>,
    );
    if (i < FLUJO.length - 1) {
      nodes.push(
        <ArrowRight key={`a${i}`} size={16} style={{ color: "#cf142b", flexShrink: 0, marginTop: "14px" }} />,
      );
    }
  });

  return (
    <div>
      <span style={EYEBROW}><ArrowRight size={13} /> Paso 03 · El flujo</span>
      <h2 style={H2}>
        Del lead al cliente,{" "}
        <em style={{ color: "#cf142b", fontStyle: "italic" }}>en automático.</em>
      </h2>
      <p style={BODY}>Sofía gestiona el primer contacto por ti. Cuando el lead ya está calificado, el CRM te lo entrega listo para cerrar.</p>
      <div style={{ marginTop: "20px", display: "flex", alignItems: "flex-start", gap: "4px" }}>
        {nodes}
      </div>
      <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <button style={BTN_RED} onClick={onNext}>
          Siguiente <ArrowRight size={15} style={{ marginLeft: "8px" }} />
        </button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

/* ─── Paso 4 — Listo ─────────────────────────────────────────────────────── */

function StepListos({ onCTA, onSkip }: { onCTA: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><CheckCircle2 size={13} /> Paso 04 · ¡Listo!</span>
      <h2 style={H2}>
        Activa tu{" "}
        <em style={{ color: "#cf142b", fontStyle: "italic" }}>primera campaña.</em>
      </h2>
      <p style={BODY}>
        Ve a Campañas, elige o crea tu lista de contactos y lanza. Sofía toma el control del primer contacto automáticamente.
      </p>
      <div style={{
        marginTop: "20px", borderRadius: "12px", padding: "14px 16px",
        background: "rgba(207,20,43,0.05)", border: "1px solid rgba(207,20,43,0.2)",
        fontSize: "13px", color: "#334155", lineHeight: 1.6,
      }}>
        💡 <strong style={{ color: "#0d1f33" }}>Consejo:</strong> instala LexHouse PLUS como app en tu móvil para gestionar leads desde cualquier lugar. Menú del browser → "Agregar a pantalla de inicio".
      </div>
      <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <button style={BTN_NAVY} onClick={onCTA}>
          Ir a Campañas <ArrowRight size={15} style={{ marginLeft: "8px" }} />
        </button>
        <button style={SKIP} onClick={onSkip}>Explorar primero</button>
      </div>
    </div>
  );
}

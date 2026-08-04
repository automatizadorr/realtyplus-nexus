import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowRight, ArrowLeft, X, Sparkles, Bot,
  Megaphone, Radar, ScanSearch, MessagesSquare,
  MessageCircle, LayoutDashboard, CheckCircle2, Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import lexLogo from "@/assets/lexhouse-logo.webp";

/* ─── Datos ──────────────────────────────────────────────────────────────── */

const META_KEY = "nexus_onboarding_v1_done";

const MODULOS = [
  { icon: LayoutDashboard, label: "Dashboard",      num: "01" },
  { icon: Megaphone,       label: "Campañas · IA",  num: "02" },
  { icon: Radar,           label: "Buscar Leads",   num: "03" },
  { icon: ScanSearch,      label: "Escáner",        num: "04" },
  { icon: MessagesSquare,  label: "Inbox IA",       num: "05" },
  { icon: MessageCircle,   label: "Reactivación",   num: "06" },
];

const FLUJO = [
  { icon: Megaphone,    label: "Campaña",        desc: "Lanzas a tu base de contactos" },
  { icon: Bot,          label: "Sofía responde", desc: "IA atiende 24/7 por WhatsApp" },
  { icon: ScanSearch,   label: "Califica",       desc: "Leads por intención de compra" },
  { icon: CheckCircle2, label: "Tú cierras",     desc: "Solo los leads que valen" },
];

/* ─── Componente principal ───────────────────────────────────────────────── */

export function OnboardingTour() {
  const { user }          = useAuth();
  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const navigate              = useNavigate();
  const finishedRef           = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (user.user_metadata?.[META_KEY]) return;
    const t = setTimeout(() => setActive(true), 650);
    return () => clearTimeout(t);
  }, [user]);

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
    document.body.style.overflow = "";
    setActive(false);
    supabase.auth.updateUser({ data: { [META_KEY]: true } }).catch(() => {});
  };

  const handleCTA = () => { finish(); navigate("/campaigns"); };

  if (!active) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Bienvenida a LexHouse PLUS" className="nx-ob-overlay">
      <div className="nx-ob-modal">

        {/* ── Header ── */}
        <div className="nx-ob-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", background: "rgba(255,255,255,0.12)", padding: "6px" }}>
                <img src={lexLogo} alt="LexHouse PLUS" style={{ height: "26px", width: "auto" }} />
              </span>
              <div style={{ lineHeight: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#fff" }}>LexHouse PLUS</p>
                <p className="nx-ob-subtitle">CRM · Onboarding</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="nx-ob-counter">Paso 0{step + 1} de 04</span>
              <button onClick={finish} aria-label="Cerrar" className="nx-ob-close"><X size={16} /></button>
            </div>
          </div>
          <div className="nx-ob-progress">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="nx-ob-seg" style={{ background: i <= step ? "#cf142b" : "rgba(255,255,255,0.12)" }} />
            ))}
          </div>
        </div>

        {/* ── Contenido ── */}
        <div key={animKey} className="nx-ob-body nx-ob-anim">
          {step === 0 && <StepBienvenida onNext={() => go(1)} onSkip={finish} />}
          {step === 1 && <StepModulos    onNext={() => go(2)} onSkip={finish} />}
          {step === 2 && <StepFlujo      onNext={() => go(3)} onSkip={finish} />}
          {step === 3 && <StepListos     onCTA={handleCTA}   onSkip={finish} />}
        </div>

        {/* ── Pie ── */}
        {step > 0 && (
          <div className="nx-ob-footer">
            <button onClick={() => go(step - 1)} className="nx-ob-nav-btn"><ArrowLeft size={14} /> Atrás</button>
            <button onClick={finish} className="nx-ob-nav-btn"><X size={14} /> Cerrar (retomar luego)</button>
          </div>
        )}
      </div>

      <style>{`
        .nx-ob-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem; background:rgba(0,30,60,0.82); backdrop-filter:blur(4px); cursor:default; }
        .nx-ob-modal { position:relative; width:100%; max-width:672px; max-height:90dvh; overflow-y:auto; overflow-x:hidden; border-radius:16px; background:#fff; border:1px solid #dde3ee; box-shadow:0 32px 64px -12px rgba(0,30,60,0.45); }
        .nx-ob-header { background:#003366; border-bottom:1px solid rgba(255,255,255,0.07); padding:1rem 2rem; }
        .nx-ob-subtitle { margin:3px 0 0; font-size:10px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:#ff6b6b; font-family:monospace; }
        .nx-ob-counter { font-size:10px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,255,255,.4); font-family:monospace; }
        .nx-ob-close { display:flex; align-items:center; justify-content:center; height:28px; width:28px; border-radius:50%; border:none; background:transparent; color:rgba(255,255,255,.45); cursor:pointer; transition:background .2s,color .2s; }
        .nx-ob-close:hover { background:rgba(255,255,255,.12); color:#fff; }
        .nx-ob-progress { display:flex; gap:6px; margin-top:14px; }
        .nx-ob-seg { height:3px; flex:1; border-radius:999px; transition:background .4s ease; }
        .nx-ob-body { padding:2.25rem 2.5rem; }
        @keyframes nxObUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .nx-ob-anim { animation:nxObUp .35s cubic-bezier(.25,.46,.45,.94) both; }
        .nx-ob-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 2rem; border-top:1px solid #eef1f8; background:#f8f9fc; }
        .nx-ob-nav-btn { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:#334155; background:none; border:none; cursor:pointer; padding:4px 0; }
        .nx-ob-flow { display:flex; align-items:flex-start; gap:4px; }
        .nx-ob-flow-item { flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; min-width:0; }
        .nx-ob-flow-icon { display:inline-flex; align-items:center; justify-content:center; height:44px; width:44px; border-radius:12px; margin-bottom:8px; background:#eef3fa; border:1px solid #d0daea; flex-shrink:0; }
        @media (max-width:639px) {
          .nx-ob-header { padding:.875rem 1.125rem; }
          .nx-ob-body   { padding:1.5rem 1.25rem; }
          .nx-ob-footer { padding:10px 1.125rem; }
          .nx-ob-counter { display:none; }
          .nx-ob-flow { flex-direction:column; gap:10px; }
          .nx-ob-flow-item { flex-direction:row; text-align:left; align-items:center; gap:12px; }
          .nx-ob-flow-icon { margin-bottom:0; height:38px; width:38px; }
          .nx-ob-flow-arrow { display:none !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* ─── Estilos compartidos ────────────────────────────────────────────────── */

const EYEBROW: React.CSSProperties = { display:"inline-flex", alignItems:"center", gap:"8px", borderRadius:"999px", padding:"4px 12px", fontSize:"10px", fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase", fontFamily:"monospace", color:"#003366", background:"#eef3fa", border:"1px solid #d0daea" };
const H2: React.CSSProperties = { margin:"12px 0 0", fontFamily:"Georgia,'Times New Roman',serif", fontWeight:700, fontSize:"clamp(1.35rem,4vw,2.05rem)", lineHeight:1.15, color:"#0d1f33" };
const BODY: React.CSSProperties = { margin:"12px 0 0", fontSize:"15px", lineHeight:1.65, color:"#334155" };
const BTN_RED: React.CSSProperties = { display:"inline-flex", alignItems:"center", background:"#cf142b", color:"#fff", fontWeight:700, fontSize:"14px", padding:"10px 20px", borderRadius:"8px", border:"none", cursor:"pointer" };
const BTN_NAVY: React.CSSProperties = { display:"inline-flex", alignItems:"center", background:"#003366", color:"#fff", fontWeight:700, fontSize:"14px", padding:"10px 20px", borderRadius:"8px", border:"none", cursor:"pointer" };
const SKIP: React.CSSProperties = { fontSize:"13px", color:"#334155", background:"none", border:"none", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:"3px" };
const ICON_CELL: React.CSSProperties = { display:"inline-flex", alignItems:"center", justifyContent:"center", height:"32px", width:"32px", borderRadius:"8px", background:"rgba(0,51,102,0.08)", color:"#003366", flexShrink:0 };
const ACTIONS: React.CSSProperties = { marginTop:"24px", display:"flex", flexWrap:"wrap", alignItems:"center", gap:"12px" };

/* ─── Pasos ──────────────────────────────────────────────────────────────── */

function StepBienvenida({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><Sparkles size={13} /> Paso 01 · Bienvenido</span>
      <h2 style={H2}>Tu CRM que captura leads, <em style={{ color:"#cf142b" }}>mientras Sofía los trabaja.</em></h2>
      <p style={BODY}>LexHouse PLUS es el CRM inmobiliario con IA para agencias que quieren captar más sin trabajar el doble. Automatiza el primer contacto y organiza tu pipeline.</p>
      <ul style={{ listStyle:"none", padding:0, margin:"18px 0 0", display:"flex", flexDirection:"column", gap:"10px" }}>
        {[
          { icon: Bot,        text: "Sofía, tu asesora IA, responde leads por WhatsApp las 24/7" },
          { icon: Megaphone,  text: "Lanza campañas masivas y mide cada conversión en tiempo real" },
          { icon: ScanSearch, text: "El Escáner detecta nuevas oportunidades antes que la competencia" },
        ].map(({ icon: Icon, text }) => (
          <li key={text} style={{ display:"flex", alignItems:"flex-start", gap:"12px", fontSize:"14px", color:"#334155" }}>
            <span style={{ ...ICON_CELL, marginTop:"2px" }}><Icon size={15} /></span>
            {text}
          </li>
        ))}
      </ul>
      <div style={ACTIONS}>
        <button style={BTN_RED} onClick={onNext}>Comenzar <ArrowRight size={15} style={{ marginLeft:"7px" }} /></button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

function StepModulos({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><Zap size={13} /> Paso 02 · Módulos del CRM</span>
      <h2 style={H2}>Todo el flujo. <em style={{ color:"#cf142b" }}>Un solo panel.</em></h2>
      <p style={BODY}>Cada sección cubre una etapa de la captación. Úsalas en orden o salta directo a la que necesites.</p>
      <div style={{ marginTop:"18px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
        {MODULOS.map(({ icon: Icon, label, num }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:"10px", borderRadius:"10px", padding:"10px 12px", background:"#eef3fa", border:"1px solid #d0daea" }}>
            <span style={{ fontFamily:"monospace", fontSize:"11px", fontWeight:700, color:"#cf142b", flexShrink:0 }}>{num}</span>
            <Icon size={14} style={{ color:"#003366", flexShrink:0 }} />
            <span style={{ fontSize:"12px", fontWeight:600, color:"#0d1f33" }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={ACTIONS}>
        <button style={BTN_RED} onClick={onNext}>Siguiente <ArrowRight size={15} style={{ marginLeft:"7px" }} /></button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

function StepFlujo({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><ArrowRight size={13} /> Paso 03 · El flujo</span>
      <h2 style={H2}>Del lead al cliente, <em style={{ color:"#cf142b" }}>en automático.</em></h2>
      <p style={BODY}>Sofía gestiona el primer contacto. Cuando el lead está calificado, el CRM te lo entrega listo para cerrar.</p>
      <div className="nx-ob-flow" style={{ marginTop:"18px" }}>
        {FLUJO.map(({ icon: Icon, label, desc }, i) => (
          <>
            <div key={label} className="nx-ob-flow-item">
              <span className="nx-ob-flow-icon"><Icon size={19} style={{ color:"#003366" }} /></span>
              <div>
                <p style={{ margin:0, fontSize:"12px", fontWeight:700, color:"#0d1f33" }}>{label}</p>
                <p style={{ margin:"2px 0 0", fontSize:"11px", color:"#7a8a9a", lineHeight:1.3 }}>{desc}</p>
              </div>
            </div>
            {i < FLUJO.length - 1 && (
              <ArrowRight key={`a${i}`} className="nx-ob-flow-arrow" size={15} style={{ color:"#cf142b", flexShrink:0, marginTop:"14px" }} />
            )}
          </>
        ))}
      </div>
      <div style={ACTIONS}>
        <button style={BTN_RED} onClick={onNext}>Siguiente <ArrowRight size={15} style={{ marginLeft:"7px" }} /></button>
        <button style={SKIP} onClick={onSkip}>Saltar por ahora</button>
      </div>
    </div>
  );
}

function StepListos({ onCTA, onSkip }: { onCTA: () => void; onSkip: () => void }) {
  return (
    <div>
      <span style={EYEBROW}><CheckCircle2 size={13} /> Paso 04 · ¡Listo!</span>
      <h2 style={H2}>Activa tu <em style={{ color:"#cf142b" }}>primera campaña.</em></h2>
      <p style={BODY}>Ve a Campañas, elige tu lista de contactos y lanza. Sofía toma el control del primer contacto automáticamente.</p>
      <div style={{ marginTop:"18px", borderRadius:"10px", padding:"12px 14px", background:"rgba(207,20,43,0.05)", border:"1px solid rgba(207,20,43,0.2)", fontSize:"13px", color:"#334155", lineHeight:1.6 }}>
        💡 <strong style={{ color:"#0d1f33" }}>Consejo:</strong> instala LexHouse PLUS como app en tu móvil para gestionar leads desde cualquier lugar. Menú del browser → "Agregar a pantalla de inicio".
      </div>
      <div style={ACTIONS}>
        <button style={BTN_NAVY} onClick={onCTA}>Ir a Campañas <ArrowRight size={15} style={{ marginLeft:"7px" }} /></button>
        <button style={SKIP} onClick={onSkip}>Explorar primero</button>
      </div>
    </div>
  );
}

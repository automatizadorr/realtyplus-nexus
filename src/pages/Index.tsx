import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceAgentHero } from "@/components/VoiceAgentHero";
import {
  MessageSquare,
  Megaphone,
  BarChart3,
  ArrowRight,
  Star,
  Menu,
  X,
  CheckCircle2,
  Zap,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Gift,
  Clock,
  Users,
  DollarSign,
  XCircle,
  ChevronDown,
  Phone,
} from "lucide-react";
import { RealEstatePlexus } from "@/components/auth/RealEstatePlexus";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function CountdownTimer() {
  const getEndOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  };
  const calc = () => {
    const diff = getEndOfMonth().getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-3 justify-center">
      {[{ v: t.d, l: "días" }, { v: t.h, l: "hrs" }, { v: t.m, l: "min" }, { v: t.s, l: "seg" }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <span className="text-2xl font-black text-white tabular-nums">{pad(v)}</span>
          <span className="text-white/40 text-xs">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
const FAQS = [
  { q: "¿Necesito saber de tecnología para usar RealtyPlus?", a: "No. El sistema está diseñado para agentes, no para técnicos. Si sabes usar WhatsApp, sabes usar RealtyPlus. Además incluimos setup 1:1 donde configuramos todo por ti en menos de 48 horas." },
  { q: "¿Qué pasa con los leads que ya tengo en mi celular?", a: "Los importamos todos. Subís tu lista de contactos (Excel, CSV o directamente desde WhatsApp) y el sistema los clasifica automáticamente por intención de compra en menos de 1 hora." },
  { q: "¿Funciona si trabajo solo o necesito un equipo?", a: "Funciona perfecto para agentes independientes y también para agencias con equipos de 50+ personas. El plan gratuito cubre a un solo usuario y los planes de equipo arrancan desde el primer mes de uso activo." },
  { q: "¿RealtyPlus reemplaza a mi WhatsApp Business?", a: "No lo reemplaza, lo potencia. RealtyPlus se conecta a tu número de WhatsApp existente y le agrega automatización, campañas masivas y métricas. Seguís usando el mismo número." },
  { q: "¿Y si no veo resultados en los primeros 30 días?", a: "Te devolvemos cada centavo sin preguntas. Podés cancelar desde el panel en un clic. No hay contratos anuales ni letras pequeñas." },
  { q: "¿Mis datos están seguros?", a: "Sí. Toda la información está encriptada en servidores certificados SOC 2. Nunca vendemos ni compartimos tus datos de clientes. Somos RGPD y LGPD compliant." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {FAQS.map((faq, i) => (
        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span className="font-semibold text-[#040d1e] text-sm md:text-base pr-4">{faq.q}</span>
            <ChevronDown className={`w-5 h-5 text-[#cf142b] shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-[#040d1e]/65 text-sm leading-relaxed border-t border-gray-50">
              <p className="pt-4">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Mockup ─────────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto" aria-hidden="true">
      {/* Ventana del browser */}
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
        {/* Barra del browser */}
        <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 ml-2">
            app.realtyplus.com/dashboard
          </div>
        </div>
        {/* Contenido del dashboard */}
        <div className="bg-[#040d1e] p-4 space-y-3">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Leads hoy", value: "47", color: "#cf142b" },
              { label: "Calientes", value: "12", color: "#f59e0b" },
              { label: "Cierres", value: "3", color: "#10b981" },
              { label: "Respuestas", value: "98%", color: "#3b82f6" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-white/40 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Inbox preview */}
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="text-white/60 text-xs font-semibold mb-2">Inbox unificado</div>
            {[
              { name: "Carlos M.", msg: "¿Tienen casas en Miraflores?", time: "hace 2 min", hot: true },
              { name: "Ana R.", msg: "Quiero información del dpto 203", time: "hace 8 min", hot: true },
              { name: "Luis P.", msg: "Cuál es el precio final?", time: "hace 15 min", hot: false },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                <div className="w-7 h-7 rounded-full bg-[#0f2b5a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-white text-xs font-semibold">{c.name}</span>
                    {c.hot && <span className="text-[10px] bg-[#cf142b]/20 text-[#cf142b] px-1.5 rounded-full">🔥 Caliente</span>}
                  </div>
                  <div className="text-white/40 text-[10px] truncate">{c.msg}</div>
                </div>
                <span className="text-white/25 text-[10px] shrink-0">{c.time}</span>
              </div>
            ))}
          </div>
          {/* Campaign bar */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white/60 text-xs font-semibold">Campaña activa</span>
              <span className="text-green-400 text-xs">● En vivo</span>
            </div>
            <div className="text-white text-xs mb-1">Reactivación Enero — 340 contactos</div>
            <div className="w-full h-1.5 bg-white/10 rounded-full">
              <div className="h-full bg-[#cf142b] rounded-full" style={{ width: "68%" }} />
            </div>
            <div className="text-white/30 text-[10px] mt-1">68% entregado · 23% respondieron</div>
          </div>
        </div>
      </div>
      {/* Glow decorativo */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-[#cf142b]/20 blur-xl rounded-full" />
    </div>
  );
}

// ─── Animated Counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, target, { duration: 2, ease: "easeOut", onUpdate: (v) => setValue(Math.round(v)) });
    return () => ctrl.stop();
  }, [inView, target]);
  return <span ref={ref}>{value.toLocaleString()}{suffix}</span>;
}

// ─── 3D Tilt Card ──────────────────────────────────────────────────────────────
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10]);
  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={className}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

// ─── Scroll fade-in wrapper ────────────────────────────────────────────────────
function FadeSection({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirigir al dashboard si ya está autenticado
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, authLoading, navigate]);


  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    { icon: MessageSquare, title: "Inbox Unificado",           desc: "Centraliza WhatsApp, email y redes sociales en un solo panel. Nunca pierdas un lead.",                       color: "#cf142b", bg: "#fff0f1" },
    { icon: Megaphone,     title: "Campañas Masivas",          desc: "Envía campañas personalizadas a miles de contactos con segmentación inteligente y alta entrega.",            color: "#0f2b5a", bg: "#f0f4ff" },
    { icon: BarChart3,     title: "Analytics en Tiempo Real",  desc: "Visualiza conversiones, tasas de apertura y ROI de cada campaña con dashboards interactivos.",               color: "#cf142b", bg: "#fff0f1" },
  ];

  const stats = [
    { value: 500, suffix: "+",  label: "Inmobiliarias activas" },
    { value: 2,   suffix: "M+", label: "Mensajes enviados" },
    { value: 98,  suffix: "%",  label: "Satisfacción del cliente" },
    { value: 3,   suffix: "x",  label: "Más conversiones" },
  ];

  const testimonials = [
    { name: "María González", role: "Directora Comercial · Inmobiliaria Norte", quote: "En el primer mes cerré 11 operaciones usando las campañas de reactivación. Antes promediaba 4 por mes.", avatar: "MG", result: "+175% cierres" },
    { name: "Carlos Mendoza", role: "CEO · PropTech Soluciones",                quote: "Pasamos de responder en 3 horas a responder en 40 segundos. Eso solo duplicó nuestra tasa de contacto.",    avatar: "CM", result: "40 seg respuesta" },
    { name: "Ana Rodríguez",  role: "Agente Independiente",                     quote: "Reactivé 200 leads dormidos en una tarde. 18 respondieron. 5 compraron. Fue el mejor mes de mi carrera.", avatar: "AR", result: "5 ventas de leads muertos" },
  ];

  return (
    <div className="relative bg-white text-[#040d1e] overflow-x-hidden">

      {/* ── Loading screen ── */}
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center transition-opacity duration-700"
        style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "all" }}
        aria-hidden={loaded}
      >
        <img src={realtyplusLogo} alt="RealtyPlus cargando" className="w-40 mb-8" width="160" height="60" />
        <div className="w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#cf142b] rounded-full transition-all duration-[1300ms] ease-in-out" style={{ width: loaded ? "100%" : "0%" }} />
        </div>
        <p className="mt-4 text-gray-400 text-sm">Cargando…</p>
      </div>

      {/* ── WhatsApp flotante ── */}
      <a
        href="https://wa.me/message/REALTYPLUS"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-110"
        style={{ background: "#25d366" }}
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* ── Nav ── */}
      <nav
        aria-label="Navegación principal"
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={realtyplusLogo} alt="RealtyPlus — CRM inmobiliario" className="h-9 w-auto" width="120" height="36" />

          <div className="hidden md:flex items-center gap-8 text-sm text-[#040d1e]/70">
            <a href="#oferta"        className="hover:text-[#cf142b] transition-colors">La oferta</a>
            <a href="#features"      className="hover:text-[#cf142b] transition-colors">Características</a>
            <a href="#testimonials"  className="hover:text-[#cf142b] transition-colors">Resultados</a>
            <a href="#faq"           className="hover:text-[#cf142b] transition-colors">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="px-4 py-2 text-sm text-[#040d1e]/70 hover:text-[#040d1e] transition-colors">
              Iniciar sesión
            </Link>
            <Link to="/auth" className="px-5 py-2 text-sm font-semibold bg-[#cf142b] hover:bg-[#e01530] text-white rounded-lg transition-colors shadow-sm">
              Comenzar gratis
            </Link>
          </div>

          <button
            aria-label={mobileMenu ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenu}
            className="md:hidden text-[#040d1e]/70 p-1"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-gray-100 px-6 py-4 flex flex-col gap-3">
            {[["#oferta","La oferta"],["#features","Características"],["#testimonials","Resultados"],["#faq","FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="text-[#040d1e]/70 hover:text-[#cf142b] text-sm py-1" onClick={() => setMobileMenu(false)}>{label}</a>
            ))}
            <Link to="/auth" className="mt-1 px-5 py-2.5 text-sm font-semibold bg-[#cf142b] text-white rounded-lg text-center" onClick={() => setMobileMenu(false)}>
              Comenzar gratis
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <main>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white" aria-labelledby="hero-heading">
        {/* Plexus solo en desktop */}
        {!isMobile && (
          <div className="absolute inset-0 z-[0] opacity-15" aria-hidden="true">
            <RealEstatePlexus />
          </div>
        )}
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-red-50/50 via-white/70 to-blue-50/50" aria-hidden="true" />

        <div className="relative z-[2] w-full max-w-7xl mx-auto px-6 pt-24 pb-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#cf142b]/30 bg-[#cf142b]/8 text-[#cf142b] text-xs font-semibold mb-6 tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                CRM Inmobiliario #1 en Latinoamérica
              </div>

              <h1 id="hero-heading" className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-5">
                <span className="text-[#040d1e]">Automatiza tu inmobiliaria.</span>{" "}
                <span style={{ background: "linear-gradient(90deg,#cf142b,#ff4d6d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Convierte más leads.
                </span>
              </h1>

              <p className="text-lg text-[#040d1e]/60 mb-8 leading-relaxed">
                Inbox centralizado, campañas WhatsApp y analytics en una sola plataforma.
                Responde en segundos, no en horas.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/auth" className="group flex items-center justify-center gap-2 px-8 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#cf142b]/25">
                  Empezar gratis ahora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </Link>
                <a href="#oferta" className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-[#0f2b5a]/20 hover:border-[#0f2b5a]/40 text-[#0f2b5a] font-semibold rounded-xl text-lg transition-all duration-200">
                  Ver la oferta completa
                </a>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-[#040d1e]/50">
                {["Sin tarjeta de crédito", "Setup en 5 minutos", "Soporte 24/7"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#cf142b]" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden md:block">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Agente de Voz IA ── */}
      <VoiceAgentHero />

      {/* ── Sección de ventas Hormozi ── */}
      <section id="oferta" className="py-28 px-6 bg-[#040d1e] text-white overflow-hidden" aria-labelledby="oferta-heading">
        <div className="max-w-4xl mx-auto">

          <FadeSection className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#cf142b]/20 text-[#cf142b] text-xs font-bold uppercase tracking-widest mb-6">
              Leer esto si eres agente inmobiliario
            </span>
            <h2 id="oferta-heading" className="text-4xl md:text-6xl font-black leading-tight mb-6">
              Cada día sin un sistema,{" "}
              <span className="text-[#cf142b]">estás regalando dinero</span>{" "}
              a tu competencia.
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              No es tu culpa. El mercado inmobiliario es caótico. Pero hay una razón
              por la que el 90% de los agentes gana lo mismo que hace 3 años.
            </p>
          </FadeSection>

          <FadeSection className="mb-20">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Recibes una consulta por WhatsApp a las 11pm, te quedas dormido y al día siguiente ya no contesta.",
                "Tienes 200 contactos en el celular que alguna vez preguntaron por una propiedad... y nunca les volviste a escribir.",
                "Tu competencia cierra en la primera llamada porque responde en 5 minutos. Tú tardas 3 horas.",
                "Mandas el mismo mensaje copiado y pegado a 50 personas. Uno por uno. Perdiendo 2 horas.",
                "No sabes cuántos leads tienes, cuántos son calientes, ni cuántos ya compraron con otro.",
                "Cada mes empiezas de cero buscando nuevos clientes cuando los que ya tienes podrían volver a comprar.",
              ].map((pain, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4 p-5 rounded-xl bg-white/5 border border-white/10"
                  whileHover={{ borderColor: "rgba(207,20,43,0.4)", backgroundColor: "rgba(207,20,43,0.05)" }}
                  transition={{ duration: 0.2 }}
                >
                  <XCircle className="w-5 h-5 text-[#cf142b] shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-white/70 text-sm leading-relaxed">{pain}</p>
                </motion.div>
              ))}
            </div>
          </FadeSection>

          <FadeSection className="text-center mb-20">
            <div className="inline-block p-8 rounded-2xl bg-[#cf142b]/10 border border-[#cf142b]/30">
              <TrendingDown className="w-12 h-12 text-[#cf142b] mx-auto mb-4" aria-hidden="true" />
              <p className="text-2xl font-bold text-white mb-2">
                El agente promedio pierde <span className="text-[#cf142b]">el 73% de sus leads</span>
              </p>
              <p className="text-white/55">por falta de seguimiento en las primeras 5 horas. No por falta de producto.</p>
            </div>
          </FadeSection>

          <FadeSection className="mb-20">
            <div className="text-center mb-12">
              <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-3xl md:text-4xl font-black text-white mb-4">Imagina que mañana al despertar…</h3>
              <p className="text-white/60 text-lg max-w-2xl mx-auto">
                Tu sistema ya respondió 40 consultas, reactivó 15 leads dormidos y te mandó un reporte de quién está listo para comprar.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Zap,      title: "Sistema de Captación Automática",    desc: "Cada lead que llega —WhatsApp, redes, web— entra solo a tu pipeline, recibe respuesta en segundos y queda clasificado por intención de compra.", tag: "Captación",    color: "#cf142b" },
                { icon: Users,    title: "Sistema de Reactivación de Leads",   desc: "Tu base de contactos dormidos es una mina de oro. Nuestro sistema los contacta automáticamente con el mensaje correcto en el momento correcto.",    tag: "Reactivación", color: "#3b82f6" },
                { icon: BarChart3, title: "CRM + Analytics Inmobiliario",      desc: "Panel central donde ves todo: quién está caliente, quién necesita seguimiento, cuánto llevas en comisiones y qué campañas funcionan.",             tag: "Control total", color: "#10b981" },
              ].map((item, i) => (
                <FadeSection key={item.title} delay={i * 0.1}>
                  <div className="h-full p-7 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 transition-colors">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4" style={{ background: `${item.color}22`, color: item.color }}>{item.tag}</span>
                    <item.icon className="w-8 h-8 mb-4" style={{ color: item.color }} aria-hidden="true" />
                    <h4 className="text-white font-bold text-lg mb-3">{item.title}</h4>
                    <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </FadeSection>
              ))}
            </div>
          </FadeSection>

          {/* Value Stack */}
          <FadeSection className="mb-20">
            <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="p-8 border-b border-white/10 text-center">
                <h3 className="text-2xl md:text-3xl font-black text-white">Todo lo que obtienes con RealtyPlus</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { item: "Sistema de Captación Automática 24/7",      value: "$497/mes" },
                  { item: "Sistema de Reactivación de Leads Dormidos", value: "$397/mes" },
                  { item: "CRM Inmobiliario Completo",                 value: "$297/mes" },
                  { item: "Campañas WhatsApp Masivas ilimitadas",      value: "$197/mes" },
                  { item: "Inbox Unificado (WhatsApp + redes + web)",  value: "$147/mes" },
                  { item: "Analytics y reportes en tiempo real",       value: "$97/mes"  },
                  { item: "Soporte prioritario 24/7",                  value: "$97/mes"  },
                  { item: "Onboarding y setup completo 1:1",           value: "$500 único" },
                ].map(({ item, value }) => (
                  <div key={item} className="flex items-center justify-between px-8 py-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" aria-hidden="true" />
                      <span className="text-white/80 text-sm">{item}</span>
                    </div>
                    <span className="text-white/35 text-sm line-through shrink-0 ml-4">{value}</span>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-white/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="text-white/50 text-sm mb-1">Valor total del sistema</p>
                    <p className="text-white/35 text-2xl font-bold line-through">$2,229/mes</p>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-white/50 text-sm mb-1">Tu inversión hoy</p>
                    <div className="flex items-baseline gap-2 justify-center md:justify-end">
                      <span className="text-5xl font-black text-[#cf142b]">Gratis</span>
                      <span className="text-white/40 text-lg">para empezar</span>
                    </div>
                    <p className="text-white/35 text-xs mt-1">Sin tarjeta · Cancela cuando quieras</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeSection>

          {/* Bonos */}
          <FadeSection className="mb-20">
            <h3 className="text-2xl font-black text-white text-center mb-8">
              <Gift className="w-7 h-7 text-[#cf142b] inline mr-2 -mt-1" aria-hidden="true" />
              Bonos exclusivos para los primeros 50
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Script de Cierre Inmobiliario",      desc: "El guión exacto que usan nuestros mejores agentes para cerrar en la primera llamada.", valor: "$197" },
                { title: "100 Mensajes de Reactivación",       desc: "Plantillas probadas para re-enganchar leads fríos. Solo copia, pega y personaliza.",   valor: "$97"  },
                { title: "Masterclass: Pipeline de 7 Figuras", desc: "Cómo construir un flujo de leads que genera comisiones mientras duermes.",             valor: "$297" },
                { title: "Setup Personalizado 1:1",            desc: "Un especialista configura tu cuenta desde cero en menos de 48 horas.",                  valor: "$500" },
              ].map((bonus) => (
                <div key={bonus.title} className="flex gap-4 p-6 rounded-2xl bg-gradient-to-br from-[#cf142b]/10 to-transparent border border-[#cf142b]/20">
                  <Gift className="w-6 h-6 text-[#cf142b] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold text-sm">{bonus.title}</span>
                      <span className="text-[#cf142b] text-xs font-bold">({bonus.valor} valor)</span>
                    </div>
                    <p className="text-white/50 text-xs leading-relaxed">{bonus.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeSection>

          {/* Garantía */}
          <FadeSection className="mb-20">
            <div className="flex flex-col md:flex-row items-center gap-8 p-8 rounded-3xl border-2 border-green-400/30 bg-green-400/5">
              <ShieldCheck className="w-20 h-20 text-green-400 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-2xl font-black text-white mb-3">Garantía de resultados 30 días</h3>
                <p className="text-white/65 leading-relaxed">
                  Si en 30 días de uso activo no ves un aumento en tus leads calificados,
                  te devolvemos cada centavo sin preguntas.{" "}
                  <strong className="text-white">Tú llevas cero riesgo.</strong>
                </p>
              </div>
            </div>
          </FadeSection>

          {/* Urgencia + Countdown */}
          <FadeSection>
            <div className="text-center">
              <div className="inline-block p-6 rounded-2xl bg-white/5 border border-white/10 mb-8">
                <div className="flex items-center gap-2 justify-center mb-4">
                  <Clock className="w-5 h-5 text-[#cf142b]" aria-hidden="true" />
                  <span className="text-white/70 text-sm font-semibold">Oferta con setup gratuito vence en:</span>
                </div>
                <CountdownTimer />
                <p className="text-white/35 text-xs mt-3">Solo quedan <strong className="text-white">23 cupos</strong> con setup 1:1 gratuito este mes</p>
              </div>

              <h3 className="text-4xl md:text-5xl font-black text-white mb-4">¿Sigues esperando el momento perfecto?</h3>
              <p className="text-white/55 text-lg mb-10 max-w-xl mx-auto">
                El momento perfecto fue hace 6 meses. El segundo mejor momento es hoy.
                Cada día que esperas, tu competencia cierra los leads que deberían ser tuyos.
              </p>
              <Link
                to="/auth"
                className="group inline-flex items-center gap-3 px-10 py-5 bg-[#cf142b] hover:bg-[#e01530] text-white font-black rounded-xl text-xl transition-all duration-200 hover:scale-105 shadow-2xl shadow-[#cf142b]/40"
              >
                <DollarSign className="w-6 h-6" aria-hidden="true" />
                Quiero mis leads automatizados
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
              <p className="mt-4 text-white/30 text-sm">Sin tarjeta · Sin contrato · Cancela cuando quieras</p>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6 bg-gray-50" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">Plataforma completa</span>
            <h2 id="features-heading" className="text-4xl md:text-5xl font-bold text-[#040d1e] mt-3 mb-4">
              Todo lo que necesitas para<br />cerrar más negocios
            </h2>
            <p className="text-[#040d1e]/50 text-lg max-w-xl mx-auto">
              Herramientas diseñadas para el mercado inmobiliario latinoamericano.
            </p>
          </FadeSection>
          <div className="grid md:grid-cols-3 gap-6" style={{ perspective: "1000px" }}>
            {features.map((f, i) => (
              <FadeSection key={f.title} delay={i * 0.12}>
                <TiltCard className="h-full">
                  <div className="h-full p-8 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-[#cf142b]/20 transition-all duration-300 group">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6" style={{ background: f.bg }}>
                      <f.icon className="w-7 h-7" style={{ color: f.color }} aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-bold text-[#040d1e] mb-3">{f.title}</h3>
                    <p className="text-[#040d1e]/55 leading-relaxed">{f.desc}</p>
                    <div className="mt-6 flex items-center gap-2 text-[#cf142b] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Explorar <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </div>
                </TiltCard>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="stats" className="py-24 px-6 bg-[#040d1e]" aria-labelledby="stats-heading">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-12">
            <h2 id="stats-heading" className="text-3xl font-black text-white">Números que no mienten</h2>
          </FadeSection>
          <FadeSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
              {stats.map((s, i) => (
                <FadeSection key={s.label} delay={i * 0.1}>
                  <div className="text-5xl md:text-6xl font-black text-white mb-3">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-white/50 text-sm font-medium">{s.label}</div>
                </FadeSection>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-28 px-6 bg-white" aria-labelledby="testimonials-heading">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">Resultados reales</span>
            <h2 id="testimonials-heading" className="text-4xl md:text-5xl font-bold text-[#040d1e] mt-3">
              Lo que dicen nuestros clientes
            </h2>
          </FadeSection>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeSection key={t.name} delay={i * 0.12}>
                <div className="h-full p-7 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-[#cf142b] text-[#cf142b]" aria-hidden="true" />
                      ))}
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">{t.result}</span>
                  </div>
                  <p className="text-[#040d1e]/70 leading-relaxed flex-1 text-base italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-[#cf142b]/10 border border-[#cf142b]/20 flex items-center justify-center text-[#cf142b] font-bold text-sm shrink-0" aria-hidden="true">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-[#040d1e] font-semibold text-sm">{t.name}</div>
                      <div className="text-[#040d1e]/40 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 px-6 bg-gray-50" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <FadeSection className="text-center mb-12">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">Preguntas frecuentes</span>
            <h2 id="faq-heading" className="text-4xl font-bold text-[#040d1e] mt-3 mb-4">
              Resolvemos tus dudas
            </h2>
            <p className="text-[#040d1e]/50">Si no encuentras tu respuesta aquí, escríbenos por WhatsApp.</p>
          </FadeSection>
          <FadeSection>
            <FAQ />
          </FadeSection>
          <FadeSection className="text-center mt-10">
            <a
              href="https://wa.me/message/REALTYPLUS"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-[#25d366] text-[#25d366] hover:bg-[#25d366] hover:text-white font-semibold transition-all duration-200"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              ¿Otra pregunta? Escríbenos por WhatsApp
            </a>
          </FadeSection>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 bg-white" aria-labelledby="cta-heading">
        <FadeSection>
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-12 md:p-20 rounded-3xl border-2 border-[#cf142b]/15 bg-white shadow-xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#cf142b]/5" aria-hidden="true" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-[#0f2b5a]/5" aria-hidden="true" />
              <h2 id="cta-heading" className="relative text-4xl md:text-5xl font-black text-[#040d1e] mb-5">
                Empieza hoy, <span className="text-[#cf142b]">sin costo.</span>
              </h2>
              <p className="relative text-[#040d1e]/55 text-lg mb-8 max-w-md mx-auto">
                Únete a más de 500 inmobiliarias que ya automatizan sus ventas con RealtyPlus.
              </p>
              <Link
                to="/auth"
                className="relative inline-flex items-center gap-3 px-10 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#cf142b]/25"
              >
                Comenzar gratis ahora
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </FadeSection>
      </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#040d1e] py-16 px-6" aria-labelledby="footer-heading">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <img src={realtyplusLogo} alt="RealtyPlus" className="h-10 w-auto mb-4 brightness-0 invert" width="130" height="40" />
              <p className="text-white/40 text-sm leading-relaxed">La plataforma CRM inmobiliaria más completa de Latinoamérica.</p>
            </div>
            {[
              { title: "Producto", links: ["Inbox Unificado","Campañas WhatsApp","Analytics","Automatizaciones","Integraciones"] },
              { title: "Empresa",  links: ["Acerca de","Blog","Clientes","Prensa","Trabaja con nosotros"] },
              { title: "Contacto", links: ["Soporte 24/7","Documentación","Estado del sistema","Política de privacidad","Términos de uso"] },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="text-white font-semibold mb-4 text-sm">{col.title}</h3>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-white/45 hover:text-white text-sm transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-xs">
            <span>© {new Date().getFullYear()} RealtyPlus. Todos los derechos reservados.</span>
            <span>Hecho con ❤️ para el mercado inmobiliario latinoamericano</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

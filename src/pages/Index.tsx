import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { RealEstatePlexus } from "@/components/auth/RealEstatePlexus";
import realtyplusLogo from "@/assets/realtyplus-logo.png";

// ─── Logo Circles ──────────────────────────────────────────────────────────────
function LogoCircles() {
  return (
    <>
      {/* Círculo grande rojo — izquierda */}
      <motion.div
        className="absolute -left-16 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-4 border-[#cf142b]/30 bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-[#cf142b]/10"
        animate={{ y: [0, -16, 0], rotate: [0, 3, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
      >
        <img src={realtyplusLogo} alt="RealtyPlus" className="w-36 h-auto object-contain p-4" />
      </motion.div>

      {/* Círculo mediano azul — derecha */}
      <motion.div
        className="absolute -right-12 top-1/3 w-48 h-48 rounded-full border-4 border-[#0f2b5a]/30 bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-[#0f2b5a]/10"
        animate={{ y: [0, 14, 0], rotate: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
      >
        <img src={realtyplusLogo} alt="RealtyPlus" className="w-28 h-auto object-contain p-3" />
      </motion.div>

      {/* Círculo pequeño rojo — arriba derecha */}
      <motion.div
        className="absolute right-20 top-8 w-32 h-32 rounded-full border-4 border-[#cf142b]/40 bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-[#cf142b]/15"
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.5 }}
      >
        <img src={realtyplusLogo} alt="RealtyPlus" className="w-20 h-auto object-contain p-2" />
      </motion.div>
    </>
  );
}

// ─── Animated Counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, target, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    {
      icon: MessageSquare,
      title: "Inbox Unificado",
      desc: "Centraliza WhatsApp, email y redes sociales en un solo panel. Nunca pierdas un lead.",
      color: "#cf142b",
      bg: "#fff0f1",
    },
    {
      icon: Megaphone,
      title: "Campañas Masivas",
      desc: "Envía campañas personalizadas a miles de contactos con segmentación inteligente.",
      color: "#0f2b5a",
      bg: "#f0f4ff",
    },
    {
      icon: BarChart3,
      title: "Analytics en Tiempo Real",
      desc: "Visualiza conversiones, tasas de apertura y ROI con dashboards interactivos.",
      color: "#cf142b",
      bg: "#fff0f1",
    },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Inmobiliarias activas" },
    { value: 2,   suffix: "M+", label: "Mensajes enviados" },
    { value: 98,  suffix: "%",  label: "Satisfacción del cliente" },
    { value: 3,   suffix: "x",  label: "Más conversiones" },
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Directora Comercial · Inmobiliaria Norte",
      quote: "Triplicamos nuestros cierres en 3 meses. La automatización de seguimiento es increíble.",
      avatar: "MG",
    },
    {
      name: "Carlos Mendoza",
      role: "CEO · PropTech Soluciones",
      quote: "El inbox unificado cambió cómo manejamos leads. Todo el equipo trabaja desde un solo panel.",
      avatar: "CM",
    },
    {
      name: "Ana Rodríguez",
      role: "Agente Independiente",
      quote: "Antes perdía el 60% de consultas. Con RealtyPlus tengo respuesta automática en segundos.",
      avatar: "AR",
    },
  ];

  return (
    <div className="relative bg-white text-[#040d1e] overflow-x-hidden">

      {/* ── Loading screen ── */}
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center transition-opacity duration-700"
        style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "all" }}
      >
        <img src={realtyplusLogo} alt="RealtyPlus" className="w-40 mb-8" />
        <div className="w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#cf142b] rounded-full transition-all duration-[1300ms] ease-in-out"
            style={{ width: loaded ? "100%" : "0%" }}
          />
        </div>
        <p className="mt-4 text-gray-400 text-sm tracking-wide">Cargando…</p>
      </div>

      {/* ── Nav ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={realtyplusLogo} alt="RealtyPlus" className="h-9 w-auto" />

          <div className="hidden md:flex items-center gap-8 text-sm text-[#040d1e]/70">
            {(["#features", "#stats", "#testimonials"] as const).map((href, i) => (
              <a key={href} href={href} className="hover:text-[#cf142b] transition-colors">
                {["Características", "Resultados", "Testimonios"][i]}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="px-4 py-2 text-sm text-[#040d1e]/70 hover:text-[#040d1e] transition-colors">
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="px-5 py-2 text-sm font-semibold bg-[#cf142b] hover:bg-[#e01530] text-white rounded-lg transition-colors shadow-sm"
            >
              Comenzar gratis
            </Link>
          </div>

          <button className="md:hidden text-[#040d1e]/70" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-gray-100 px-6 py-4 flex flex-col gap-4">
            {(["#features", "#stats", "#testimonials"] as const).map((href, i) => (
              <a key={href} href={href} className="text-[#040d1e]/70 hover:text-[#cf142b] text-sm" onClick={() => setMobileMenu(false)}>
                {["Características", "Resultados", "Testimonios"][i]}
              </a>
            ))}
            <Link to="/auth" className="px-5 py-2 text-sm font-semibold bg-[#cf142b] text-white rounded-lg text-center" onClick={() => setMobileMenu(false)}>
              Comenzar gratis
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
        {/* Plexus de fondo con baja opacidad */}
        <div className="absolute inset-0 z-[0] opacity-20">
          <RealEstatePlexus />
        </div>

        {/* Gradiente suave */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-red-50/60 via-white/80 to-blue-50/60" />

        {/* Círculos con logo */}
        <div className="absolute inset-0 z-[2] overflow-hidden">
          <LogoCircles />
        </div>

        {/* Contenido principal */}
        <div className="relative z-[3] max-w-3xl mx-auto px-6 text-center pt-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#cf142b]/30 bg-[#cf142b]/8 text-[#cf142b] text-xs font-semibold mb-6 tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5" />
            CRM Inmobiliario #1 en Latinoamérica
          </div>

          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            <span className="text-[#040d1e]">
              Automatiza tu inmobiliaria.{" "}
            </span>
            <span style={{
              background: "linear-gradient(90deg, #cf142b, #ff4d6d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Convierte más leads.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#040d1e]/60 max-w-xl mx-auto mb-10 leading-relaxed">
            Inbox centralizado, campañas WhatsApp y analytics en una sola plataforma.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="group flex items-center gap-2 px-8 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#cf142b]/25"
            >
              Comenzar gratis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 px-8 py-4 border-2 border-[#0f2b5a]/20 hover:border-[#0f2b5a]/40 text-[#0f2b5a] hover:text-[#040d1e] font-semibold rounded-xl text-lg transition-all duration-200"
            >
              Ver cómo funciona
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-[#040d1e]/40">
            {["Sin tarjeta de crédito", "Setup en 5 minutos", "Soporte 24/7"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#cf142b]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[3]"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          <div className="w-5 h-9 rounded-full border-2 border-[#040d1e]/20 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-[#040d1e]/30 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">
              Plataforma completa
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-[#040d1e] mt-3 mb-4">
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
                      <f.icon className="w-7 h-7" style={{ color: f.color }} />
                    </div>
                    <h3 className="text-xl font-bold text-[#040d1e] mb-3">{f.title}</h3>
                    <p className="text-[#040d1e]/55 leading-relaxed">{f.desc}</p>
                    <div className="mt-6 flex items-center gap-2 text-[#cf142b] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Explorar <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </TiltCard>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="stats" className="py-24 px-6 bg-[#040d1e]">
        <div className="max-w-7xl mx-auto">
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
      <section id="testimonials" className="py-28 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">
              Casos de éxito
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-[#040d1e] mt-3">
              Lo que dicen nuestros clientes
            </h2>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeSection key={t.name} delay={i * 0.12}>
                <div className="h-full p-7 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-[#cf142b] text-[#cf142b]" />
                    ))}
                  </div>
                  <p className="text-[#040d1e]/70 leading-relaxed flex-1 text-base italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-[#cf142b]/10 border border-[#cf142b]/20 flex items-center justify-center text-[#cf142b] font-bold text-sm shrink-0">
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

      {/* ── Final CTA ── */}
      <section className="py-28 px-6 bg-gray-50">
        <FadeSection>
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-12 md:p-20 rounded-3xl border-2 border-[#cf142b]/15 bg-white shadow-xl relative overflow-hidden">
              {/* Decoración */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#cf142b]/5" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-[#0f2b5a]/5" />

              <h2 className="relative text-4xl md:text-5xl font-black text-[#040d1e] mb-5">
                Empieza hoy,{" "}
                <span className="text-[#cf142b]">sin costo.</span>
              </h2>
              <p className="relative text-[#040d1e]/55 text-lg mb-8 max-w-md mx-auto">
                Únete a más de 500 inmobiliarias que ya automatizan sus ventas con RealtyPlus.
              </p>
              <Link
                to="/auth"
                className="relative inline-flex items-center gap-3 px-10 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-[#cf142b]/25"
              >
                Comenzar gratis ahora
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#040d1e] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <img src={realtyplusLogo} alt="RealtyPlus" className="h-10 w-auto mb-4 brightness-0 invert" />
              <p className="text-white/40 text-sm leading-relaxed">
                La plataforma CRM inmobiliaria más completa de Latinoamérica.
              </p>
            </div>

            {[
              { title: "Producto", links: ["Inbox Unificado", "Campañas WhatsApp", "Analytics", "Automatizaciones", "Integraciones"] },
              { title: "Empresa",  links: ["Acerca de", "Blog", "Clientes", "Prensa", "Trabaja con nosotros"] },
              { title: "Contacto", links: ["Soporte 24/7", "Documentación", "Estado del sistema", "Política de privacidad", "Términos de uso"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold mb-4 text-sm">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-white/45 hover:text-white text-sm transition-colors">{l}</a>
                    </li>
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

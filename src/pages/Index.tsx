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

// ─── Animated Counter ──────────────────────────────────────────────────────────
function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, target, {
      duration: 2.2,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [inView, target]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── 3D Tilt Card ──────────────────────────────────────────────────────────────
function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [12, -12]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-12, 12]);

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
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Fade-in-up section wrapper ────────────────────────────────────────────────
function FadeSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Index() {
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [cursor, setCursor] = useState({ x: -200, y: -200 });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    const onMove = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const features = [
    {
      icon: MessageSquare,
      title: "Inbox Unificado",
      desc: "Centraliza WhatsApp, email y redes sociales en un solo panel. Nunca pierdas un lead por falta de seguimiento.",
      color: "#cf142b",
    },
    {
      icon: Megaphone,
      title: "Campañas Masivas",
      desc: "Envía campañas personalizadas a miles de contactos con segmentación inteligente y alta tasa de entrega.",
      color: "#0f2b5a",
    },
    {
      icon: BarChart3,
      title: "Analytics en Tiempo Real",
      desc: "Visualiza conversiones, tasas de apertura y ROI de cada campaña con dashboards interactivos.",
      color: "#cf142b",
    },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Inmobiliarias activas" },
    { value: 2, suffix: "M+", label: "Mensajes enviados" },
    { value: 98, suffix: "%", label: "Satisfacción del cliente" },
    { value: 3, suffix: "x", label: "Más conversiones" },
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Directora Comercial · Inmobiliaria Norte",
      quote:
        "Triplicamos nuestros cierres en 3 meses. La automatización de seguimiento es increíble.",
      avatar: "MG",
    },
    {
      name: "Carlos Mendoza",
      role: "CEO · PropTech Soluciones",
      quote:
        "El inbox unificado cambió cómo manejamos leads. Todo el equipo trabaja desde un solo panel.",
      avatar: "CM",
    },
    {
      name: "Ana Rodríguez",
      role: "Agente Independiente",
      quote:
        "Antes perdía el 60% de consultas. Con RealtyPlus tengo respuesta automática en segundos.",
      avatar: "AR",
    },
  ];

  return (
    <div className="relative bg-[#040d1e] text-white overflow-x-hidden">
      {/* Cursor glow */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${cursor.x}px ${cursor.y}px, rgba(207,20,43,0.06), transparent 80%)`,
        }}
      />

      {/* ── Loading screen ── */}
      <motion.div
        className="fixed inset-0 z-50 bg-[#040d1e] flex flex-col items-center justify-center"
        style={{ pointerEvents: loading ? "all" : "none" }}
        initial={{ opacity: 1 }}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.img
          src={realtyplusLogo}
          alt="RealtyPlus"
          className="w-44 mb-8"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        />
        <div className="w-44 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#cf142b] rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.3, ease: "easeInOut" }}
          />
        </div>
      </motion.div>

      {/* ── Nav ── */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-[#040d1e]/90 backdrop-blur-md border-b border-white/5 shadow-lg"
            : ""
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ delay: 1.6, duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={realtyplusLogo} alt="RealtyPlus" className="h-9 w-auto" />

          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors">
              Características
            </a>
            <a href="#stats" className="hover:text-white transition-colors">
              Resultados
            </a>
            <a
              href="#testimonials"
              className="hover:text-white transition-colors"
            >
              Testimonios
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth"
              className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="px-5 py-2 text-sm font-semibold bg-[#cf142b] hover:bg-[#e01530] text-white rounded-lg transition-colors"
            >
              Comenzar gratis
            </Link>
          </div>

          <button
            className="md:hidden text-white/80 hover:text-white"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="md:hidden bg-[#040d1e]/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex flex-col gap-4"
          >
            <a
              href="#features"
              className="text-white/70 hover:text-white text-sm"
              onClick={() => setMobileMenu(false)}
            >
              Características
            </a>
            <a
              href="#stats"
              className="text-white/70 hover:text-white text-sm"
              onClick={() => setMobileMenu(false)}
            >
              Resultados
            </a>
            <a
              href="#testimonials"
              className="text-white/70 hover:text-white text-sm"
              onClick={() => setMobileMenu(false)}
            >
              Testimonios
            </a>
            <Link
              to="/auth"
              className="px-5 py-2 text-sm font-semibold bg-[#cf142b] text-white rounded-lg text-center"
              onClick={() => setMobileMenu(false)}
            >
              Comenzar gratis
            </Link>
          </motion.div>
        )}
      </motion.nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <RealEstatePlexus />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040d1e]/60 via-[#040d1e]/40 to-[#040d1e]" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.8 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#cf142b]/40 bg-[#cf142b]/10 text-[#cf142b] text-xs font-semibold mb-6 tracking-wide uppercase">
              <Zap className="w-3.5 h-3.5" /> CRM Inmobiliario #1 en
              Latinoamérica
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.8 }}
            className="text-5xl md:text-7xl font-black leading-tight mb-6"
          >
            <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
              Automatiza tu
              <br />
              inmobiliaria.{" "}
            </span>
            <span className="bg-gradient-to-r from-[#cf142b] to-[#ff4d6d] bg-clip-text text-transparent">
              Convierte más leads.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 0.7 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Inbox centralizado, campañas WhatsApp y analytics en una sola
            plataforma.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/auth"
              className="group flex items-center gap-2 px-8 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 shadow-lg shadow-[#cf142b]/30 hover:shadow-[#cf142b]/50 hover:scale-105"
            >
              Comenzar gratis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-semibold rounded-xl text-lg transition-all duration-200 backdrop-blur-sm"
            >
              Ver cómo funciona
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 0.8 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-white/40"
          >
            {[
              "Sin tarjeta de crédito",
              "Setup en 5 minutos",
              "Soporte 24/7",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#cf142b]" /> {item}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center pt-2"
          >
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">
              Plataforma completa
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
              Todo lo que necesitas para
              <br />
              cerrar más negocios
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Herramientas diseñadas específicamente para el mercado inmobiliario
              latinoamericano.
            </p>
          </FadeSection>

          <div
            className="grid md:grid-cols-3 gap-6"
            style={{ perspective: "1000px" }}
          >
            {features.map((f, i) => (
              <FadeSection key={f.title} delay={i * 0.15}>
                <TiltCard className="h-full">
                  <div className="h-full p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-[#cf142b]/40 transition-colors duration-300 group">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                      style={{ background: `${f.color}22` }}
                    >
                      <f.icon
                        className="w-7 h-7"
                        style={{ color: f.color }}
                      />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {f.title}
                    </h3>
                    <p className="text-white/55 leading-relaxed">{f.desc}</p>
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
      <section id="stats" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f2b5a]/60 to-[#040d1e] p-12 md:p-20 backdrop-blur-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                {stats.map((s, i) => (
                  <FadeSection key={s.label} delay={i * 0.1}>
                    <div className="text-5xl md:text-6xl font-black text-white mb-3">
                      <AnimatedCounter
                        target={s.value}
                        suffix={s.suffix}
                      />
                    </div>
                    <div className="text-white/50 text-sm font-medium">
                      {s.label}
                    </div>
                  </FadeSection>
                ))}
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16">
            <span className="text-[#cf142b] text-sm font-semibold uppercase tracking-widest">
              Casos de éxito
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">
              Lo que dicen nuestros clientes
            </h2>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeSection key={t.name} delay={i * 0.15}>
                <div className="h-full p-7 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 transition-colors duration-300 flex flex-col">
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-[#cf142b] text-[#cf142b]"
                      />
                    ))}
                  </div>
                  <p className="text-white/75 leading-relaxed flex-1 text-base italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/10">
                    <div className="w-10 h-10 rounded-full bg-[#cf142b]/20 border border-[#cf142b]/30 flex items-center justify-center text-[#cf142b] font-bold text-sm shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {t.name}
                      </div>
                      <div className="text-white/40 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28 px-6">
        <FadeSection>
          <div className="max-w-3xl mx-auto text-center relative">
            <motion.div
              className="absolute inset-0 -z-10 rounded-3xl"
              animate={{
                boxShadow: [
                  "0 0 80px 20px rgba(207,20,43,0.12)",
                  "0 0 140px 50px rgba(207,20,43,0.22)",
                  "0 0 80px 20px rgba(207,20,43,0.12)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            />
            <div className="p-12 md:p-20 rounded-3xl border border-[#cf142b]/30 bg-gradient-to-br from-[#cf142b]/10 to-transparent backdrop-blur-sm">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-5">
                Empieza hoy,
                <br />
                <span className="text-[#cf142b]">sin costo.</span>
              </h2>
              <p className="text-white/55 text-lg mb-8 max-w-md mx-auto">
                Únete a más de 500 inmobiliarias que ya automatizan sus ventas
                con RealtyPlus.
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-3 px-10 py-4 bg-[#cf142b] hover:bg-[#e01530] text-white font-bold rounded-xl text-lg transition-all duration-200 shadow-2xl shadow-[#cf142b]/40 hover:scale-105"
              >
                Comenzar gratis ahora
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </FadeSection>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <img
                src={realtyplusLogo}
                alt="RealtyPlus"
                className="h-10 w-auto mb-4"
              />
              <p className="text-white/40 text-sm leading-relaxed">
                La plataforma CRM inmobiliaria más completa de Latinoamérica.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">
                Producto
              </h4>
              <ul className="space-y-2.5 text-white/45 text-sm">
                {[
                  "Inbox Unificado",
                  "Campañas WhatsApp",
                  "Analytics",
                  "Automatizaciones",
                  "Integraciones",
                ].map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">
                Empresa
              </h4>
              <ul className="space-y-2.5 text-white/45 text-sm">
                {[
                  "Acerca de",
                  "Blog",
                  "Clientes",
                  "Prensa",
                  "Trabaja con nosotros",
                ].map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">
                Contacto
              </h4>
              <ul className="space-y-2.5 text-white/45 text-sm">
                {[
                  "Soporte 24/7",
                  "Documentación",
                  "Estado del sistema",
                  "Política de privacidad",
                  "Términos de uso",
                ].map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-xs">
            <span>
              © {new Date().getFullYear()} RealtyPlus. Todos los derechos
              reservados.
            </span>
            <span>
              Hecho con ❤️ para el mercado inmobiliario latinoamericano
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

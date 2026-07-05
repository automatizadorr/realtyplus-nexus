import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Check, Menu, X } from "lucide-react";
import realtyplusLogo from "@/assets/realtyplus-logo.png";
import { HydroRipple, HydroRippleHandle } from "@/components/ui/hydro-ripple";
import {
  INK, BLUE, BLUE_LT, BRAND, SIGNAL, EASE,
  heroContainer, heroItem,
  FadeSection, Serif, Magnetic,
} from "@/components/landing/landing-helpers";
import { LiveConversation, WhatsAppFloat } from "@/components/landing/LandingWidgets";
import {
  CarruselSection, ComoSection, FuncionesSection, VozSection,
  ReporteSection, StatsSection, FAQSection, CTASection, LandingFooter,
} from "@/components/landing/LandingSections";

const NAV_LINKS = [["#como", "Cómo funciona"], ["#funciones", "Funciones"], ["#voz", "Voz IA"], ["#reporte", "Reporte diario"], ["#faq", "FAQ"]];

export default function Index() {
  const [loaded, setLoaded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  // Parallax sutil del hero
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -46]);

  // Efecto hidro: mouse → ripple canvas
  const rippleRef = useRef<HydroRippleHandle>(null);
  const heroLastPos = useRef({ x: -9999, y: -9999 });
  const onHeroEnter = useCallback((e: React.MouseEvent) => {
    rippleRef.current?.triggerSplash(e.clientX, e.clientY, "enter");
    heroLastPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onHeroMove = useCallback((e: React.MouseEvent) => {
    const dx = e.clientX - heroLastPos.current.x;
    const dy = e.clientY - heroLastPos.current.y;
    if (dx * dx + dy * dy < 50 * 50) return;
    rippleRef.current?.triggerSplash(e.clientX, e.clientY, "trail");
    heroLastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (!authLoading && session) navigate("/dashboard", { replace: true });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative bg-white font-sans" style={{ color: INK }}>

      {/* Splash de carga */}
      <div className="fixed inset-0 z-50 grid place-items-center transition-opacity duration-500"
           style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "all",
                    background: "radial-gradient(130% 120% at 50% -10%, #eef3fb 0%, #ffffff 58%)" }}
           aria-hidden={loaded} role="status" aria-label="Cargando RealtyPlus">
        <motion.div initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: EASE }}
                    className="flex flex-col items-center gap-6 rounded-[28px] bg-white px-12 py-10 border border-slate-100"
                    style={{ boxShadow: "0 24px 70px -24px rgba(2,27,77,0.28), 0 2px 8px -2px rgba(2,27,77,0.08)" }}>
          <img src={realtyplusLogo} alt="RealtyPlus" className="w-44 h-auto" width={176} height={68} />
          <div className="w-44 h-1 rounded-full overflow-hidden" style={{ background: "#eef1f6" }}>
            {reduce ? (
              <div className="h-full w-1/2 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${BLUE}, ${BRAND})` }} />
            ) : (
              <motion.div className="h-full w-2/5 rounded-full" style={{ background: `linear-gradient(90deg, ${BLUE}, ${BRAND})` }}
                          animate={{ x: ["-120%", "320%"] }} transition={{ repeat: Infinity, duration: 1.15, ease: "easeInOut" }} />
            )}
          </div>
        </motion.div>
      </div>

      <WhatsAppFloat />

      {/* Nav */}
      <nav aria-label="Navegación principal"
           className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
             scrolled ? "bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm" : "bg-transparent"
           }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={realtyplusLogo} alt="RealtyPlus Nexus" className="h-8 w-auto" width="120" height="32" />
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-[#E11D34] transition-colors">{label}</a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link to="/auth" className="px-4 py-2 text-sm text-slate-600 hover:text-[#0A1228] transition-colors">Iniciar sesión</Link>
            <Link to="/auth" className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-transform hover:scale-105"
                  style={{ background: BRAND }}>Comenzar gratis</Link>
          </div>
          <button aria-label={mobileMenu ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileMenu}
                  className="md:hidden text-slate-600 p-1" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex flex-col gap-3">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="text-slate-600 text-sm py-1" onClick={() => setMobileMenu(false)}>{label}</a>
            ))}
            <Link to="/auth" className="mt-1 px-5 py-2.5 text-sm font-semibold text-white rounded-lg text-center"
                  style={{ background: BRAND }} onClick={() => setMobileMenu(false)}>Comenzar gratis</Link>
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ── */}
        <section ref={heroRef} className="relative overflow-hidden" style={{ background: INK }}
                 aria-labelledby="hero-heading" onMouseEnter={onHeroEnter} onMouseMove={onHeroMove}>
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            <HydroRipple ref={rippleRef} src="/landing/hero-office.jpg" alt="" cover passthrough
                         className="absolute inset-0 w-full h-full" imgClassName="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: `linear-gradient(180deg, ${INK}cc 0%, ${INK}a6 48%, ${INK}e0 100%)` }} />
          </div>
          <motion.div className="absolute inset-0 opacity-[0.06] will-change-transform" aria-hidden="true"
                      style={{ y: reduce ? 0 : gridY, backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
          <motion.div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-25 will-change-transform" style={{ y: reduce ? 0 : glowY, background: BRAND }} aria-hidden="true" />
          <motion.div className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-25 will-change-transform" style={{ y: reduce ? 0 : glowY, background: BLUE }} aria-hidden="true" />

          <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-20 lg:pt-32 lg:pb-28">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
              <motion.div variants={heroContainer} initial={reduce ? false : "hidden"} animate={reduce ? false : (loaded ? "show" : "hidden")}>
                <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 mb-7">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND }} />
                  <span className="font-mono text-[11px] tracking-wide text-white/70">CRM inmobiliario · sobre WhatsApp</span>
                </motion.div>

                <h1 id="hero-heading" className="font-display font-extrabold text-white leading-[1.02] tracking-tight text-[2.6rem] sm:text-6xl"
                    style={{ textShadow: "0 2px 30px rgba(2,27,77,0.6)" }}>
                  <motion.span variants={heroItem} className="block">
                    De un <span className="font-serif italic font-medium tracking-normal text-[1.06em]" style={{ color: SIGNAL }}>"hola"</span> en WhatsApp
                  </motion.span>
                  <motion.span variants={heroItem} className="block">
                    a una <span className="font-serif italic font-medium tracking-normal text-[1.06em]" style={{ color: BRAND }}>cita agendada</span>.
                  </motion.span>
                </h1>

                <motion.p variants={heroItem} className="mt-6 text-lg leading-relaxed text-white/75 max-w-xl"
                          style={{ textShadow: "0 1px 16px rgba(2,27,77,0.55)" }}>
                  <strong className="text-white">Sofía</strong>, tu asesora con IA, responde en segundos,
                  califica cada lead por intención y agenda la reunión en tu calendario. Tú solo cierras.
                </motion.p>

                <motion.div variants={heroItem} className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Magnetic>
                    <Link to="/auth" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 font-bold text-white rounded-xl text-[15px] transition-transform hover:scale-[1.03]"
                          style={{ background: BRAND, boxShadow: `0 12px 30px ${BRAND}40` }}>
                      Comenzar gratis
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                    </Link>
                  </Magnetic>
                  <a href="#como" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 font-semibold text-white rounded-xl text-[15px] border border-white/15 hover:bg-white/5 transition-colors">
                    Ver cómo funciona
                  </a>
                </motion.div>

                <motion.div variants={heroItem} className="mt-8 flex flex-wrap gap-2 font-mono text-[11px]">
                  {["Sobre tu propio WhatsApp", "Agenda en Google Calendar", "Reporte diario 08:00"].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.05] text-white/60 backdrop-blur-sm">
                      <Check className="w-3.5 h-3.5" style={{ color: BLUE_LT }} aria-hidden="true" />{t}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div className="pt-6 lg:pt-0 will-change-transform" style={{ y: reduce ? 0 : cardY }}>
                <LiveConversation />
              </motion.div>
            </div>
          </div>

          {!reduce && (
            <motion.a href="#carrusel" aria-label="Desplázate para ver más"
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.8, ease: EASE }}>
              <span className="font-mono text-[10px] tracking-widest uppercase">Scroll</span>
              <motion.span className="w-5 h-8 rounded-full border border-white/25 grid place-items-start justify-center pt-1.5"
                           animate={{ y: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                <span className="w-1 h-1.5 rounded-full" style={{ background: BLUE_LT }} />
              </motion.span>
            </motion.a>
          )}
        </section>

        <CarruselSection />
        <ComoSection />
        <FuncionesSection />
        <VozSection />
        <ReporteSection />
        <StatsSection />
        <FAQSection />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  );
}

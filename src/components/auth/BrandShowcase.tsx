import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Globe2, Users, Quote, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Realtyplus transformó nuestra forma de captar leads. En 6 meses duplicamos las operaciones cerradas.",
    author: "María Fernández",
    role: "Franquiciada Master · Madrid",
  },
  {
    quote:
      "La red internacional nos abrió puertas en mercados que jamás imaginamos. Un soporte impecable.",
    author: "Carlos Mendoza",
    role: "Director · Santa Cruz",
  },
  {
    quote:
      "El CRM y el bot de WhatsApp son una combinación letal. Mis agentes no pierden ni un solo contacto.",
    author: "Lucía Ramírez",
    role: "Broker · Ciudad de México",
  },
  {
    quote:
      "InvestPlus me dio acceso a oportunidades off-market que ningún otro portal ofrece.",
    author: "Andrés Torres",
    role: "Inversor · Bogotá",
  },
];

const METRICS = [
  { icon: Building2, value: "120+", label: "Oficinas activas" },
  { icon: Globe2, value: "14", label: "Países en la red" },
  { icon: Users, value: "1.800+", label: "Agentes certificados" },
];

export function BrandShowcase() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const t = TESTIMONIALS[index];

  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      {/* Fondo navy con gradiente y acentos */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #0a1f47 0%, #0f2b5a 45%, #142f63 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-60 mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 15% 10%, rgba(207,20,43,0.35), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 95%, rgba(64,120,220,0.30), transparent 65%)",
        }}
      />
      {/* Grid arquitectónico */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 90%)",
        }}
      />
      {/* Chevron decorativo grande tipo logo */}
      <svg
        className="absolute -top-10 -right-10 w-[420px] h-[420px] opacity-[0.07]"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
      >
        <path
          d="M20 130 L100 50 L180 130"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 170 L100 90 L180 170"
          stroke="#cf142b"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative z-10 h-full flex flex-col justify-between p-10 lg:p-12">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/60 font-semibold">
            <span className="block h-px w-8 bg-[#cf142b]" />
            Red Internacional
          </div>
          <h2 className="mt-6 text-3xl lg:text-4xl font-extrabold leading-tight">
            Conectamos personas,
            <br />
            <span className="text-[#ff6b7d]">construimos hogares.</span>
          </h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
            Más de dos décadas impulsando a profesionales inmobiliarios con
            tecnología, formación y una red global en expansión.
          </p>
        </div>

        {/* Testimonio rotativo */}
        <div className="my-8">
          <div className="rounded-2xl bg-white/5 backdrop-blur-md ring-1 ring-white/10 p-6 shadow-xl min-h-[180px] flex flex-col justify-between">
            <Quote className="h-6 w-6 text-[#ff6b7d] shrink-0" />
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mt-3 flex-1 flex flex-col"
              >
                <p className="text-[15px] leading-relaxed text-white/95 italic">
                  "{t.quote}"
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#cf142b] to-[#7a0a18] flex items-center justify-center text-xs font-bold shadow-md">
                    {t.author
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.author}</p>
                    <p className="text-xs text-white/60">{t.role}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 fill-[#ffc940] text-[#ffc940]"
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Indicadores */}
          <div className="mt-3 flex gap-1.5 justify-center">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Testimonio ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-8 bg-[#cf142b]"
                    : "w-1.5 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {METRICS.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i + 0.2, duration: 0.5 }}
              className="rounded-xl bg-white/5 backdrop-blur-sm ring-1 ring-white/10 p-4 hover:bg-white/10 transition-colors"
            >
              <Icon className="h-5 w-5 text-[#ff6b7d] mb-2" />
              <p className="text-2xl font-extrabold tracking-tight">{value}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/60 mt-0.5">
                {label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

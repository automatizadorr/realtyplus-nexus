import { useEffect, useState } from "react";

/*
  SocialRail — columna de accesos a las redes sociales de LexHouse AI.

  Vive dentro del dock flotante de agentes (EcosystemAgentsFab / WhatsAppFloatingButton),
  justo ENCIMA del agente de voz Lex, en el costado derecho de la pantalla.

  Diseño alineado con el dock para que se lea como una misma familia:
  - Medallón circular blanco con anillo azabache (igual que la burbuja de Lex),
    solo que un punto más pequeño para que los agentes sigan mandando.
  - Logo oficial de cada red (SVG propio en /public/redes), siempre a color.
  - Al pasar el puntero: el anillo toma el color de la red, el medallón sube y
    aparece el mismo tooltip oscuro que usan los agentes, con su call to action.
  - Entrada sincronizada: los cuatro aparecen en cascada de 70 ms al montar.
*/

const AZABACHE = "#0B0B0F";

type Network = {
  id: string;
  href: string;
  icon: string;
  title: string;
  sub: string;
  /** Color de marca para el anillo y el halo al pasar el puntero. */
  brand: string;
};

const NETWORKS: Network[] = [
  {
    id: "instagram",
    href: "https://www.instagram.com/lexhouse.ia/",
    icon: "/redes/instagram.svg",
    title: "Síguenos en Instagram",
    sub: "@lexhouse.ia · Casos y reels",
    brand: "#D6249F",
  },
  {
    id: "tiktok",
    href: "https://www.tiktok.com/@lexhouse.ai",
    icon: "/redes/tiktok.svg",
    title: "Míranos en TikTok",
    sub: "@lexhouse.ai · IA en 30 seg",
    brand: "#FE2C55",
  },
  {
    id: "youtube",
    href: "https://www.youtube.com/@LEXHOUSEIA",
    icon: "/redes/youtube.svg",
    title: "Mira nuestros videos",
    sub: "@LEXHOUSEIA · Demos completas",
    brand: "#FF0000",
  },
  {
    id: "threads",
    href: "https://www.threads.com/@lexhouse_ai",
    icon: "/redes/threads.svg",
    title: "Conversa en Threads",
    sub: "@lexhouse_ai · Novedades",
    brand: "#0F1B2D",
  },
];

function RailTip({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pointer-events-none absolute right-full top-1/2 mr-3 flex -translate-y-1/2 translate-x-2 flex-col whitespace-nowrap rounded-2xl border border-white/10 bg-[#060c1a]/95 px-4 py-2.5 opacity-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
      <span className="text-[13px] font-bold text-white">{title}</span>
      <span className="mt-0.5 font-mono text-[10px] text-white/45">{sub}</span>
      <div className="absolute right-[-5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 rounded-sm border-r border-t border-white/10 bg-[#060c1a]/95" />
    </div>
  );
}

export function SocialRail() {
  const [shown, setShown] = useState(false);

  // Cascada de entrada: se dispara en el siguiente frame para que la transición corra.
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-end gap-1.5" role="group" aria-label="Redes sociales de LexHouse AI">
      {NETWORKS.map((n, i) => (
        <a
          key={n.id}
          href={n.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={n.title}
          className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-white transition-all duration-300 ease-out hover:-translate-x-0.5 hover:scale-110 focus-visible:outline-none sm:h-10 sm:w-10"
          style={{
            boxShadow: `0 0 0 2px ${AZABACHE}, 0 6px 18px rgba(11,11,15,0.28)`,
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0) scale(1)" : "translateY(10px) scale(0.8)",
            transitionDelay: `${i * 70}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${n.brand}, 0 10px 26px ${n.brand}66`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${AZABACHE}, 0 6px 18px rgba(11,11,15,0.28)`;
          }}
        >
          <RailTip title={n.title} sub={n.sub} />
          <img
            src={n.icon}
            alt=""
            width={20}
            height={20}
            draggable={false}
            className="h-[17px] w-[17px] transition-transform duration-300 ease-out group-hover:scale-110 sm:h-[18px] sm:w-[18px]"
          />
        </a>
      ))}

      {/* Separador: marca dónde terminan las redes y empiezan los agentes */}
      <span aria-hidden className="my-0.5 h-px w-6 bg-black/10" />
    </div>
  );
}

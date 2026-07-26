import type { ReactNode } from "react";

/*
  Blog del ecosistema LexHouse AI (lexhouse-ai.homes).
  Objetivo SEO: artículos útiles que enlazan a lexhouse-ai.com (la Plataforma)
  con buen anchor text, para pasar autoridad y alcance al sitio principal.
  Añadir un artículo = añadir un objeto a POSTS (el índice, las rutas y el
  sitemap lo toman de aquí).
*/

const BLUE = "#003DA5";

// Enlace destacado a lexhouse-ai.com (sitio principal del ecosistema).
function LexLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={`https://lexhouse-ai.com${to}`}
      target="_blank"
      rel="noopener"
      className="font-semibold underline underline-offset-2 transition-colors hover:opacity-80"
      style={{ color: BLUE }}
    >
      {children}
    </a>
  );
}

// Bloques de contenido con estilo consistente.
function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl font-black tracking-tight text-[#0F1B2D] mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-[16px] leading-relaxed text-slate-600 mb-4">{children}</p>;
}
function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[16px] leading-relaxed text-slate-600">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BLUE }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;        // ISO
  dateLabel: string;   // legible
  readingTime: string;
  keywords: string;
  Body: () => ReactNode;
}

export const POSTS: BlogPost[] = [
  {
    slug: "marketing-inmobiliario-ia-guia-2026",
    title: "Marketing inmobiliario con IA en 2026: guía para corredores",
    description:
      "Cómo la inteligencia artificial cambió la captación y venta de propiedades: leads 24/7, contratos revisados por IA y valuación automática. Guía práctica para corredores.",
    category: "Marketing IA",
    date: "2026-07-26",
    dateLabel: "26 de julio de 2026",
    readingTime: "7 min",
    keywords: "marketing inmobiliario, inteligencia artificial inmobiliaria, captación de leads, corredor de propiedades, CRM inmobiliario",
    Body: () => (
      <>
        <P>
          El corredor que en 2026 sigue respondiendo leads a mano, redactando contratos desde cero
          y valorizando propiedades "a ojo" está compitiendo con una mano atada. La inteligencia
          artificial dejó de ser una promesa: hoy atiende conversaciones, detecta cláusulas de
          riesgo y estima precios de mercado en segundos. En esta guía vemos cómo aprovecharla
          sin ser experto en tecnología.
        </P>

        <H2>1. Atiende cada lead en segundos, no en horas</H2>
        <P>
          El 78% de los interesados contrata con quien responde primero. Un asistente con IA
          contesta al instante por WhatsApp, califica la intención de compra y agenda la reunión
          en tu calendario — de día o de madrugada. Es el corazón de los{" "}
          <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink>, que trabajan 24/7 sobre
          tu propio número.
        </P>

        <H2>2. Revisa contratos sin depender del abogado para todo</H2>
        <P>
          Promesas, arriendos y compraventas esconden penalizaciones, renovaciones automáticas y
          gravámenes que cuestan caro. La IA legal los detecta en menos de un minuto y te entrega
          un informe con semáforo de riesgo. Puedes ver cómo funciona en{" "}
          <LexLink to="/soluciones/legal">Contratos IA de LexHouse</LexLink>.
        </P>

        <H2>3. Valoriza con datos, no con corazonadas</H2>
        <P>
          Poner el precio correcto es la diferencia entre vender en semanas o quedarte meses
          publicado. Las herramientas de valuación inteligente cruzan datos de mercado por comuna
          y tipo de propiedad para sugerir un rango realista. Explora la{" "}
          <LexLink to="/soluciones/plataforma">plataforma completa de LexHouse AI</LexLink> con sus
          módulos de valuación, marketing y publicación multiportal.
        </P>

        <H2>4. Lo que deberías automatizar hoy</H2>
        <UL
          items={[
            "Primera respuesta y calificación de leads por WhatsApp.",
            "Agenda de visitas y reuniones en el calendario.",
            "Revisión legal de contratos antes de firmar.",
            "Publicación del aviso optimizado en varios portales a la vez.",
            "Reportes de actividad para no perder ningún seguimiento.",
          ]}
        />

        <P>
          La regla es simple: automatiza lo repetitivo para dedicar tu tiempo a lo que solo tú
          puedes hacer — cerrar. Si quieres ver todo el ecosistema en acción, empieza por{" "}
          <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "crm-whatsapp-inmobiliario-cierres",
    title: "CRM con IA sobre WhatsApp: cómo multiplicar tus cierres",
    description:
      "Un CRM inmobiliario que vive en WhatsApp y usa IA para responder, clasificar y agendar convierte más leads en reuniones. Te contamos cómo y por qué funciona.",
    category: "CRM · WhatsApp",
    date: "2026-07-26",
    dateLabel: "26 de julio de 2026",
    readingTime: "6 min",
    keywords: "CRM inmobiliario, CRM WhatsApp, gestión de leads, automatización inmobiliaria, ventas inmobiliarias",
    Body: () => (
      <>
        <P>
          La mayoría de los leads inmobiliarios llegan y mueren en WhatsApp. Llegan de noche, un
          domingo, mientras estás en una visita — y cuando respondes, ya contrataron a otro. Un CRM
          que vive dentro de WhatsApp y responde con IA cambia por completo esa ecuación.
        </P>

        <H2>Por qué WhatsApp y no un CRM tradicional</H2>
        <P>
          El cliente ya está en WhatsApp; obligarlo a un formulario o a otra app pierde a la
          mayoría. Un CRM sobre WhatsApp trabaja donde el lead ya está: atiende, califica por
          intención y deja la conversación ordenada para que el equipo sepa a quién llamar.
        </P>

        <H2>Qué hace la IA por ti</H2>
        <UL
          items={[
            "Responde en segundos con el tono de tu marca y tu conocimiento del negocio.",
            "Clasifica cada lead: cita agendada, solo quiere info, no interesa…",
            "Agenda la reunión en tu Google Calendar y la confirma.",
            "Cada mañana te envía un reporte con los leads que se movieron.",
          ]}
        />

        <H2>Del primer «hola» al cierre</H2>
        <P>
          El CRM captura el lead, la IA lo califica y lo agenda, y tú entras cuando está listo para
          hablar de la propiedad. Menos tareas manuales, más reuniones por semana. Este blog vive
          en el mismo ecosistema que la plataforma inmobiliaria de{" "}
          <LexLink to="/">LexHouse AI</LexLink>: mientras el CRM ordena tus conversaciones, en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink> tienes marketplace,
          contratos con IA, valuación y publicación multiportal.
        </P>

        <H2>Cómo empezar</H2>
        <P>
          No necesitas cambiar de número ni saber de tecnología: si usas WhatsApp, ya sabes usarlo.
          Conecta tu cuenta y deja que la IA atienda la primera respuesta. Y cuando quieras la suite
          completa para corredores, revisa los{" "}
          <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink>.
        </P>
      </>
    ),
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

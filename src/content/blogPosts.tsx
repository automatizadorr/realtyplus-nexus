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
  {
    slug: "calificar-leads-inmobiliarios-ia",
    title: "Cómo calificar leads inmobiliarios con IA (lead scoring) en 2026",
    description:
      "El lead scoring con inteligencia artificial te dice a quién llamar primero. Aprende cómo la IA puntúa a tus contactos por intención de compra y deja de perder tiempo en curiosos.",
    category: "Leads · IA",
    date: "2026-07-27",
    dateLabel: "27 de julio de 2026",
    readingTime: "6 min",
    keywords: "calificación de leads, lead scoring inmobiliario, CRM inmobiliario con inteligencia artificial, captación de leads, IA para inmobiliarias",
    Body: () => (
      <>
        <P>
          El problema no suele ser la falta de leads, sino no saber a cuál dedicarle tiempo.
          Un corredor recibe decenas de consultas por portales, redes y WhatsApp, pero solo un
          puñado está listo para comprar. El <strong>lead scoring con IA</strong> resuelve
          justo eso: puntúa a cada contacto según qué tan cerca está de cerrar.
        </P>

        <H2>¿Qué es el lead scoring?</H2>
        <P>
          Es asignar un puntaje a cada lead a partir de su comportamiento e intención: qué
          propiedades mira, cuánto responde, si pregunta por financiamiento o por agendar una
          visita. En vez de una lista plana de contactos, tienes una lista <em>priorizada</em>.
        </P>

        <H2>Qué mira la IA para puntuar</H2>
        <UL
          items={[
            "Intención en el mensaje: «quiero agendar» pesa más que «solo miraba».",
            "Velocidad y frecuencia de respuesta del contacto.",
            "Presupuesto y financiamiento mencionados en la conversación.",
            "Tipo y cantidad de propiedades por las que consulta.",
            "Momento: un lead que responde en minutos está caliente.",
          ]}
        />

        <H2>De la puntuación a la acción</H2>
        <P>
          Un buen sistema no solo puntúa: <strong>actúa</strong>. Clasifica al lead por intención,
          agenda la reunión y te avisa cuando alguien está listo. Eso es exactamente lo que hacen
          los <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink>: leen la conversación,
          califican y agendan, para que tú entres solo cuando vale la pena.
        </P>

        <H2>No pierdas al lead caliente</H2>
        <P>
          El 78% contrata con quien responde primero. Combinar lead scoring con respuesta
          instantánea es la diferencia entre cerrar o ver cómo tu lead se va con la competencia.
          Si quieres la suite completa —marketplace, contratos con IA y valuación—, está toda en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "chatbot-inmobiliario-whatsapp",
    title: "Chatbot inmobiliario por WhatsApp: capta y responde primero",
    description:
      "Un chatbot inmobiliario con IA en WhatsApp atiende, cualifica y agenda 24/7. Te contamos qué debe hacer un buen asistente y por qué responder primero define quién cierra la venta.",
    category: "WhatsApp · IA",
    date: "2026-07-27",
    dateLabel: "27 de julio de 2026",
    readingTime: "6 min",
    keywords: "chatbot para inmobiliarias, chatbot inmobiliario WhatsApp, CRM para inmobiliarias con WhatsApp, captación de leads, automatización inmobiliaria",
    Body: () => (
      <>
        <P>
          Los leads inmobiliarios llegan por WhatsApp, a cualquier hora. El que responde en
          minutos gana; el que responde al día siguiente, pierde. Un <strong>chatbot inmobiliario
          con IA</strong> se asegura de que siempre haya respuesta, aunque estés en una visita o
          durmiendo.
        </P>

        <H2>Qué debe hacer un buen chatbot inmobiliario</H2>
        <UL
          items={[
            "Responder al instante con el tono de tu marca, no con respuestas robóticas.",
            "Cualificar: preguntar por zona, presupuesto y plazo sin agobiar.",
            "Agendar la visita o reunión directo en tu calendario.",
            "Pasarte la conversación ordenada y clasificada cuando el lead está listo.",
          ]}
        />

        <H2>Por qué WhatsApp y no otra cosa</H2>
        <P>
          Tu cliente ya está en WhatsApp; obligarlo a un formulario o a otra app pierde a la
          mayoría. Un asistente que vive en WhatsApp trabaja donde el lead ya está. Así funciona
          <strong> Sofía</strong>, la asesora IA de este ecosistema: atiende sobre tu propio número.
        </P>

        <H2>Del chatbot a la plataforma completa</H2>
        <P>
          Responder primero es el inicio. Después necesitas publicar la propiedad, revisar el
          contrato y valorizar bien. Todo eso vive en{" "}
          <LexLink to="/">LexHouse AI</LexLink>: mira los{" "}
          <LexLink to="/soluciones/ia">agentes IA</LexLink> para la atención automática y{" "}
          <LexLink to="/soluciones/legal">Contratos IA</LexLink> para revisar promesas y
          arriendos en segundos.
        </P>
      </>
    ),
  },
  {
    slug: "herramientas-ia-agentes-inmobiliarios-2026",
    title: "Herramientas de IA para agentes inmobiliarios: guía 2026",
    description:
      "Del primer contacto al cierre: las herramientas de inteligencia artificial que hoy usan los agentes inmobiliarios para captar leads, revisar contratos, valorizar y crear contenido.",
    category: "Guía · IA",
    date: "2026-07-27",
    dateLabel: "27 de julio de 2026",
    readingTime: "8 min",
    keywords: "herramientas de IA para agentes inmobiliarios, software inmobiliario con IA, inteligencia artificial inmobiliaria, automatización inmobiliaria, corredor de propiedades",
    Body: () => (
      <>
        <P>
          La inteligencia artificial dejó de ser un lujo para grandes agencias: hoy un corredor
          independiente puede automatizar casi todo el recorrido de una venta. Esta es la guía
          práctica de las herramientas de IA que de verdad mueven la aguja en 2026, ordenadas por
          etapa del negocio.
        </P>

        <H2>1. Captación y atención de leads</H2>
        <P>
          Asistentes con IA que responden por WhatsApp en segundos, cualifican por intención y
          agendan solos. Es la base: sin respuesta rápida, el resto no importa. Ver los{" "}
          <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink>.
        </P>

        <H2>2. Revisión legal de contratos</H2>
        <P>
          Promesas, arriendos y compraventas esconden cláusulas de riesgo. La IA legal las detecta
          en menos de un minuto y entrega un informe con semáforo de riesgo —ideal antes de firmar.
          Ver <LexLink to="/soluciones/legal">Contratos IA</LexLink>.
        </P>

        <H2>3. Valuación y datos de mercado</H2>
        <P>
          Poner el precio correcto define si vendes en semanas o en meses. Las herramientas de
          valuación inteligente cruzan datos por comuna y tipo de propiedad para sugerir un rango
          realista. Todo esto está en la{" "}
          <LexLink to="/soluciones/plataforma">plataforma de LexHouse AI</LexLink>.
        </P>

        <H2>4. Marketing y contenido con IA</H2>
        <P>
          Textos de aviso, publicación en múltiples portales y <strong>reels</strong> verticales
          para redes. Crear contenido de propiedades con IA acelera la exposición sin equipo de
          marketing.
        </P>

        <H2>5. Organización con un CRM</H2>
        <P>
          Un CRM que ordena las conversaciones y te dice a quién seguir evita que los leads se
          enfríen. Es el hilo que conecta todas las etapas anteriores.
        </P>

        <H2>Cómo empezar sin abrumarte</H2>
        <P>
          No necesitas todo el día uno. Empieza por la respuesta automática de leads, suma la
          revisión de contratos y la valuación, y ve creciendo. Todo el ecosistema —plataforma,
          CRM y creación de video— parte desde{" "}
          <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

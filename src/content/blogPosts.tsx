import type { ReactNode } from "react";
import {
  PipelineSteps,
  Timeline,
  Race,
  Funnel,
  InboxBattle,
  VoiceFlow,
  ImportFlow,
  CalendarPicks,
  MorningReport,
  MandatoDeal,
  Toolbox,
  ScoreMeter,
  MistakesCard,
  KeyStat,
  BestPractices,
} from "./infographics";

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
    slug: "prospeccion-inmobiliaria-scraping-ia",
    title: "Prospección inmobiliaria con IA: encontrar clientes con scraping en 2026",
    description:
      "Deja de esperar leads y sal a buscarlos. Cómo el scraping con inteligencia artificial encuentra prospectos reales, analiza su presencia digital y redacta el mensaje de contacto — sin listas frías ni copiar y pegar.",
    category: "Prospección · IA",
    date: "2026-07-31",
    dateLabel: "31 de julio de 2026",
    readingTime: "7 min",
    keywords: "prospección inmobiliaria, scraping inmobiliario, captación de clientes con IA, buscar leads inmobiliarios, prospección con inteligencia artificial, CRM inmobiliario",
    Body: () => (
      <>
        <P>
          La mayoría de los corredores viven en modo reactivo: publican, esperan y contestan lo que
          llega. Funciona… hasta que el mes está flojo. La <strong>prospección con IA</strong> le da
          la vuelta al juego: en lugar de esperar leads, la inteligencia artificial sale a buscarlos
          por ti, encuentra negocios y personas que encajan con tu servicio y te deja el primer
          mensaje listo para enviar.
        </P>

        <H2>Qué es el scraping aplicado a la prospección</H2>
        <P>
          «Scraping» suena técnico, pero la idea es simple: rastrear fuentes públicas de internet para
          encontrar prospectos reales según un criterio. Le dices a la IA el rubro y la zona
          —«inmobiliarias en La Serena», «constructoras en Madrid», «arrendadores particulares»— y
          ella arma una lista de candidatos con datos de contacto y contexto, no una base fría
          comprada al azar.
        </P>
        <PipelineSteps />
        <P>
          El recorrido completo se ve así: la IA busca, analiza, redacta el mensaje y deja el
          contacto listo. Tú solo apruebas y envías. Cada paso queda registrado en el historial,
          así que nada se pierde entre pestañas y planillas.
        </P>

        <H2>¿Qué hace exactamente la IA con cada prospecto encontrado?</H2>
        <P>
          No basta con listar direcciones web: el valor está en lo que la IA hace con cada candidato
          antes de que tú lo veas:
        </P>
        <UL
          items={[
            "Visita su sitio y redes para entender qué hace y cómo se comunica.",
            "Detecta si ya usa automatización o CRM (un candidato sin automatización es oro puro).",
            "Identifica sus problemas probables: web sin actualizar, sin presencia, sin respuestas visibles.",
            "Calcula un puntaje de oportunidad: de 0 a 100 según qué tan buen encaje tenga con tu servicio.",
            "Redacta el mensaje de primer contacto personalizado, con su nombre y su realidad.",
          ]}
        />
        <ScoreMeter
          title="Así se puntúa una oportunidad"
          items={[
            { emoji: "🌐", label: "Presencia digital", sub: "web + redes activas = +25" },
            { emoji: "🤖", label: "Sin automatización", sub: "no usa CRM ni chatbot = +30" },
            { emoji: "📞", label: "Contacto visible", sub: "WhatsApp o email público = +25" },
            { emoji: "🎯", label: "Encaje con tu servicio", sub: "su dolor, tu solución = +20" },
          ]}
          score={{ label: "Score 90+", note: "Oportunidad caliente: contacta HOY", tone: RED }}
        />

        <H2>De la lista al primer mensaje, sin trabajo manual</H2>
        <P>
          Encontrar el prospecto es solo la mitad. Un buen sistema de prospección con IA hace el
          recorrido completo:
        </P>
        <UL
          items={[
            "Rastrea negocios y contactos reales por rubro y ciudad.",
            "Analiza su presencia digital (web, redes, reseñas) y puntúa la oportunidad.",
            "Redacta el mensaje de contacto para WhatsApp, email o una propuesta.",
            "Guarda un historial con estado de gestión para no volver a prospectar al mismo.",
          ]}
        />
        <P>
          Así conviertes horas de búsqueda en Google y hojas de cálculo en una lista priorizada y
          lista para contactar en minutos.
        </P>

        <H2>Por qué la IA prospecta mejor que una lista comprada</H2>
        <P>
          Las bases compradas están quemadas: todo el mundo las tiene y nadie responde. La
          prospección con IA es fresca y contextual —sabe <em>por qué</em> ese prospecto encaja— así
          que el mensaje se puede personalizar y la tasa de respuesta sube. Es la misma lógica que
          mueve a los{" "}
          <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink>: responder con contexto en
          vez de plantillas genéricas.
        </P>

        <H2>Del prospecto al cierre</H2>
        <P>
          Prospectar es el primer eslabón. Cuando el contacto responde, necesitas atenderlo rápido,
          calificarlo y agendar — y después publicar, revisar el contrato y valorizar la propiedad.
          Todo ese recorrido vive en el mismo ecosistema: revisa la{" "}
          <LexLink to="/soluciones/plataforma">plataforma completa de LexHouse AI</LexLink> con
          marketplace, contratos con IA, valuación y publicación multiportal, o empieza por{" "}
          <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>

        <H2>Los errores que arruinan la prospección (y cómo evitarlos)</H2>
        <P>
          La prospección con IA no elimina el criterio: elimina el trabajo repetitivo. Los errores
          siguen existiendo, pero ahora son evitables con un buen sistema:
        </P>
        <MistakesCard
          items={[
            "Prospectar al mismo negocio dos veces (sin historial).",
            "Enviar el mismo mensaje genérico a todos (sin contexto).",
            "Contactar solo por un canal cuando el prospecto vive en otro.",
            "Dejar pasar semanas entre el descubrimiento y el primer mensaje.",
            "No registrar quién respondió y quién quedó pendiente.",
          ]}
        />
        <P>
          Un buen sistema de prospección con IA resuelve los cinco con una sola pieza: historial con
          estado de gestión. Por eso el primer paso real no es «buscar más», sino dejar de perder a
          los que ya encontraste.
        </P>

        <H2>La frecuencia que funciona: prospecta como campaña, no como racha</H2>
        <P>
          El corredor que prospecta «cuando tiene tiempo» obtiene resultados de racha: semanas
          buenas seguidas de meses muertos. El que prospecta como campaña programada —una tanda de
          búsquedas por semana, un ciclo de mensajes, un día de seguimiento— llena el embudo de
          forma constante.
        </P>
        <BestPractices
          title="La rutina semanal que llena tu embudo"
          items={[
            { emoji: "🗓️", label: "Lunes: busca", sub: "2-3 búsquedas de nicho por zona" },
            { emoji: "✍️", label: "Martes: revisa", sub: "aprueba los mensajes redactados" },
            { emoji: "📤", label: "Miércoles: envía", sub: "WhatsApp y email a los nuevos" },
            { emoji: "📞", label: "Jueves: sigue", sub: "llama a los que respondieron" },
          ]}
        />
        <P>
          Así, en cuatro días a la semana y con minutos por día, el embudo nunca se seca. Y cuando
          el volumen crece, la parte de búsqueda y redacción ya la hace la IA por ti —el mismo motor
          que alimenta a{" "}
          <LexLink to="/soluciones/ia">los agentes IA de LexHouse</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "correos-personalizados-inmobiliaria",
    title: "Correos personalizados para inmobiliarias: llega a la bandeja principal",
    description:
      "Cómo enviar campañas de email personalizadas que de verdad se abren: variables por contacto, diseño profesional y las señales de entrega (SPF, DKIM, List-Unsubscribe) que evitan la pestaña de Promociones y el spam.",
    category: "Email · Marketing",
    date: "2026-07-31",
    dateLabel: "31 de julio de 2026",
    readingTime: "7 min",
    keywords: "correos personalizados, email marketing inmobiliario, campañas de correo inmobiliaria, llegar a la bandeja principal, evitar promociones gmail, deliverability email",
    Body: () => (
      <>
        <P>
          El email sigue siendo uno de los canales más rentables para un corredor… si el correo
          llega a la bandeja principal. El problema no suele ser el mensaje, sino la entrega: campañas
          bien escritas que terminan en Promociones o en spam y nadie las ve. La clave está en
          <strong> personalizar de verdad</strong> y cuidar las señales técnicas de entrega.
        </P>

        <H2>Personalizar no es poner «Hola {"{{nombre}}"}»</H2>
        <P>
          La personalización real usa los datos que ya tienes de cada contacto: nombre, empresa,
          la propiedad por la que consultó, la zona que le interesa. Un buen sistema toma tu Excel y
          reemplaza variables por contacto para que cada correo se sienta escrito a mano, aunque envíes
          cientos a la vez.
        </P>
        <UL
          items={[
            "Sube tu base desde Excel o CSV y mapea las columnas a variables.",
            "Personaliza asunto y cuerpo por contacto (nombre, empresa, propiedad, zona…).",
            "Diseño profesional con la identidad de tu marca, no un texto plano.",
            "Envío masivo con seguimiento, sin copiar y pegar uno por uno.",
          ]}
        />

        <H2>Cómo llegar a la bandeja principal (y no a Promociones)</H2>
        <P>
          Gmail y Outlook deciden dónde cae tu correo según señales de reputación y formato. Para
          maximizar la entrega a la bandeja principal:
        </P>
        <UL
          items={[
            "Autentica tu dominio con SPF, DKIM y DMARC — sin esto, casi todo cae en spam.",
            "Incluye la cabecera List-Unsubscribe: los proveedores premian el poder darse de baja.",
            "Evita el look «promoción»: demasiadas imágenes, botones y mayúsculas te mandan a esa pestaña.",
            "Envía a contactos que te conocen y limpia rebotes: la reputación lo es todo.",
          ]}
        />
        <InboxBattle />
        <P>
          La buena noticia: todas estas señales se configuran una sola vez en el dominio. Después,
          cada campaña que respeta las reglas acumula reputación, y la entrega mejora con el tiempo
          en lugar de empeorar.
        </P>

        <H2>El «gancho»: el párrafo que decide si se abre el correo</H2>
        <P>
          El asunto decide el clic; el gancho decide la respuesta. Un buen gancho menciona algo
          específico del negocio del receptor —su ciudad, su rubro, una observación de su web— y
          plantea un problema que tú puedes resolver. Lo vimos en la prospección: el mensaje que se
          siente escrito a mano abre el doble de correos que el que parece masivo.
        </P>
        <KeyStat value="2×" label="más respuestas con mensajes personalizados por contacto" tone={BLUE} />
        <P>
          En una campaña de prospección, el gancho sale del scraping: la IA ya leyó la web del
          negocio, así que el primer párrafo puede decir «vi que en su web no muestran
          financiamiento…». Eso no se puede hacer a mano con cien correos — por eso el sistema lo
          hace por ti.
        </P>

        <H2>La anatomía de un correo que convierte</H2>
        <UL
          items={[
            "Asunto con nombre o dato personal: «Propuesta para Inmobiliaria Valle».",
            "Primer párrafo: el gancho (algo específico del negocio).",
            "Segundo párrafo: tu oferta en una frase y su beneficio.",
            "CTA único y concreto: «¿Agendamos 10 minutos el jueves?».",
            "Firma limpia: nombre, cargo, web y WhatsApp — nada de banners gigantes.",
          ]}
        />
        <BestPractices
          title="Lo que hace que un correo se responda"
          items={[
            { emoji: "✍️", label: "Suena humano", sub: "sin jerga corporativa" },
            { emoji: "🎯", label: "Un solo CTA", sub: "una acción, no tres" },
            { emoji: "📏", label: "Corto", sub: "5-6 líneas máx." },
            { emoji: "🔗", label: "Enlace útil", sub: "un recurso, no un catálogo" },
          ]}
        />

        <H2>Cuándo usar correo y cuándo WhatsApp</H2>
        <P>
          El correo es ideal para propuestas, seguimientos formales y campañas a tu cartera; WhatsApp,
          para la respuesta inmediata al lead caliente. Lo potente es combinarlos: prospectas, envías
          un correo personalizado y cuando responde entra{" "}
          <LexLink to="/soluciones/ia">Sofía, la asesora IA</LexLink>, para atender y agendar en el
          acto.
        </P>

        <H2>Parte de un ecosistema completo</H2>
        <P>
          Los correos personalizados son una pieza más del recorrido comercial. Cuando quieras la
          suite completa —marketplace, contratos con IA, valuación y publicación multiportal— está
          toda en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink>. Y si recién empiezas,
          arranca desde <LexLink to="/">el portal de LexHouse AI</LexLink>.
        </P>
      </>
    ),
  },
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
        <Race />
        <P>
          La velocidad no es un lujo: es la primera variable del marketing inmobiliario. Un lead
          que espera una hora tiene un 60% menos de probabilidad de responder; uno que espera un
          día, casi ninguno. La IA elimina esa espera de raíz, y el corredor solo entra cuando el
          lead ya está calificado.
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
        <Toolbox
          title="Tu kit de IA, etapa por etapa"
          rows={[
            { emoji: "🕵️", label: "Prospección", sub: "scraping + mensajes automáticos", tone: BLUE },
            { emoji: "🤖", label: "Atención 24/7", sub: "agente IA en WhatsApp", tone: GOLD },
            { emoji: "📑", label: "Contratos IA", sub: "semáforo de riesgo en 1 min", tone: RED },
            { emoji: "💰", label: "Valuación", sub: "rango de precio con datos", tone: "#16a34a" },
            { emoji: "🎬", label: "Contenido", sub: "reels y avisos con IA", tone: "#7c3aed" },
            { emoji: "📊", label: "Reportes", sub: "gestión diaria a jefatura", tone: "#0d9488" },
          ]}
        />

        <H2>5. El método de los tres embudos</H2>
        <P>
          El marketing inmobiliario con IA funciona mejor cuando alimentas tres embudos a la vez,
          cada uno con su propia máquina:
        </P>
        <UL
          items={[
            "Embudo de captación: scraping encuentra nuevos negocios y propietarios (el motor que describimos en nuestro artículo de prospección).",
            "Embudo de compra: la IA atiende, califica y agenda a los que ya llegan por portales y publicidad.",
            "Embudo de reactivación: los que se enfriaron vuelven a entrar con mensajes de re-enganche.",
          ]}
        />
        <Funnel
          title="Los tres embudos alimentando tu mes"
          stages={[
            { emoji: "🕵️", label: "Captación", sub: "prospectos nuevos por scraping", tone: BLUE },
            { emoji: "🤖", label: "Compra", sub: "leads que responden al agente IA", tone: GOLD },
            { emoji: "♻️", label: "Reactivación", sub: "contactos fríos que vuelven", tone: RED },
            { emoji: "🤝", label: "Cierres", sub: "reuniones que se convierten en ventas", tone: "#16a34a" },
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

        <H2>El embudo que se mueve solo</H2>
        <P>
          Para ver el efecto real de un CRM sobre WhatsApp conviene mirar el embudo completo. La
          mayoría de las agencias pierde contacto en cada etapa por una sola razón: velocidad y
          orden. Con IA, cada etapa se trabaja en automático:
        </P>
        <Funnel
          stages={[
            { emoji: "📥", label: "100 consultas", sub: "llegan por portales y redes", tone: BLUE },
            { emoji: "🤖", label: "IA responde", sub: "en segundos, 24/7", tone: GOLD },
            { emoji: "🔥", label: "30 calientes", sub: "clasificados por intención", tone: RED },
            { emoji: "📅", label: "12 citas", sub: "agendadas en calendario", tone: "#16a34a" },
          ]}
        />
        <P>
          El dato que importa: la primera respuesta en menos de 5 minutos multiplica las
          posibilidades de agendar una visita. Después de 30 minutos, las probabilidades caen a la
          mitad. Ese es el hueco exacto que llena un CRM con IA — no un «mejor discurso», sino el
          momento.
        </P>

        <H2>¿Qué pasa si un lead no responde? El CRM no lo olvida</H2>
        <P>
          La diferencia entre una agenda de contactos y un CRM es el seguimiento. El sistema
          registra cada conversación, detecta quién dejó de responder y lo pasa a un ciclo de
          reactivación automático: un mensaje de re-enganche con novedad a los 30 días, otro con
          otro ángulo a los 60. El lead que «murió» en tu WhatsApp viejo, aquí vuelve a la vida.
          Es el mismo flujo que detallamos en nuestro artículo de{" "}
          <LexLink to="/soluciones/ia">reactivación de leads inactivos</LexLink>.
        </P>

        <H2>El reporte diario que te dice si el embudo anda</H2>
        <P>
          Un CRM sobre WhatsApp no solo ordena conversaciones: mide. Cada mañana sabrás cuántos
          leads entraron, cuántos respondieron, cuántas citas se agendaron y cuáles llevan horas
          sin atención. Si el embudo se atora, lo ves el mismo día — no en la reunión de fin de
          mes.
        </P>
        <MorningReport />

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
        <ScoreMeter />
        <P>
          Piensa en el scoring como un semáforo que se actualiza solo con cada mensaje: verde para
          quien pide visita, amarillo para quien solo mira, rojo para quien no volverá a responder
          pronto. La IA va ajustando el puntaje en vivo, y el equipo siempre sabe a quién llamar
          primero.
        </P>

        <H2>El semáforo del corredor: qué hacer con cada color</H2>
        <UL
          items={[
            "Verde (score alto): llámalo en el momento. Es la ventana donde se decide la venta.",
            "Amarillo (score medio): responde con información útil y agenda un seguimiento con fecha.",
            "Rojo (score bajo): no lo abandones, pásalo al ciclo de reactivación con otro ángulo.",
            "Gris (sin respuesta): entra al recordatorio automático; nadie se pierde.",
          ]}
        />
        <BestPractices
          title="El ritual diario del corredor que cierra"
          items={[
            { emoji: "🌅", label: "8:00", sub: "revisa el reporte y los verdes" },
            { emoji: "📞", label: "Antes del mediodía", sub: "llama a los calientes" },
            { emoji: "📅", label: "Tarde", sub: "confirma citas del día siguiente" },
            { emoji: "♻️", label: "Viernes", sub: "activa reactivación de fríos" },
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
        <PipelineSteps
          title="Una conversación que se convierte en cita"
          steps={[
            { emoji: "💬", label: "«Hola, ¿tienen casas en…?»", sub: "llega a cualquier hora" },
            { emoji: "🤖", label: "Sofía responde", sub: "en segundos, con tu tono" },
            { emoji: "🔥", label: "Clasifica", sub: "intención y presupuesto" },
            { emoji: "📅", label: "Agenda", sub: "visita en tu calendario" },
          ]}
        />
        <P>
          Cada paso ocurre en segundos y sin que el corredor toque el teléfono. Cuando el lead
          queda agendado, la IA avisa al equipo: «visita confirmada, jueves 11:00, pareja
          interesada en Reñaca con presupuesto de 250 UF». El corredor llega a la cita sabiendo
          todo.
        </P>

        <H2>La hora del día que mata los leads (y la IA no duerme)</H2>
        <P>
          Revisa tu WhatsApp: ¿a qué hora llegan las consultas? La mayoría entra entre las 20:00 y
          las 23:00, exactamente cuando nadie está disponible para responder. Si respondes al día
          siguiente, el lead ya consultó a tres corredores más. La IA no tiene horario: atiende a
          las 3:00 igual que a las 15:00, y el lead siente que siempre hay alguien — porque lo hay.
        </P>
        <KeyStat value="78%" label="de los interesados contrata con quien responde primero" tone={RED} />
        <P>
          Ese 78% es la razón de existir del chatbot inmobiliario: no reemplaza al corredor, lo
          pone primero en la fila. La conversación y el cierre siguen siendo humanos — pero el
          «buenas noches, ¿me puede ayudar?» ya no espera hasta mañana.
        </P>

        <H2>Qué NO debe hacer un chatbot inmobiliario</H2>
        <UL
          items={[
            "Responder en bucle sin avanzar («¿le puedo ayudar en algo más?» infinito).",
            "Inventar propiedades que no existen o precios equivocados.",
            "Discutir precios si la política de la agencia lo prohíbe.",
            "Esconderse: si el lead insiste en hablar con una persona, debe pasar al corredor al toque.",
          ]}
        />
        <MistakesCard
          title="El chatbot que ahuyenta leads"
          items={[
            "Respuestas de catálogo sin contexto («gracias por escribirnos»).",
            "No recordar lo que el lead ya dijo en mensajes anteriores.",
            "Nunca pasar al humano: el lead se frustra y se va.",
            "No registrar la conversación en el CRM para el seguimiento.",
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
        <Toolbox
          title="El stack completo del corredor 2026"
          rows={[
            { emoji: "🕵️", label: "Prospección", sub: "scraping + scoring de oportunidades", tone: BLUE },
            { emoji: "🤖", label: "Agente IA 24/7", sub: "WhatsApp: responde, califica, agenda", tone: GOLD },
            { emoji: "📑", label: "Contratos IA", sub: "revisión legal con semáforo", tone: RED },
            { emoji: "💰", label: "Valuación", sub: "precio con datos de mercado", tone: "#16a34a" },
            { emoji: "🎬", label: "Studio de video", sub: "reels de propiedades en minutos", tone: "#7c3aed" },
            { emoji: "📊", label: "CRM + reportes", sub: "pipeline y reporte diario", tone: "#0d9488" },
          ]}
        />

        <H2>¿Cuánto cuesta armar este stack?</H2>
        <P>
          La pregunta correcta no es cuánto cuesta, sino cuánto cuesta seguir sin él. Pero vale la
          pena la transparencia: hay herramientas de entrada gratuitas o de bajo costo en cada
          categoría, y el ROI se mide en reuniones recuperadas. Un solo cierre adicional que llegue
          por una respuesta automática de madrugada paga meses de suscripción.
        </P>
        <KeyStat value="1 cierre" label="extra al mes paga todo el stack de IA" tone="#16a34a" />

        <H2>La curva de adopción: por dónde empezar sin abrumarte</H2>
        <P>
          El error clásico es comprar siete herramientas a la vez y abandonar todo a la semana.
          La estrategia que funciona es encender una máquina por vez:
        </P>
        <PipelineSteps
          title="El orden de adopción que funciona"
          steps={[
            { emoji: "1️⃣", label: "Atención IA", sub: "primera respuesta automática" },
            { emoji: "2️⃣", label: "CRM", sub: "todo en una sola fuente de verdad" },
            { emoji: "3️⃣", label: "Scraping", sub: "llenar el embudo de prospectos" },
            { emoji: "4️⃣", label: "Avanzado", sub: "contratos, valuación, video" },
          ]}
        />
        <P>
          Con la atención y el CRM funcionando ya estás por delante del 90% de las agencias de tu
          ciudad. El resto se suma cuando el flujo lo pida. Y todo este stack —plataforma, CRM y
          creación de video— parte desde{" "}
          <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>

        <H2>El checklist para elegir herramientas con IA</H2>
        <UL
          items={[
            "¿Se conecta con WhatsApp o me obliga a cambiar de canal?",
            "¿Usa los datos de mi negocio o solo respuestas genéricas?",
            "¿Registra todo en un CRM o vive en una isla?",
            "¿Escala cuando crezca mi volumen de leads?",
            "¿El equipo la va a usar de verdad, o es otra cuenta que se paga y se olvida?",
          ]}
        />

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
  {
    slug: "pipeline-captacion-scraping-email-whatsapp",
    title: "Captación automatizada: cómo el scraping, el email y el WhatsApp trabajan en un solo flujo",
    description:
      "Un solo pipeline que busca prospectos con scraping, redacta el mensaje, lo envía por WhatsApp o correo personalizado y registra cada respuesta. Así funciona la captación completa de clientes en 2026.",
    category: "Captación · Automatización",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "8 min",
    keywords: "captación automatizada, pipeline de prospección, scraping con IA, email marketing inmobiliario, WhatsApp automatizado, mensajes de prospección generados por IA, automatización inmobiliaria",
    Body: () => (
      <>
        <P>
          Hacer prospección «a mano» significa horas buscando en Google, copiando datos a una hoja
          de cálculo y escribiendo mensajes genéricos que casi nadie contesta. La forma de trabajar
          que ya se impone en 2026 es otra: un <strong>pipeline de captación</strong> donde el
          scraping encuentra a los prospectos, la IA redacta el primer mensaje y el sistema lo envía
          por el canal correcto —WhatsApp o email— y registra cada respuesta. Todo en un solo flujo,
          sin copiar y pegar.
        </P>

        <H2>La fusión: tres motores, un solo recorrido</H2>
        <P>
          Lo potente no es cada herramienta por separado, sino verlas como una sola máquina de
          captación:
        </P>
        <UL
          items={[
            "Scraping con IA: rastrea fuentes públicas por rubro y ciudad, encuentra negocios reales con email o WhatsApp visible.",
            "Generación de mensajes: la IA analiza la presencia digital de cada prospecto y redacta el mensaje de primer contacto personalizado.",
            "Envío por email o WhatsApp: los que tienen correo reciben una campaña personalizada con variables por contacto; los que tienen WhatsApp, el mensaje directo.",
            "Seguimiento y registro: cada contacto queda en el historial con su estado, para no repetir ni perder a nadie.",
          ]}
        />
        <PipelineSteps
          title="La máquina de captación, de punta a punta"
          steps={[
            { emoji: "🕵️", label: "Scraping", sub: "negocios reales por rubro y ciudad" },
            { emoji: "🧠", label: "Análisis", sub: "presencia digital + scoring" },
            { emoji: "✍️", label: "Mensaje", sub: "WhatsApp y email personalizados" },
            { emoji: "🤖", label: "Respuesta", sub: "agente IA califica y agenda" },
          ]}
        />

        <H2>1. El scraping encuentra a quien vale la pena contactar</H2>
        <P>
          Le pides a la IA un rubro y una zona —«inmobiliarias en Madrid», «constructoras en
          Coquimbo»— y ella rastrea la web en busca de candidatos reales. No entrega una base fría:
          entrega una lista con su web, teléfono, email e Instagram, con un{" "}
          <em>puntaje de oportunidad</em> según la probabilidad de que quieran tu servicio. Hasta
          descarta las franquicias grandes con CRM corporativo, que nunca responderán. Es la misma
          lógica que describimos en{" "}
          <LexLink to="/soluciones/ia">prospección con scraping IA</LexLink> dentro del ecosistema
          de LexHouse.
        </P>

        <H2>2. La IA redacta el mensaje que sí se abre</H2>
        <P>
          Aquí está el salto: en vez de un texto genérico para todos, la IA escribe un{" "}
          <strong>mensaje por prospecto</strong>, con su nombre, su problema real y una pregunta
          suave al final. Y prepara dos versiones: el mensaje corto y cercano para WhatsApp y la
          versión más formal por email. El resultado se ve escrito a mano —porque de hecho lo
          escribió una máquina que leyó la web de tu prospecto antes de hablarle.
        </P>

        <H2>3. Cada prospecto recibe el mensaje por el canal correcto</H2>
        <P>
          No todos contestan en el mismo lugar. La regla práctica:
        </P>
        <UL
          items={[
            "Con WhatsApp visible → mensaje directo, inmediato, con CTA suave. Es el canal donde los negocios responden en minutos.",
            "Con email → campaña personalizada con variables (empresa, ciudad, gancho), diseño profesional y envío con reputación cuidada (SPF, DKIM, List-Unsubscribe) para caer en la bandeja principal.",
            "Sin ninguno de los dos → se descarta o se agrega a un ciclo de reactivación por Instagram.",
          ]}
        />
        <P>
          Así el prospecto recibe el mensaje donde vive su negocio, no donde a ti te resulta más
          fácil enviarlo. Los detalles de cada canal los cubrimos en nuestros artículos de{" "}
          <LexLink to="/soluciones/ia">correos personalizados</LexLink> y{" "}
          <LexLink to="/soluciones/ia">WhatsApp automatizado</LexLink>.
        </P>

        <H2>4. El historial evita el error clásico</H2>
        <P>
          El error más caro de la prospección manual es prospectar al mismo negocio dos veces, o
          perder el seguimiento de uno que ya estaba por responder. Un buen pipeline lo evita
          registrando cada búsqueda y cada contacto con su estado: contactado, no interesa, cliente.
          Y cuando alguien responde semanas después, la IA te dice exactamente quién es y por qué
          le escribiste.
        </P>
        <MistakesCard
          title="Lo que el pipeline elimina de tu semana"
          items={[
            "Horas buscando en Google «qué inmobiliarias hay en…».",
            "Copiar contactos a una planilla que nadie actualiza.",
            "Enviar el mismo mensaje genérico a diez negocios distintos.",
            "Perder un prospecto porque el mensaje quedó «para mañana».",
            "Prospectar dos veces al mismo y darse cuenta por el WhatsApp del dueño.",
          ]}
        />

        <H2>Los números que mueven al pipeline</H2>
        <P>
          Para saber si la máquina está funcionando, solo hay que mirar tres números a la semana:
          cuántos prospectos se encontraron, cuántos respondieron y cuántos llegaron a reunión. Un
          pipeline sano en prospección se ve más o menos así:
        </P>
        <Funnel
          title="De prospectos a reuniones, semana a semana"
          stages={[
            { emoji: "🕵️", label: "30 prospectos", sub: "encontrados por scraping", tone: BLUE },
            { emoji: "✉️", label: "25 contactados", sub: "WhatsApp + email personalizado", tone: GOLD },
            { emoji: "💬", label: "8 respondieron", sub: "el mensaje tocó un problema real", tone: RED },
            { emoji: "🤝", label: "3 reuniones", sub: "conversaciones que pueden cerrar", tone: "#16a34a" },
          ]}
        />
        <P>
          Si el número de respuestas cae, el problema suele estar en el mensaje — y se corrige
          rápido porque el pipeline te muestra exactamente en qué etapa se atora. Sin sistema, ni
          siquiera sabrías que hay un problema hasta el fin de mes.
        </P>

        <H2>5. Y cuando responden, entra el agente IA</H2>
        <P>
          La captación no termina con el primer mensaje: termina con la respuesta. En el mismo
          flujo, quien contesta pasa directo a un agente con IA que responde en segundos, califica
          la intención y agenda la reunión en tu calendario —sin que tengas que estar pegado al
          teléfono. Ese es el eslabón final del pipeline, el mismo que usa{" "}
          <LexLink to="/soluciones/ia">Sofía, la asesora IA de LexHouse</LexLink>.
        </P>

        <H2>El resultado: prospectar como equipo, en una sola tarde</H2>
        <P>
          Lo que antes tomaba días de búsqueda y redacción ahora es una sola sesión: la IA busca,
          redacta y envía; tú respondes a los que contestaron. Si quieres ver el flujo completo en
          acción —scraping, correos, WhatsApp y agentes IA— está todo integrado en{" "}
          <LexLink to="/soluciones/plataforma">la plataforma de LexHouse AI</LexLink>, o empieza
          por <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "reactivar-leads-inactivos-whatsapp",
    title: "Reactivar leads inactivos: la mina de oro que todos ignoran",
    description:
      "Tus leads que no respondieron siguen valiendo. Aprende a reactivar contactos inactivos por WhatsApp con IA: mensajes de re-enganche, acuse de recibo y seguimiento automático sin parecer insistente.",
    category: "Leads · Reactivación",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "7 min",
    keywords: "reactivar leads inactivos, leads fríos inmobiliarios, reactivación de clientes, seguimiento de leads por WhatsApp, recuperar contactos, acuse de recibo whatsapp, reactivación con IA",
    Body: () => (
      <>
        <P>
          Cada agencia tiene un tesoro escondido: la base de leads que nunca respondió o se enfrió
          con el tiempo. Comprar listas nuevas es caro y cada vez menos efectivo; en cambio,{" "}
          <strong>reactivar leads inactivos</strong> suele ser la vía más rápida y barata para
          conseguir reuniones nuevas — porque esos contactos ya te conocen, y muchos simplemente
          estaban ocupados cuando les escribiste.
        </P>

        <H2>Por qué un lead «muerto» no está muerto</H2>
        <P>
          La mayoría de las compras inmobiliarias no se decide en una semana. El que no respondió en
          enero puede estar listo en julio. La diferencia entre perderlo y cerrarlo está en el{" "}
          <strong>seguimiento</strong>: casi nadie vuelve a escribir, y el que lo hace con un
          mensaje bien pensado se lleva la reunión.
        </P>

        <H2>Cómo se reactiva un lead sin parecer insistente</H2>
        <P>
          La regla de oro es aportar valor o novedad, no preguntar «¿y al final?». Mensajes que
          funcionan:
        </P>
        <UL
          items={[
            "Novedad: una propiedad nueva en la zona que le interesaba, con foto y precio.",
            "Contexto: «te contactamos hace unos meses por propiedades en [zona]» — refresca el contexto sin amenazar.",
            "Cierre de ciclo: «quedamos pendientes de avisarte» con un dato útil de mercado.",
            "Oferta de tiempo: proponer una llamada o reunión corta, con hora concreta.",
          ]}
        />

        <H2>La reactivación con IA: escala sin perder el tono</H2>
        <P>
          Hacerlo a mano con cientos de contactos es imposible. La IA lo resuelve leyendo la
          conversación anterior de cada lead y escribiendo un mensaje de re-enganche{" "}
          <em>personalizado</em>: sabe quién es, por qué consultó y qué le conviene ahora. El
          sistema además lleva un{" "}
          <strong>acuse de recibo</strong> de cada mensaje —sabes si se entregó o si el número
          murió— y registra quién responde para pasarlo de vuelta al equipo. Es el mismo motor que
          mueve a{" "}
          <LexLink to="/soluciones/ia">Sofía, la asesora IA de LexHouse</LexLink> cuando atiende y
          sigue conversaciones en WhatsApp.
        </P>

        <H2>Cuándo (y cada cuánto) reactivar</H2>
        <UL
          items={[
            "30 días sin respuesta: primer re-enganche con novedad.",
            "60-90 días: segundo contacto con otro ángulo (financiamiento, zona, plazo).",
            "6 meses: ciclo de reactivación amplio con oferta de re-agendar.",
            "Regla práctica: máximo 3-4 toques con valor; después se archiva y se rota la base.",
          ]}
        />
        <Timeline />
        <P>
          El orden importa tanto como la frecuencia: primero novedad, luego ángulo distinto, y solo
          después la oferta abierta. Cada mensaje debe sonar distinto — si el lead recibe tres
          veces el mismo «hola, ¿te interesa?», el mensaje lo archiva mentalmente para siempre.
        </P>

        <H2>El acuse de recibo: la métrica que nadie mira</H2>
        <P>
          Cuando envías mensajes de reactivación por WhatsApp, la mitad del trabajo es saber qué
          pasó con ellos: ¿se entregó? ¿el número sigue vivo? ¿lo marcaron como spam? Un sistema
          serio de reactivación registra el <strong>acuse de recibo</strong> de cada mensaje y te
          dice cuántos contactos de tu base siguen vigentes — y cuántos deberías depurar.
        </P>
        <KeyStat value="30%" label="de una base «vieja» suele tener números muertos: depúrala" tone={GOLD} />
        <P>
          Ese dato tiene valor real: enviar a números muertos daña tu reputación ante el proveedor
          de WhatsApp y baja tus entregas futuras. El acuse convierte la reactivación en una
          operación limpia: los vivos reciben el mensaje, los muertos se limpian de la base.
        </P>

        <H2>Un mensaje de re-enganche que funciona (ejemplo)</H2>
        <P>
          Tomemos un lead que consultó por una propiedad en enero y nunca respondió. En lugar del
          clásico «¿al final te interesó?», la IA arma algo así con el contexto real de la
          conversación:
        </P>
        <div className="not-prose my-6 rounded-2xl border-2 border-slate-100 bg-slate-50 p-5 text-[14px] leading-relaxed text-slate-700" aria-hidden="true">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-slate-400">💬 ejemplo de mensaje</span>
          «Hola Andrés, te escribí en enero por propiedades en Coquimbo y quedó pendiente. Llegó
          un nuevo departamento en la zona que buscan, con vista al mar y a un precio bajo el de
          mercado. ¿Te lo envío hoy con fotos?»
        </div>
        <P>
          Novedad, contexto, referencia al pasado y CTA concreto — sin presión. El receptor se
          siente recordado, no perseguido. Y es exactamente el tipo de mensaje que la IA redacta en
          serie leyendo cada conversación anterior.
        </P>

        <H2>La reactivación dentro del flujo completo</H2>
        <P>
          Reactivar es un eslabón de la máquina de captación: prospectas nuevos con{" "}
          <LexLink to="/soluciones/ia">scraping con IA</LexLink>, atiendes a los calientes con
          respuestas automáticas y vuelves a encender a los que se enfriaron. Todo en el mismo CRM.
          Si quieres la suite completa, está en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "voz-ia-crm-inmobiliario",
    title: "CRM por voz con IA: habla y tu pipeline se actualiza solo",
    description:
      "La voz con IA llega al CRM inmobiliario: dicta el resultado de una visita o reunión y el sistema actualiza el estado del lead, agenda el siguiente paso y deja notas — sin tipear nada.",
    category: "Voz · IA",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "6 min",
    keywords: "CRM por voz, voz con IA inmobiliaria, dictado por voz CRM, gestión de leads por voz, notas de voz inmobiliaria, actualizar CRM hablando",
    Body: () => (
      <>
        <P>
          El momento más peligroso de una gestión inmobiliaria es justo después de la visita: el
          corredor vuelve en el auto, con el lead fresco en la cabeza y sin tiempo para abrir el
          computador. Ahí es donde se pierde la información —o se gana la ventaja. Un{" "}
          <strong>CRM por voz con IA</strong> existe para ese momento: hablas y el sistema hace el
          resto.
        </P>

        <H2>Del dictado a la acción</H2>
        <P>
          En vez de llenar formularios, describes la conversación con tus palabras: «la pareja de
          Reñaca quedó muy interesada, pero tiene que vender su departamento primero, llamar el
          jueves». La IA convierte eso en datos accionables:
        </P>
        <UL
          items={[
            "Actualiza el estado del lead (interesado, pendiente de venta, cerrado).",
            "Deja la nota resumida en el expediente del contacto.",
            "Agenda el siguiente paso con fecha y recordatorio.",
            "Mueve el lead a la etapa correcta del pipeline.",
          ]}
        />
        <VoiceFlow />
        <P>
          El ejemplo no es una promesa de laboratorio: es la secuencia completa que ocurre en
          segundos. Tú hablas, la IA escucha, y el lead queda listo para el siguiente paso — con
          la nota, la fecha y el estado correctos.
        </P>

        <H2>La visita que se pierde en el auto</H2>
        <P>
          Pensemos en un escenario típico: el corredor termina una visita a las 19:30, maneja de
          vuelta y llega a casa directo a cenar. La información del lead —«muy interesado, pero
          necesita vender primero»— se queda en su cabeza. A la mañana siguiente la pelea del día
          la tapa, y esa ventaja se pierde. El dictado por voz existe para ese momento exacto: 30
          segundos en el auto y la gestión queda registrada, antes de que la cena la borre.
        </P>

        <H2>¿Qué se pierde cuando no se registra?</H2>
        <UL
          items={[
            "El dato del presupuesto o la condición de venta (lo más valioso).",
            "El tono: «le gustó mucho» no es lo mismo que «solo estaba mirando».",
            "El compromiso: «llamar el jueves» sin anotar se convierte en «nunca llamé».",
            "La continuidad: el colega que toma el caso mañana parte de cero.",
          ]}
        />
        <MistakesCard
          title="El costo de las notas que no se toman"
          items={[
            "Reuniones que llegan sin contexto.",
            "Llamadas prometidas que se olvidan.",
            "Cierres que se enfrían entre visita y visita.",
            "Peleas de equipo: «yo te lo pasé», «no me dijiste nada».",
          ]}
        />

        <H2>Menos tipeo, más ventas</H2>
        <P>
          El tiempo que recuperas no es menor: los corredores pasan horas a la semana tipeando
          notas y actualizando estados. Con la voz, la gestión se hace al volante, en 30 segundos,
          y queda registrada en el{" "}
          <LexLink to="/soluciones/ia">CRM de LexHouse AI</LexLink> —el mismo que conecta WhatsApp,
          agenda y reportes en un solo lugar.
        </P>

        <H2>Notas de voz para el equipo</H2>
        <P>
          La voz también mejora el trabajo en equipo: en vez de un WhatsApp largo a un colega,
          dejas la nota hablada en el expediente y el siguiente responsable la escucha con todo el
          contexto del lead. Menos idas y vueltas, cero información perdida.
        </P>

        <H2>Todo el recorrido en una sola pieza</H2>
        <P>
          La voz es la entrada más rápida, pero el valor está en que alimenta todo lo demás: la
          agenda, el seguimiento automático y el{" "}
          <LexLink to="/soluciones/plataforma">reporte diario a jefatura</LexLink>. Explora la
          plataforma completa en <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "importar-leads-excel-scanner",
    title: "Importar leads a tu CRM: de la hoja de cálculo al pipeline en minutos",
    description:
      "Tu Excel ya tiene los leads: falta el sistema. Cómo importar contactos desde Excel o CSV a un CRM inmobiliario con deduplicación automática, sin perder datos ni duplicar contactos.",
    category: "Importación · Datos",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "6 min",
    keywords: "importar leads a CRM, importar Excel a CRM inmobiliario, scanner de leads, deduplicar contactos, importar CSV contactos, base de leads",
    Body: () => (
      <>
        <P>
          Casi todas las agencias viven de un Excel: la lista de contactos, las fechas, los
          comentarios de cada gestión. El problema no es la hoja de cálculo —es que ahí los leads
          solo <em>existen</em>, no <em>trabajan</em>. Importar esa base a un CRM con IA es el
          primer paso para que los contactos pasen de filas estáticas a un pipeline que se mueve
          solo.
        </P>

        <H2>El problema del Excel infinito</H2>
        <P>
          Cuando todo vive en una planilla, cada semana aparece otro archivo: «contactos nuevos»,
          «pendientes», «seguir». Nadie sabe cuál es la verdad, los nombres se duplican y las notas
          se pierden cuando alguien actualiza la celda equivocada. El CRM resuelve eso con una sola
          fuente de verdad, actualizada en vivo.
        </P>

        <H2>Qué debe hacer una buena importación</H2>
        <UL
          items={[
            "Aceptar Excel y CSV sin preparación manual de columnas.",
            "Detectar automáticamente nombre, teléfono, email y estado de cada fila.",
            "Deduplicar por teléfono o email: no crear dos veces el mismo lead.",
            "Avisar cuántos contactos se detectaron y cuántos duplicados se descartaron.",
          ]}
        />
        <ImportFlow />
        <P>
          El punto que más agradecen las agencias es el último: saber cuánto vale realmente tu
          base. «Tenemos 4.000 contactos» suele ser, tras la deduplicación, «tenemos 3.100
          contactos, de los cuales 800 tienen WhatsApp vivo». Ese dato cambia la estrategia de
          reactivación completa.
        </P>

        <H2>La regla de oro: primero limpiar, después contactar</H2>
        <P>
          Importar y contactar de inmediato es el error clásico. Antes de tocar a nadie, la base
          debe pasar por tres filtros:
        </P>
        <UL
          items={[
            "Deduplicación: el mismo teléfono dos veces es un lead, no dos.",
            "Vigencia: números con acuse de recibo y correos con rebote conocido.",
            "Segmentación: separar por país, ciudad, campaña o etiqueta para no mezclar públicos.",
          ]}
        />
        <PipelineSteps
          title="Del archivo al primer contacto, en orden"
          steps={[
            { emoji: "📄", label: "Importar", sub: "Excel o CSV en un clic" },
            { emoji: "🧹", label: "Limpiar", sub: "duplicados + números muertos" },
            { emoji: "🏷️", label: "Segmentar", sub: "país, ciudad, etiqueta" },
            { emoji: "🚀", label: "Contactar", sub: "campaña o reactivación" },
          ]}
        />
        <P>
          La limpieza no es un lujo: un envío masivo sobre una base sucia quema tu reputación de
          entrega y entierra los números buenos junto con los malos.
        </P>

        <H2>¿Y si mi Excel es un desastre? (formato libre)</H2>
        <P>
          No todo el mundo tiene columnas perfectas. El buen importador también entiende el texto
          libre: pegas la lista tal como la tienes —«Juan Pérez, 56 9 1234 5678, quiere casa en
          La Serena»— y el sistema detecta nombre, teléfono y dato suelto. Es el mismo principio
          del scraping: la IA ordena lo que tú solo tenías en bruto.
        </P>
        <BestPractices
          title="Prepara tu base en 5 minutos"
          items={[
            { emoji: "🧹", label: "Quita filas vacías", sub: "y cabeceras sueltas" },
            { emoji: "📱", label: "Unifica teléfonos", sub: "con o sin código país" },
            { emoji: "✏️", label: "Revisa estados", sub: "nuevo, contactado, cerrado" },
            { emoji: "📤", label: "Importa y revisa", sub: "cuántos duplicados se filtraron" },
          ]}
        />

        <H2>Después de importar, la IA hace el resto</H2>
        <P>
          Importar no es el destino, es la puerta de entrada. Una vez que tu base está en el CRM,
          la IA la ordena por país y etiquetas, clasifica a los que ya respondieron y deja lista la
          reactivación de los que no. Es el mismo recorrido que describimos en nuestro artículo de{" "}
          <LexLink to="/soluciones/ia">reactivación de leads inactivos</LexLink>: la base que ya
          tenías es la más valiosa que vas a tener.
        </P>

        <H2>Del archivo al flujo completo</H2>
        <P>
          Con la base importada, todo lo demás se conecta: campañas,{" "}
          <LexLink to="/soluciones/ia">agentes IA</LexLink> que responden, y reportes diarios a
          jefatura. Si quieres la plataforma completa para tu agencia, está en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "agendar-visitas-ia-calendario",
    title: "Agenda de visitas con IA: de «¿cuándo puede?» a calendario lleno",
    description:
      "El ida y vuelta de mensajes para agendar una visita mata conversaciones. Cómo la IA agenda visitas directo en tu calendario, evita choques de horario y reduce el no-show.",
    category: "Agenda · IA",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "7 min",
    keywords: "agenda de visitas inmobiliarias, agendar visitas con IA, calendario inmobiliario, Google Calendar agentes, reducir no-show visitas, automatizar agenda",
    Body: () => (
      <>
        <P>
          Cada visita que se agenda a mano es una cadena de mensajes: «¿puede el martes?», «no,
          mejor el jueves», «¿a las 11?»… Cada ida y vuelta es una oportunidad para que el lead se
          enfríe, aparezca otro número o simplemente desaparezca. Un <strong>sistema de agenda con
          IA</strong> corta esa cadena de raíz: propone, confirma y agenda en tu calendario, sin
          que intervengas.
        </P>

        <H2>Cómo funciona el agendamiento automático</H2>
        <UL
          items={[
            "La IA consulta tu disponibilidad real en Google Calendar.",
            "Propone horarios concretos al lead, no preguntas abiertas.",
            "Confirma la visita y la agenda con todos los datos del contacto.",
            "Envía recordatorio automático el día anterior: baja el no-show a la mitad.",
          ]}
        />
        <CalendarPicks />
        <P>
          «¿Le sirve el lunes a las 11:00 o el miércoles a las 17:00?» — esa frase, en el momento
          justo de la conversación, es una de las herramientas más rentables del corredor. El
          sistema la lanza automáticamente cuando detecta intención, con horarios reales de tu
          agenda y sin choques.
        </P>

        <H2>El ida y vuelta que mata las visitas</H2>
        <P>
          Contemos los mensajes de un agendamiento manual clásico: propuesta de día, ajuste,
          confirmación, recordatorio, reprogramación… Cinco o seis idas y vueltas en las que el
          lead puede desaparecer en cualquier punto. Cada mensaje es una oportunidad de fuga; la IA
          lo reduce a uno o dos toques.
        </P>
        <Race
          title="Mensajes necesarios para agendar una visita"
          lanes={[
            { emoji: "🤖", label: "Con IA", pct: 15, tone: "#16a34a", note: "1-2 toques: propone, confirma, agenda" },
            { emoji: "✍️", label: "Manual", pct: 55, tone: GOLD, note: "5-6 mensajes con idas y vueltas" },
            { emoji: "😵", label: "Manual + olvido", pct: 90, tone: RED, note: "la visita muere en el «¿y si mejor…?»" },
          ]}
        />

        <H2>El no-show: el ladrón silencioso de visitas</H2>
        <P>
          Entre 20% y 40% de las visitas agendadas no se concretan. Las razones: el lead olvidó,
          le surgió algo o simplemente se le pasó. Las herramientas que bajan ese número son
          simples pero efectivas:
        </P>
        <UL
          items={[
            "Recordatorio automático el día anterior por WhatsApp.",
            "Confirmación con un solo toque: «¿confirmas para mañana 11:00?».",
            "Opción de reprogramar sin llamar: el lead mueve la visita en vez de faltar.",
            "Aviso al corredor en cuanto alguien confirma o mueve.",
          ]}
        />
        <KeyStat value="50%" label="menos no-show con recordatorio automático + confirmación 1 toque" tone={BLUE} />

        <H2>Por qué el horario concreto gana</H2>
        <P>
          Ofrecer «¿cuándo le queda bien?» delega la decisión en el lead —y muchas veces la
          respuesta nunca llega. En cambio, proponer «¿martes 11:00 o jueves 17:00?» es una decisión
          simple y el que responde ya está medio agendado. Ese principio de persuasión es el que
          usan los{" "}
          <LexLink to="/soluciones/ia">agentes IA de LexHouse</LexLink> al atender por WhatsApp
          cada consulta.
        </P>

        <H2>Menos no-show, más reuniones reales</H2>
        <P>
          La estadística es dura: entre 20% y 40% de las visitas inmobiliarias no se concretan. El
          recordatorio automático por WhatsApp, el aviso de re-agenda y la opción de mover el
          horario en un toque recuperan buena parte de esas pérdidas.
        </P>

        <H2>La agenda conectada a todo</H2>
        <P>
          Cuando la agenda vive dentro del CRM, cada visita alimenta el resto del sistema: el lead
          avanza de etapa, el equipo ve el día en el panel y la jefatura recibe su{" "}
          <LexLink to="/soluciones/plataforma">reporte diario</LexLink> con las gestiones reales.
          Explora la plataforma completa en <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "reporte-diario-jefatura-inmobiliaria",
    title: "Reporte diario para jefatura: control de gestión inmobiliaria sin planillas",
    description:
      "El reporte diario que arma el equipo a mano llega tarde y mal. Cómo el CRM genera el informe de gestión a jefatura automáticamente: leads, respuestas, citas y pendientes a las 8:00.",
    category: "Gestión · Reportes",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "6 min",
    keywords: "reporte diario inmobiliaria, control de gestión inmobiliaria, reporte a jefatura, informe de ventas inmobiliarias, KPI agencia inmobiliaria, reporte automático CRM",
    Body: () => (
      <>
        <P>
          «¿Cómo vamos?» es la pregunta que ningún dueño de agencia quiere resolver a base de
          WhatsApps y planillas a medias. El <strong>reporte diario de gestión</strong> existe para
          eso, pero hecho a mano llega tarde, incompleto y con números que nadie audita. Un CRM
          bien armado lo genera solo, con datos reales, cada mañana.
        </P>

        <H2>Qué debería tener un buen reporte diario</H2>
        <UL
          items={[
            "Leads nuevos por canal: cuántos llegaron y de dónde.",
            "Conversaciones activas: quién respondió, quién quedó pendiente.",
            "Citas y visitas del día: agendadas, confirmadas y realizadas.",
            "Alertas: leads calientes sin atender, mensajes sin responder, bases sin contactar.",
          ]}
        />
        <MorningReport />
        <P>
          La diferencia con la planilla de Excel no es el formato: es que el reporte llega solo,
          con datos que nadie tipeó a mano. El número que ves por la mañana es el número real de
          anoche, no la versión que alguien recordó al tercer café.
        </P>

        <H2>Los KPIs que importan (y los que distraen)</H2>
        <P>
          Un reporte puede tener veinte indicadores y servir para nada. La regla: pocos, y que
          cada uno dispare una acción:
        </P>
        <UL
          items={[
            "Leads nuevos → ¿aumentó o bajó el gasto en publicidad?",
            "Tasa de respuesta → ¿está hablando la IA en el tono correcto?",
            "Citas agendadas → ¿el agendamiento automático está activo?",
            "Leads sin atención (el más importante) → ¿quién los toma ahora?",
          ]}
        />
        <BestPractices
          title="De la métrica a la decisión"
          items={[
            { emoji: "🆕", label: "Leads bajan", sub: "revisa campañas y canales" },
            { emoji: "🐢", label: "Respuesta lenta", sub: "revisa al agente IA" },
            { emoji: "🚫", label: "No-show alto", sub: "activa recordatorios" },
            { emoji: "🔥", label: "Calientes sin atender", sub: "llamada ahora, no después" },
          ]}
        />

        <H2>El reporte a las 8:00, sin que nadie lo arme</H2>
        <P>
          El sistema cruza los datos de la noche anterior y entrega el informe a la hora exacta en
          que arranca la operación: la jefatura abre el correo con la foto real del negocio,
          clasificado por país y por campaña, y el equipo parte el día sabiendo a quién perseguir.
          Es el mismo flujo de{" "}
          <LexLink to="/soluciones/plataforma">reportes automáticos de la plataforma de LexHouse
          AI</LexLink>, que además agrupa la información por etiquetas para ver qué estrategias
          están funcionando.
        </P>

        <H2>De los datos a las decisiones</H2>
        <P>
          Un reporte sin acción es entretenido, pero no sirve. Lo valioso es que cada cifra tiene
          su botón: un lead caliente sin atender se convierte en llamada, una campaña que no
          responde se pausa, una zona que despega recibe más presupuesto. La información llega
          cuando todavía se puede actuar.
        </P>

        <H2>El control sin la pega de controlar</H2>
        <P>
          Si tu equipo hoy arma reportes a mano, estás pagando horas para pelear con Excel. Con el
          CRM, la jefatura mira el panel en vivo y recibe el reporte diario sin pedirlo. Revisa
          cómo se conecta todo —WhatsApp, agenda y reportes— en{" "}
          <LexLink to="/soluciones/ia">el CRM de LexHouse AI</LexLink>, o empieza por{" "}
          <LexLink to="/">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
  {
    slug: "captacion-mandatos-propietarios-ia",
    title: "Captación de mandatos con IA: convence al propietario de confiarte su venta",
    description:
      "El mandato es el activo más importante de una inmobiliaria. Cómo usar IA para detectar propietarios en venta directa, presentar tu propuesta de valor y ganar el encargo antes que la competencia.",
    category: "Captación · Mandatos",
    date: "2026-08-01",
    dateLabel: "1 de agosto de 2026",
    readingTime: "7 min",
    keywords: "captación de mandatos, captar propietarios, mandato inmobiliario, conseguir propiedades para vender, propuesta de valor inmobiliaria, captación de cartera inmobiliaria",
    Body: () => (
      <>
        <P>
          Vender propiedades es la parte bonita; conseguir las propiedades es el negocio. La{" "}
          <strong>captación de mandatos</strong> —convencer al propietario de confiarte la venta de
          su inmueble— es el activo que separa a las agencias que crecen de las que sobreviven. Y
          es, también, el terreno donde la IA más rinde hoy.
        </P>

        <H2>El mandato no llega solo</H2>
        <P>
          El propietario que quiere vender recibe ofertas de todas las corredoras: la que lo
          contacta <em>primero</em> y con argumentos tiene la ventaja. La IA detecta señales de
          venta directa —avisos antiguos, propiedades sin publicar, empresas inmobiliarias que
          pudieran tercerizar— y te entrega la lista con contexto antes de que el teléfono suene.
        </P>

        <H2>Qué decirle al propietario (la propuesta que gana)</H2>
        <UL
          items={[
            "Valuación con datos de mercado, no a ojo: «en tu zona, propiedades similares se venden en X». ",
            "Plan de marketing concreto: portales, redes y video profesional.",
            "Respuesta inmediata a interesados: «cada consulta se responde en minutos, 24/7».",
            "Reporte de avance: el propietario sabe cuántas visitas y ofertas ha habido, semana a semana.",
          ]}
        />
        <MandatoDeal />
        <P>
          La comparación es brutal y el propietario la hace solo: de un lado, promesas sin sistema;
          del otro, una máquina que responde, publica y reporta. Cuando la propuesta llega con
          números de su propia zona, la conversación ya no es «cuánto te cobras» sino «¿cuándo
          partimos?».
        </P>

        <H2>Los tres miedos del propietario (y cómo responderlos)</H2>
        <UL
          items={[
            "Miedo a la sobreventa: «¿le pondrás un precio ridículo?» → valuación con datos de mercado comparable.",
            "Miedo al abandono: «¿mi propiedad quedará olvidada?» → reporte semanal de visitas, consultas y publicaciones.",
            "Miedo a la exposición: «¿publicarán mi casa por todos lados?» → plan de publicación controlado y profesional.",
          ]}
        />
        <KeyStat value="7 días" label="es la ventana en la que se decide el 80% de los encargos" tone={RED} />
        <P>
          Ese dato define la estrategia: en la primera semana el propietario decide con quién firma
          — y decide con quien llegó primero con argumentos y sistema. La velocidad de contacto
          tras detectar una señal de venta es tan importante como la propuesta misma.
        </P>

        <H2>La secuencia del primer contacto con un propietario</H2>
        <PipelineSteps
          title="Del aviso publicado al mandato firmado"
          steps={[
            { emoji: "🔍", label: "Detectar", sub: "señales de venta directa" },
            { emoji: "✍️", label: "Mensaje", sub: "contexto + propuesta breve" },
            { emoji: "📞", label: "Reunión", sub: "valuación con datos" },
            { emoji: "✒️", label: "Mandato", sub: "plan de marketing + reportes" },
          ]}
        />
        <P>
          Cada etapa tiene su sistema: el scraping detecta, la IA redacta, la agenda agenda la
          reunión y la plataforma presenta la propuesta con datos. El corredor solo hace lo que
          nadie puede hacer por él: estrechar la mano.
        </P>

        <H2>Por qué el propietario elige a quien le transmite control</H2>
        <P>
          El miedo del propietario no es vender: es que su propiedad quede olvidada en un portafolio
          gigante. Lo que lo convence es ver <em>sistemas</em>: respuesta inmediata a cada
          consulta, avisos publicados bien, reportes de avance. Eso es exactamente lo que un{" "}
          <LexLink to="/soluciones/ia">agente IA como Sofía</LexLink> demuestra desde el primer
          mensaje —y lo que diferencia tu propuesta de la del que promete «lo dejo en portales».
        </P>

        <H2>Del primer contacto al encargo firmado</H2>
        <P>
          El flujo es el mismo pipeline de captación que ya cubrimos:{" "}
          <LexLink to="/soluciones/ia">scraping con IA</LexLink> para encontrar propietarios,
          mensaje personalizado por WhatsApp o email, seguimiento que no insiste y, cuando el
          propietario responde, un equipo que le presenta la propuesta con datos. Toda la suite —
          valuación, marketing y contratos— está en{" "}
          <LexLink to="/soluciones/plataforma">lexhouse-ai.com</LexLink>.
        </P>
      </>
    ),
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

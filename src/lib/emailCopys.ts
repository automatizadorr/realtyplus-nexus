// Plantillas de copy ("copys que convierten") para Correos Personalizados.
// Cada una está especializada en UNA plataforma del ecosistema LexHouse y ataca
// UN dolor concreto de leads tibios (corredoras que ya mostraron interés).
// Todas ofrecen un REGALO de valor (guía descargable en /public/regalos) como CTA.
// Conservan {{empresa}}/{{ciudad}}/{{gancho}} — la edge las rellena por destinatario.

const REGALOS = "https://lexhouse-ai.homes/regalos";

// Ganchos de dolor para la variable {{gancho}} cuando el lead no trae uno.
// Redactados como cláusula en minúscula para encajar mid-frase:
//   "…vemos una y otra vez: {{gancho}}."  ·  "…sobre todo cuando {{gancho}}."
export const GANCHOS_DOLOR: string[] = [
  "los leads llegan por WhatsApp y se pierden entre chats sin seguimiento",
  "no alcanzan a responder cada consulta a tiempo y el interesado se va con otra corredora",
  "las propiedades se publican pero casi no generan consultas",
  "cientos de contactos antiguos se enfrían sin que nadie los retome",
  "el seguimiento depende de la memoria de cada corredor y no de un sistema",
  "publicar la misma propiedad en cada portal toma horas que nadie tiene",
  "no hay forma clara de saber qué lead está caliente y cuál ya se perdió",
  "las consultas que llegan de noche o el fin de semana quedan sin responder",
  "las fotos de las propiedades no destacan frente a la competencia",
];

export type EmailCopy = {
  id: string;
  categoria: string;    // grupo en el selector (Por producto / Icebreaker / Tibio / Agendamiento)
  plataforma: string;   // producto del ecosistema
  dolor: string;        // dolor que ataca
  badge: string;        // etiqueta corta para el selector
  brandColor: string;   // color de marca del diseño
  subject: string;
  titulo: string;
  body: string;
  ctaText: string;
  ctaUrl: string;       // enlace al regalo
  ganchos: string[];    // ganchos de dolor afines a ESTA plataforma (para {{gancho}})
};

// Categorías únicas en orden de aparición (para agrupar el selector).
export const emailCopyCategorias = (): string[] =>
  [...new Set(EMAIL_COPYS.map((c) => c.categoria))];

export const EMAIL_COPYS: EmailCopy[] = [
  {
    id: "whatsapp-respuesta",
    categoria: "Por producto (con regalo)",
    plataforma: "LexHouse CRM · WhatsApp IA",
    dolor: "Respondes tarde y el lead se enfría",
    badge: "Respuesta / WhatsApp",
    brandColor: "#003DA5",
    subject: "{{empresa}}: 12 mensajes para no perder ni un lead más",
    titulo: "Los leads no se pierden por precio. Se pierden por demora.",
    body: `Hola equipo de {{empresa}},

Trabajamos con corredoras en Chile y hay algo que vemos una y otra vez: {{gancho}}. Y el problema casi nunca es el precio de la propiedad — es que el interesado escribe, nadie responde a tiempo, y termina comprando con quien le contestó primero.

Por eso armamos una guía corta y muy práctica, y te la regalamos:

- 12 mensajes de WhatsApp listos para copiar y pegar.
- Qué decir en el primer contacto, en el seguimiento y cuando "lo va a pensar".
- El truco de una sola pregunta que dispara las respuestas.

Es gratis y la puedes usar hoy mismo con tu equipo. Descárgala aquí abajo 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Descargar la guía gratis",
    ctaUrl: `${REGALOS}/guia-whatsapp-inmobiliario.html`,
    ganchos: [
      "los leads llegan por WhatsApp y se pierden entre chats sin seguimiento",
      "no alcanzan a responder cada consulta a tiempo y el interesado se va con otra corredora",
      "las consultas que llegan de noche o el fin de semana quedan sin responder",
      "el seguimiento depende de la memoria de cada corredor y no de un sistema",
    ],
  },
  {
    id: "reels-video",
    categoria: "Por producto (con regalo)",
    plataforma: "LexHouse Studio · Reels IA",
    dolor: "Tus publicaciones pasan desapercibidas",
    badge: "Video / Reels",
    brandColor: "#7c1f2e",
    subject: "{{empresa}}: que tus propiedades dejen de pasar desapercibidas",
    titulo: "Una foto se mira. Un reel se comparte.",
    body: `Hola equipo de {{empresa}},

Publicar propiedades en {{ciudad}} y que casi nadie las vea desgasta — sobre todo cuando {{gancho}}. En redes, una galería de fotos se ignora en un segundo; un buen video se comparte y trae consultas.

Te dejamos de regalo una guía directa al grano:

- 10 ganchos para los primeros 2 segundos de un reel (los que frenan el scroll).
- La estructura exacta de un reel de 15 segundos que convierte.
- El error que hace que un video no genere ni una consulta.

Gratis, sin vueltas. Descárgala aquí 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Descargar los 10 ganchos",
    ctaUrl: `${REGALOS}/guia-reels-inmobiliarios.html`,
    ganchos: [
      "las propiedades se publican pero casi no generan consultas",
      "las fotos de las propiedades no destacan frente a la competencia",
      "las publicaciones pasan desapercibidas en redes y no generan visitas",
      "grabar y editar un buen video de cada propiedad toma más tiempo del que hay",
    ],
  },
  {
    id: "reactivacion-base",
    categoria: "Por producto (con regalo)",
    plataforma: "LexHouse · Reactivación / CRM",
    dolor: "Tu base de contactos antiguos está muerta",
    badge: "Reactivación",
    brandColor: "#0e7c66",
    subject: "{{empresa}}: tu próxima venta ya está en tu base de datos",
    titulo: "Cientos de clientes olvidados. Y una venta escondida entre ellos.",
    body: `Hola equipo de {{empresa}},

La mayoría de las corredoras persigue leads nuevos mientras {{gancho}} — y tiene cientos de contactos antiguos enfriándose en una planilla. Reactivar uno de esos cuesta hasta 7 veces menos que captar uno nuevo.

Preparamos una guía para que empieces esta semana, y es tuya:

- La secuencia exacta de 3 mensajes (WhatsApp + email) para revivir clientes fríos.
- Qué decir el día 0, el día 2 y el día 5 — con las palabras justas.
- El cierre "elegante" que reactiva a 1 de cada 5 contactos dormidos.

Gratis. Descárgala aquí y pruébala con tu base de {{ciudad}} 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Descargar la secuencia",
    ctaUrl: `${REGALOS}/guia-reactivacion-clientes.html`,
    ganchos: [
      "cientos de contactos antiguos se enfrían sin que nadie los retome",
      "la base de datos de clientes crece pero nadie la vuelve a trabajar",
      "no hay forma clara de saber qué lead está caliente y cuál ya se perdió",
      "los clientes de años anteriores quedan olvidados en una planilla",
    ],
  },

  // ── ICEBREAKER (primer contacto, rompe el hielo) ───────────────────────────
  {
    id: "icebreaker-observacion",
    categoria: "Icebreaker (primer contacto)",
    plataforma: "Genérico · ecosistema",
    dolor: "Arrancar la conversación sin sonar a venta",
    badge: "Icebreaker · Observación",
    brandColor: "#003DA5",
    subject: "{{empresa}}: una idea rápida (30 segundos)",
    titulo: "Vi lo de {{empresa}} y quise escribirte",
    body: `Hola equipo de {{empresa}},

Seré breve. Estuve mirando cómo trabajan las corredoras en {{ciudad}} y noté algo que se repite: {{gancho}}.

No vengo a venderte nada hoy. Solo armé una guía corta con ideas concretas para resolver justo eso, y pensé que a {{empresa}} le podía servir.

Te la dejo aquí abajo, es gratis 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Hacer el autodiagnóstico",
    ctaUrl: `${REGALOS}/autodiagnostico-corredora.html`,
    ganchos: GANCHOS_DOLOR,
  },
  {
    id: "icebreaker-pregunta",
    categoria: "Icebreaker (primer contacto)",
    plataforma: "Genérico · ecosistema",
    dolor: "Conectar desde el problema del lead",
    badge: "Icebreaker · Pregunta",
    brandColor: "#003DA5",
    subject: "{{empresa}}, ¿te pasa esto?",
    titulo: "Una pregunta honesta para {{empresa}}",
    body: `Hola equipo de {{empresa}},

Pregunta directa: ¿les pasa que {{gancho}}?

Si la respuesta es sí, no están solos — es lo más común entre las corredoras con las que hablo, y tiene solución.

Preparé una guía breve con lo que mejor funciona. Es tuya, sin compromiso 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Hacer el test de 5 minutos",
    ctaUrl: `${REGALOS}/autodiagnostico-corredora.html`,
    ganchos: GANCHOS_DOLOR,
  },

  // ── CORREO TIBIO (nutrición, ya hubo algún contacto) ───────────────────────
  {
    id: "tibio-valor",
    categoria: "Correo tibio (nutrición)",
    plataforma: "Genérico · ecosistema",
    dolor: "Aportar valor sin presionar",
    badge: "Tibio · Valor",
    brandColor: "#0e7c66",
    subject: "3 ideas que le sirven a {{empresa}} esta semana",
    titulo: "No vengo a venderte. Vengo a aportar.",
    body: `Hola equipo de {{empresa}},

Sé que están ocupados, así que voy al grano con 3 ideas que puedes aplicar hoy — sobre todo si {{gancho}}:

- Responde toda consulta en menos de 5 minutos, aunque sea con un mensaje corto.
- Haz un solo seguimiento con una pregunta de sí/no: dispara las respuestas.
- Guarda cada contacto en un solo lugar, no en la cabeza de cada corredor.

Amplié cada punto en una guía práctica. Te la dejo de regalo 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Descargar el sistema",
    ctaUrl: `${REGALOS}/sistema-anti-fuga-leads.html`,
    ganchos: GANCHOS_DOLOR,
  },
  {
    id: "tibio-prueba-social",
    categoria: "Correo tibio (nutrición)",
    plataforma: "Genérico · ecosistema",
    dolor: "Generar confianza con prueba social",
    badge: "Tibio · Resultados",
    brandColor: "#0e7c66",
    subject: "Lo que cambió para corredoras como {{empresa}}",
    titulo: "Corredoras en {{ciudad}} ya lo están usando",
    body: `Hola equipo de {{empresa}},

Cuando una corredora deja de perder tiempo en {{gancho}}, pasa algo simple: aparecen más visitas y más cierres, con el mismo equipo.

No es magia, es método. Reuní lo esencial en una guía corta para que lo veas por dentro y decidas si les hace sentido.

Es gratis y va sin compromiso 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Ver el checklist",
    ctaUrl: `${REGALOS}/checklist-corredoras-top.html`,
    ganchos: GANCHOS_DOLOR,
  },

  // ── AGENDAMIENTO (llevar a reunión / llamada) ──────────────────────────────
  {
    id: "agenda-demo",
    categoria: "Agendamiento (reunión)",
    plataforma: "Genérico · ecosistema",
    dolor: "Convertir interés en una reunión",
    badge: "Agenda · Demo",
    brandColor: "#003DA5",
    subject: "{{empresa}}: 10 minutos y te muestro cómo se vería",
    titulo: "¿Te muestro cómo se vería con {{empresa}}?",
    body: `Hola equipo de {{empresa}},

Si les hace ruido que {{gancho}}, la mejor forma de que lo evalúen no es leyendo un correo, es viéndolo con sus propias propiedades.

Son 10 minutos, sin PowerPoint: te muestro en vivo cómo quedaría con {{empresa}} y ustedes deciden.

¿Agendamos esta semana? Toca el botón y elige tu horario 👇

Un saludo,
Mario · LexHouse`,
    ctaText: "Agendar 10 minutos",
    ctaUrl: "https://wa.me/56900000000?text=Quiero%20agendar%20una%20demo%20de%20LexHouse",
    ganchos: GANCHOS_DOLOR,
  },
  {
    id: "agenda-cierre",
    categoria: "Agendamiento (reunión)",
    plataforma: "Genérico · ecosistema",
    dolor: "Cierre suave para agendar",
    badge: "Agenda · Cierre suave",
    brandColor: "#7c1f2e",
    subject: "{{empresa}}, ¿lo dejamos para esta semana?",
    titulo: "Cierro el tema, salvo que quieras verlo",
    body: `Hola equipo de {{empresa}},

No quiero insistir de más 🙂 Este es mi último mensaje sobre esto.

Si en algún momento les molestó que {{gancho}}, tengo lista una demo de 10 minutos con las propiedades de {{empresa}}. Si no es el momento, sin problema, cierro el tema.

Si sí quieres verlo, toca abajo y agendamos al toque 👇

Un abrazo,
Mario · LexHouse`,
    ctaText: "Sí, agendemos",
    ctaUrl: "https://wa.me/56900000000?text=Quiero%20agendar%20la%20demo%20de%20LexHouse",
    ganchos: GANCHOS_DOLOR,
  },
];

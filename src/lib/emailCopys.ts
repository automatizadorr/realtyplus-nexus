// Plantillas de copy ("copys que convierten") para Correos Personalizados.
// Cada una está especializada en UNA plataforma del ecosistema LexHouse y ataca
// UN dolor concreto de leads tibios (corredoras que ya mostraron interés).
// Todas ofrecen un REGALO de valor (guía descargable en /public/regalos) como CTA.
// Conservan {{empresa}}/{{ciudad}}/{{gancho}} — la edge las rellena por destinatario.

const REGALOS = "https://lexhouse-ai.homes/regalos";

export type EmailCopy = {
  id: string;
  plataforma: string;   // producto del ecosistema
  dolor: string;        // dolor que ataca
  badge: string;        // etiqueta corta para el selector
  brandColor: string;   // color de marca del diseño
  subject: string;
  titulo: string;
  body: string;
  ctaText: string;
  ctaUrl: string;       // enlace al regalo
};

export const EMAIL_COPYS: EmailCopy[] = [
  {
    id: "whatsapp-respuesta",
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
  },
  {
    id: "reels-video",
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
  },
  {
    id: "reactivacion-base",
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
  },
];

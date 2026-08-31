// Meta datos SEO por ruta — fuente única para el edge middleware (bots/Google)
// y referencia para useSeo. Mantener sincronizado con src/content/blogPosts.tsx.
export interface RouteMeta {
  title: string;
  description: string;
  /** Canonical absoluto que sobreescribe el auto-generado (usado para consolidar
      canibalización cross-domain — ver SEO-AUDITORIA-2026-08.md, A1). */
  canonicalOverride?: string;
}

export const ORIGIN = "https://lexhouse-ai.homes";

export const BLOG_META: Record<string, RouteMeta> = {
  "/": {
    title: "LexHouse AI | CRM Inmobiliario con IA sobre WhatsApp",
    description:
      "LexHouse AI: CRM inmobiliario sobre WhatsApp. Sofía, tu asesora con IA, responde en segundos, agenda reuniones y clasifica cada lead por intención. Reporte diario a jefatura. Empieza gratis.",
  },
  "/blog": {
    title: "Blog | LexHouse AI — IA para corredores inmobiliarios",
    description:
      "Guías y recursos sobre IA inmobiliaria: captación de leads por WhatsApp, CRM, contratos con IA y marketing. Parte del ecosistema LexHouse AI.",
  },
  "/blog/prospeccion-inmobiliaria-scraping-ia": {
    title: "Prospección inmobiliaria con IA: encontrar clientes con scraping en 2026",
    description:
      "Deja de esperar leads y sal a buscarlos. Cómo el scraping con inteligencia artificial encuentra prospectos reales, analiza su presencia digital y redacta el mensaje de contacto — sin listas frías ni copiar y pegar.",
  },
  "/blog/correos-personalizados-inmobiliaria": {
    title: "Correos personalizados para inmobiliarias: llega a la bandeja principal",
    description:
      "Cómo enviar campañas de email personalizadas que de verdad se abren: variables por contacto, diseño profesional y las señales de entrega (SPF, DKIM, List-Unsubscribe) que evitan la pestaña de Promociones y el spam.",
  },
  "/blog/marketing-inmobiliario-ia-guia-2026": {
    title: "Marketing inmobiliario con IA en 2026: guía para corredores",
    description:
      "Cómo la inteligencia artificial cambió la captación y venta de propiedades: leads 24/7, contratos revisados por IA y valuación automática. Guía práctica para corredores.",
  },
  "/blog/crm-whatsapp-inmobiliario-cierres": {
    title: "CRM con IA sobre WhatsApp: cómo multiplicar tus cierres",
    description:
      "Un CRM inmobiliario que vive en WhatsApp y usa IA para responder, clasificar y agendar convierte más leads en reuniones. Te contamos cómo y por qué funciona.",
  },
  "/blog/calificar-leads-inmobiliarios-ia": {
    title: "Cómo calificar leads inmobiliarios con IA (lead scoring) en 2026",
    description:
      "El lead scoring con inteligencia artificial te dice a quién llamar primero. Aprende cómo la IA puntúa a tus contactos por intención de compra y deja de perder tiempo en curiosos.",
  },
  "/blog/chatbot-inmobiliario-whatsapp": {
    title: "Chatbot inmobiliario por WhatsApp: capta y responde primero",
    description:
      "Un chatbot inmobiliario con IA en WhatsApp atiende, cualifica y agenda 24/7. Te contamos qué debe hacer un buen asistente y por qué responder primero define quién cierra la venta.",
    canonicalOverride: "https://lexhouse-ai.com/blog/whatsapp-inmobiliaria",
  },
  "/blog/herramientas-ia-agentes-inmobiliarios-2026": {
    title: "Herramientas de IA para agentes inmobiliarios: guía 2026",
    description:
      "Del primer contacto al cierre: las herramientas de inteligencia artificial que hoy usan los agentes inmobiliarios para captar leads, revisar contratos, valorizar y crear contenido.",
  },
  "/blog/pipeline-captacion-scraping-email-whatsapp": {
    title: "Captación automatizada: cómo el scraping, el email y el WhatsApp trabajan en un solo flujo",
    description:
      "Un solo pipeline que busca prospectos con scraping, redacta el mensaje, lo envía por WhatsApp o correo personalizado y registra cada respuesta. Así funciona la captación completa de clientes en 2026.",
  },
  "/blog/reactivar-leads-inactivos-whatsapp": {
    title: "Reactivar leads inactivos: la mina de oro que todos ignoran",
    description:
      "Tus leads que no respondieron siguen valiendo. Aprende a reactivar contactos inactivos por WhatsApp con IA: mensajes de re-enganche, acuse de recibo y seguimiento automático sin parecer insistente.",
    canonicalOverride: "https://lexhouse-ai.com/blog/reactivar-leads-frios-whatsapp",
  },
  "/blog/voz-ia-crm-inmobiliario": {
    title: "CRM por voz con IA: habla y tu pipeline se actualiza solo",
    description:
      "La voz con IA llega al CRM inmobiliario: dicta el resultado de una visita o reunión y el sistema actualiza el estado del lead, agenda el siguiente paso y deja notas — sin tipear nada.",
  },
  "/blog/importar-leads-excel-scanner": {
    title: "Importar leads a tu CRM: de la hoja de cálculo al pipeline en minutos",
    description:
      "Tu Excel ya tiene los leads: falta el sistema. Cómo importar contactos desde Excel o CSV a un CRM inmobiliario con deduplicación automática, sin perder datos ni duplicar contactos.",
  },
  "/blog/agendar-visitas-ia-calendario": {
    title: "Agenda de visitas con IA: de «¿cuándo puede?» a calendario lleno",
    description:
      "El ida y vuelta de mensajes para agendar una visita mata conversaciones. Cómo la IA agenda visitas directo en tu calendario, evita choques de horario y reduce el no-show.",
  },
  "/blog/reporte-diario-jefatura-inmobiliaria": {
    title: "Reporte diario para jefatura: control de gestión inmobiliaria sin planillas",
    description:
      "El reporte diario que arma el equipo a mano llega tarde y mal. Cómo el CRM genera el informe de gestión a jefatura automáticamente: leads, respuestas, citas y pendientes a las 8:00.",
  },
  "/blog/captacion-mandatos-propietarios-ia": {
    title: "Captación de mandatos con IA: convence al propietario de confiarte su venta",
    description:
      "El mandato es el activo más importante de una inmobiliaria. Cómo usar IA para detectar propietarios en venta directa, presentar tu propuesta de valor y ganar el encargo antes que la competencia.",
  },
};

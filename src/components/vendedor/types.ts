export type PlantillaWa = { id: string; nombre: string; contenido: string; creado_por?: string | null; activa?: boolean };
export type PlantillaEmail = {
  id: string; nombre: string; asunto: string; cuerpo_text: string | null; cuerpo_html: string;
  creado_por?: string | null; activa?: boolean;
  // Diseño visual (mismo compositor que Correos Personalizados del admin):
  // cuerpo_text es el CUERPO fuente que alimenta el compositor; cuerpo_html
  // es el HTML final ya compilado (el que usan Bandeja/Pipeline al enviar).
  design_mode?: "personal" | "pro" | "texto";
  titulo?: string | null;
  cta_text?: string | null;
  cta_url?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
  footer_text?: string | null;
  cta2_text?: string | null;
  cta2_url?: string | null;
  bonus_text?: string | null;
  bonus_url?: string | null;
};

export type LeadCampana = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  pais: string | null;
  etapa_venta: string | null;
  ha_respondido: boolean | null;
  resumen_ia: string | null;
  fecha_asignacion: string | null;
  fecha_cierre: string | null;
  motivo_cierre: string | null;
  fecha_proximo_contacto: string | null;
  vendedor_id: string | null;
  // Datos que llegan desde Buscar Leads (o del alta manual) y viajan con el
  // lead al Pipeline, para no tener que volver a la prospeccion.
  instagram?: string | null;
  facebook?: string | null;
  mensaje_instagram?: string | null;
  notas_vendedor?: string | null;
  prospecto_id?: string | null;
  origen?: string | null;
  ultimo_contacto_at?: string | null;
  // Captacion por el bot Camil-AI: cuando escalo la conversacion a humano o
  // el lead agendo reunion. Marca el lead como "ya converso con la IA".
  escalado_ia_at?: string | null;
  escalado_ia_motivo?: string | null;
};

// Ficha completa que devuelve la RPC vendedor_lead_detalle.
export type ContactoLog = {
  canal: "whatsapp" | "email" | "llamada" | "instagram" | "facebook";
  resultado: string | null;
  mensaje_final: string | null;
  created_at: string;
};
export type EtapaLog = { etapa_anterior: string | null; etapa_nueva: string; created_at: string };
export type LeadDetalle = {
  lead: LeadCampana & Record<string, unknown>;
  prospecto: Record<string, unknown> | null;
  etapas: EtapaLog[];
  contactos: ContactoLog[];
};

// Modo de remitente de correo del vendedor. Las dos cuentas Resend gratis
// tienen 100 correos/dia cada una; "auto" las alterna para llegar a 200.
export type RemitenteModo = "auto" | "resend1" | "resend2" | "particular";
export const REMITENTE_DOMINIO: Record<Exclude<RemitenteModo, "particular">, string> = {
  auto: "send.lexhouse-ai.com / lexhouse-ai.online",
  resend1: "send.lexhouse-ai.com",
  resend2: "lexhouse-ai.online",
};
export const REMITENTE_CUPO: Record<RemitenteModo, number | null> = {
  auto: 200, resend1: 100, resend2: 100, particular: null,
};
export type RemitenteConfig = {
  remitente_modo: RemitenteModo;
  remitente_from_name: string | null;
  remitente_local: string | null;
  remitente_particular: string | null;
  remitente_reply_to: string | null;
};

export const ETAPAS = ["nuevo", "contactado", "interesado", "demo", "ganado", "perdido"] as const;
export type Etapa = (typeof ETAPAS)[number];

// Columnas que se muestran en el kanban del Pipeline. "nuevo" ya no se
// muestra ahí: ese paso ahora lo cubre la Bandeja (donde se elige
// plantilla y se contacta); al liberar, el lead entra directo a
// "contactado" (ver vendedor_liberar_a_pipeline).
export const ETAPAS_PIPELINE = ETAPAS.filter((e): e is Exclude<Etapa, "nuevo"> => e !== "nuevo");

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Respondió / Interesado",
  demo: "Demo agendada",
  ganado: "Ganado",
  perdido: "Perdido",
};

export type VendedorKpis = {
  asignados: number; contactados: number; interesados: number; demos: number;
  ganados: number; perdidos: number; tasa_respuesta_pct: number; dias_promedio_cierre: number | null;
};

export type CorreosResumen = {
  cupo_diario: number;
  enviados_hoy: number;
  total_30d: number;
  enviado_30d: number;
  entregado_30d: number;
  abierto_30d: number;
  click_30d: number;
  rebotado_30d: number;
  fallido_30d: number;
};

export type RolVenta = "setter" | "closer" | "ambos";

// Etapas que cada rol puede asignar como destino al mover un lead
// (debe coincidir con el chequeo del lado servidor en vendedor_mover_etapa).
export const ETAPAS_PERMITIDAS: Record<RolVenta, Etapa[]> = {
  setter: ["contactado", "interesado", "perdido"],
  closer: ["interesado", "demo", "ganado", "perdido"],
  ambos: ["contactado", "interesado", "demo", "ganado", "perdido"],
};

// ---------------------------------------------------------------------
// Paleta por etapa. Una sola fuente de verdad para las columnas del
// kanban, el borde de cada tarjeta y la barra de progreso del lead.
// ---------------------------------------------------------------------
export type EtapaColor = {
  /** Color plano (barra de progreso, punto de la columna). */
  hex: string;
  /** Clases de badge/pill. */
  badge: string;
  /** Borde izquierdo de la tarjeta. */
  card: string;
  /** Fondo tenue de la cabecera de columna. */
  head: string;
};

export const ETAPA_COLOR: Record<Etapa, EtapaColor> = {
  nuevo: {
    hex: "#94a3b8",
    badge: "bg-slate-500/15 text-slate-600 border-slate-500/30",
    card: "border-l-slate-400",
    head: "bg-slate-500/10",
  },
  contactado: {
    hex: "#003DA5",
    badge: "bg-[#003DA5]/15 text-[#003DA5] border-[#003DA5]/30",
    card: "border-l-[#003DA5]",
    head: "bg-[#003DA5]/10",
  },
  interesado: {
    hex: "#0891b2",
    badge: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
    card: "border-l-cyan-500",
    head: "bg-cyan-500/10",
  },
  demo: {
    hex: "#7c3aed",
    badge: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    card: "border-l-violet-500",
    head: "bg-violet-500/10",
  },
  ganado: {
    hex: "#059669",
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    card: "border-l-emerald-500",
    head: "bg-emerald-500/10",
  },
  perdido: {
    hex: "#dc2626",
    badge: "bg-red-500/15 text-red-600 border-red-500/30",
    card: "border-l-red-500",
    head: "bg-red-500/10",
  },
};

// Avance del lead en el embudo, 0-100. "perdido" se muestra completo pero en
// rojo: el proceso terminó, solo que sin venta.
export const ETAPA_PROGRESO: Record<Etapa, number> = {
  nuevo: 8, contactado: 30, interesado: 55, demo: 78, ganado: 100, perdido: 100,
};

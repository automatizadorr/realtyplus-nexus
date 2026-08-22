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

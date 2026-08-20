export type PlantillaWa = { id: string; nombre: string; contenido: string; creado_por?: string | null; activa?: boolean };
export type PlantillaEmail = {
  id: string; nombre: string; asunto: string; cuerpo_text: string | null; cuerpo_html: string;
  creado_por?: string | null; activa?: boolean;
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

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Respondió / Interesado",
  demo: "Demo agendada",
  ganado: "Ganado",
  perdido: "Perdido",
};

export type RolVenta = "setter" | "closer" | "ambos";

// Etapas que cada rol puede asignar como destino al mover un lead
// (debe coincidir con el chequeo del lado servidor en vendedor_mover_etapa).
export const ETAPAS_PERMITIDAS: Record<RolVenta, Etapa[]> = {
  setter: ["contactado", "interesado", "perdido"],
  closer: ["interesado", "demo", "ganado", "perdido"],
  ambos: ["contactado", "interesado", "demo", "ganado", "perdido"],
};

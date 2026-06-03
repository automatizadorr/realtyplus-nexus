// ── Etiquetas permanentes: fuente única de verdad del ORDEN de presentación ──
// El backend marca cada etiqueta con `es_permanente = true` (ver migración
// 20260603170000_etiquetas_permanentes.sql). Aquí definimos en qué ORDEN deben
// mostrarse en toda la app: sección de Etiquetados y los 4 métodos de extracción
// (Excel, Word, HTML y webhook n8n). Así cada descarga tiene la misma estructura.

export const PERMANENT_TAG_ORDER = [
  "No interesa",
  "Agente asignado",
  "Pendiente asignar agente",
  "Solo quiere propiedades",
  "Cita agendada",
] as const;

/** Posición canónica de una etiqueta permanente (las no listadas van al final). */
export function permanentRank(nombre: string): number {
  const i = PERMANENT_TAG_ORDER.indexOf(nombre as (typeof PERMANENT_TAG_ORDER)[number]);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Ordena una lista de etiquetas: primero las permanentes en su orden canónico,
 * luego el resto alfabéticamente. No muta el arreglo original.
 */
export function orderTags<T extends { nombre: string; es_permanente?: boolean | null }>(
  tags: T[],
): T[] {
  return [...tags].sort((a, b) => {
    const ra = permanentRank(a.nombre);
    const rb = permanentRank(b.nombre);
    if (ra !== rb) return ra - rb;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

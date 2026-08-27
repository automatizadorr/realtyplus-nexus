// ---------------------------------------------------------------------
// Filtros de leads del vendedor: una sola definición para las tres
// pantallas (Hoy, Bandeja y Pipeline).
//
// Antes cada pantalla tenía los suyos: el Pipeline filtraba por país,
// origen y respuesta, y la Bandeja solo tenía un buscador de texto — así
// que un vendedor con leads de varios países no podía separarlos justo
// donde más falta hace, que es al elegir a quién contactar primero.
//
// Todos se aplican del lado del servidor: filtrar sobre la página ya
// cargada escondería los leads que están más allá de las primeras filas.
// ---------------------------------------------------------------------

export type OrdenLeads = "antiguos" | "nuevos" | "nombre";

export type FiltrosLead = {
  q: string;
  /** "all" o el nombre del país tal como está guardado (ver vendedor_paises). */
  pais: string;
  /** "all" | campana | buscar_leads | manual_vendedor | whatsapp_inbound */
  origen: string;
  /** Solo los que contestaron alguna vez. */
  respondio: boolean;
  /** Solo los que ya conversaron con el bot y escalaron a humano. */
  captadosIa: boolean;
  /** Seguimiento agendado para hoy o antes. */
  vencidos: boolean;
  /** Tiene correo cargado (los únicos a los que se les puede escribir). */
  conEmail: boolean;
  /** Tiene un teléfono con pinta de marcable. */
  conTelefono: boolean;
  /** Antigüedad de la asignación: "all" | "hoy" | "7d" | "30d" | "viejos" */
  antiguedad: string;
  orden: OrdenLeads;
};

export const filtrosVacios = (): FiltrosLead => ({
  q: "", pais: "all", origen: "all",
  respondio: false, captadosIa: false, vencidos: false,
  conEmail: false, conTelefono: false,
  antiguedad: "all", orden: "antiguos",
});

/** Cuántos filtros hay puestos (0 = ninguno). Sirve para el badge y el "Limpiar". */
export function contarFiltros(f: FiltrosLead): number {
  return [
    Boolean(f.q.trim()), f.pais !== "all", f.origen !== "all",
    f.respondio, f.captadosIa, f.vencidos, f.conEmail, f.conTelefono,
    f.antiguedad !== "all",
  ].filter(Boolean).length;
}

export const ORIGENES: { valor: string; label: string }[] = [
  { valor: "all", label: "Todos los orígenes" },
  { valor: "buscar_leads", label: "Buscar Leads" },
  { valor: "manual_vendedor", label: "Alta manual" },
  // Escribió al WhatsApp del bot sin estar en ninguna campaña: la ficha la
  // abrió el propio bot al captarlo.
  { valor: "whatsapp_inbound", label: "WhatsApp entrante" },
  // Todo lo demás que no cargó el vendedor: importaciones y campañas.
  { valor: "campana", label: "Campaña / importados" },
];

export const ANTIGUEDADES: { valor: string; label: string }[] = [
  { valor: "all", label: "Cualquier antigüedad" },
  { valor: "hoy", label: "Asignados hoy" },
  { valor: "7d", label: "Últimos 7 días" },
  { valor: "30d", label: "Últimos 30 días" },
  { valor: "viejos", label: "Hace más de 30 días" },
];

export const ORDENES: { valor: OrdenLeads; label: string }[] = [
  { valor: "antiguos", label: "Los más antiguos primero" },
  { valor: "nuevos", label: "Los más nuevos primero" },
  { valor: "nombre", label: "Por nombre (A-Z)" },
];

/** PostgREST separa las condiciones de `or(...)` por comas: una coma dentro
 *  del texto buscado rompería la consulta entera. */
export function sanearBusqueda(q: string): string {
  return q.trim().replace(/[,()*]/g, " ").replace(/\s+/g, " ");
}

function finDeHoyISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function haceDiasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Aplica los filtros a una consulta de `leads_campana`.
 *
 * El `any` es a propósito: el builder de PostgREST es un tipo recursivo y
 * tiparlo genéricamente acá hace que TypeScript se rinda ("Type
 * instantiation is excessively deep"). El resultado se vuelve a tipar en
 * cada consulta, que es donde importa.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltrosLead(query: any, f: FiltrosLead): any {
  let q = query;
  const texto = sanearBusqueda(f.q);
  if (texto) q = q.or(`nombre.ilike.%${texto}%,email.ilike.%${texto}%,telefono.ilike.%${texto}%`);

  if (f.pais !== "all") {
    // "Sin pais" es la etiqueta con la que vendedor_paises() agrupa a los
    // leads que llegaron sin ese dato.
    if (f.pais === "Sin pais") q = q.or("pais.is.null,pais.eq.");
    else q = q.eq("pais", f.pais);
  }

  if (f.origen === "campana") {
    q = q.or("origen.is.null,and(origen.neq.buscar_leads,origen.neq.manual_vendedor,origen.neq.whatsapp_inbound)");
  } else if (f.origen !== "all") {
    q = q.eq("origen", f.origen);
  }

  if (f.respondio) q = q.is("ha_respondido", true);
  if (f.captadosIa) q = q.not("escalado_ia_at", "is", null);
  if (f.vencidos) q = q.lte("fecha_proximo_contacto", finDeHoyISO());
  if (f.conEmail) q = q.not("email", "is", null).neq("email", "");
  // Los teléfonos que no se pueden marcar se cargan con un marcador
  // 'sin-tel-…' (la columna es NOT NULL y UNIQUE), así que no basta con
  // pedir que no sea nulo.
  if (f.conTelefono) q = q.not("telefono", "ilike", "sin-tel-%");

  if (f.antiguedad === "hoy") q = q.gte("fecha_asignacion", haceDiasISO(0));
  else if (f.antiguedad === "7d") q = q.gte("fecha_asignacion", haceDiasISO(7));
  else if (f.antiguedad === "30d") q = q.gte("fecha_asignacion", haceDiasISO(30));
  else if (f.antiguedad === "viejos") q = q.lt("fecha_asignacion", haceDiasISO(30));

  return q;
}

/** Orden pedido, traducido a columna + dirección. */
export function ordenDe(f: FiltrosLead): { columna: string; ascendente: boolean } {
  if (f.orden === "nombre") return { columna: "nombre", ascendente: true };
  return { columna: "fecha_asignacion", ascendente: f.orden === "antiguos" };
}

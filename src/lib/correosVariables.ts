// Variables de contacto resueltas en plantillas de correo (frontend y edges).
// Centraliza la resolución de {{variable}} para que la vista previa del envío
// muestre EXACTAMENTE lo que reemplaza la edge `send-personalized-campaign`.

export type Recipient = {
  email: string;
  empresa: string;
  ciudad: string;
  gancho: string;
  nombre?: string;
  pais?: string;
  datos?: Record<string, string>;
};

export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const isEmail = (s: string) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test((s || "").trim());

// Reemplaza {{variable}} en una plantilla: columnas fijas + cualquier columna
// del sheet en `datos` (minúsculas). Las variables desconocidas quedan intactas
// ({{name}}?) solo para que la vista previa pueda detectarlas.
export function fill(tpl: string, r: Partial<Recipient>): string {
  const map: Record<string, string> = {
    email: r.email ?? "",
    empresa: r.empresa ?? "",
    ciudad: r.ciudad ?? "",
    gancho: r.gancho ?? "",
    // {{nombre}} nunca queda vacío: cae al nombre de la empresa.
    nombre: (r.nombre || r.empresa) ?? "",
  };
  for (const [k, v] of Object.entries(r.datos ?? {})) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) map[k.toLowerCase()] = s;
  }
  return tpl.replace(/\{\{\s*([\w\-.]+)\s*\}\}/gi, (_m, key) => map[key.toLowerCase()] ?? "");
}

// Devuelve los tokens {{...}} que quedan SIN reemplazar en el texto renderizado.
export function unresolvedTokens(rendered: string): string[] {
  const m = rendered.match(/\{\{\s*([\w\-.]+)\s*\}\}/g) || [];
  return m.map((t) => t.trim());
}
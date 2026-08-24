// Helpers compartidos de las edge functions de correo de LexHouse.
// Fase 4: unifica pickPais / fillTemplate / zonedToUtc / HORA_RE / corsHeaders
// entre send-personalized-campaign, cron-secuencias-correo y programar-secuencia
// para que la resolución de {{variables}} sea idéntica en los tres.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TZ = "America/Santiago";
export const LIMITE_DIA = 200; // 2 cuentas Resend gratis: 100 + 100 = 200 correos/día.

// Modo de remitente elegido por el vendedor (vendedores.remitente_modo).
//   auto        -> alterna las dos cuentas Resend (200/dia entre ambas)
//   resend1     -> fija send.lexhouse-ai.com (100/dia)
//   resend2     -> fija lexhouse-ai.online   (100/dia)
//   particular  -> el vendedor manda desde su propio correo; el envio no pasa
//                  por aqui (lo abre su cliente de correo), asi que si llega
//                  igual se trata como "auto".
export type RemitenteModo = "auto" | "resend1" | "resend2" | "particular";

export function normalizarModo(v: unknown): RemitenteModo {
  return v === "resend1" || v === "resend2" || v === "particular" ? v : "auto";
}

/** Cupo diario segun el modo: fijar una sola cuenta corta el cupo a la mitad. */
export function limiteDiaPara(modo: RemitenteModo): number {
  return modo === "resend1" || modo === "resend2" ? LIMITE_DIA / 2 : LIMITE_DIA;
}

export function resendKeyFor(i: number, modo: RemitenteModo = "auto"): { key: string; index: number; domain: string } {
  const k1 = Deno.env.get("RESEND_API_KEY_1");
  const k2 = Deno.env.get("RESEND_API_KEY_2");
  const fallback = Deno.env.get("RESEND_API_KEY");
  const key1 = k1 || fallback;
  if (!key1) throw new Error("Falta RESEND_API_KEY_1 o RESEND_API_KEY (fallback)");
  const cuenta1 = { key: key1, index: 0, domain: "send.lexhouse-ai.com" };
  if (!k2) return cuenta1;
  const cuenta2 = { key: k2, index: 1, domain: "lexhouse-ai.online" };
  // Con la cuenta fijada no se alterna: todos los correos de la tanda salen
  // del mismo dominio, que es justo lo que se pide al elegir resend1/resend2.
  if (modo === "resend1") return cuenta1;
  if (modo === "resend2") return cuenta2;
  return i % 2 === 0 ? cuenta1 : cuenta2;
}

export function applyDomain(email: string, domain: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  return email.slice(0, at + 1) + domain;
}

// Escapa HTML para evitar inyección en los correos renderizados.
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// País ya resuelto o desde cualquier columna del sheet (datos.*).
export function pickPais(r: { pais?: string; datos?: Record<string, unknown> }): string {
  if (r.pais?.trim()) return r.pais.trim();
  const d = r.datos ?? {};
  if (typeof d.pais === "string" && d.pais.trim()) return d.pais.trim();
  if (typeof d.país === "string" && d.país.trim()) return d.país.trim();
  if (typeof d.country === "string" && d.country.trim()) return d.country.trim();
  return "";
}

// Reemplaza {{variable}} en una plantilla: columnas fijas (email, empresa,
// ciudad, gancho, nombre, pais) + cualquier columna en la bolsa `datos`.
// {{nombre}} nunca queda vacío: cae al nombre de la empresa.
export function fillTemplate(tpl: string, r: Record<string, unknown>): string {
  const datos = (typeof r.datos === "object" && r.datos !== null ? r.datos : {}) as Record<string, unknown>;
  const map: Record<string, string> = {
    email: (r.email as string) ?? "",
    empresa: (r.empresa as string) ?? "",
    ciudad: (r.ciudad as string) ?? "",
    gancho: (r.gancho as string) ?? "",
    pais: pickPais(r),
    nombre: (r.nombre as string) || (r.empresa as string) || "",
  };
  for (const [k, v] of Object.entries(datos)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) map[k.toLowerCase()] = s;
  }
  return tpl.replace(/\{\{\s*([\w\-.]+)\s*\}\}/gi, (_m, key) => map[key.toLowerCase()] ?? "");
}

// "2026-08-03 09:30" en hora local de `tz` → instante UTC (truco estándar).
export function zonedToUtc(ymd: string, hhmm: string, tz: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asUTC - guess)).toISOString();
}
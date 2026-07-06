// Helpers de acuse de WhatsApp (read receipts / wamid) compartidos por la
// mensajería de Oportunidades (AutomationChatArea) y el inbox normal (ChatArea).
//
// Los acuses llegan por la "Capa 2" del flujo n8n de Sofía y se persisten en
// `estado_envio`. Aceptamos tanto los valores en español que ya usaba el CRM
// (enviando/enviado/entregado/respondido/fallido) como los de WhatsApp Cloud API
// (sent/delivered/read/failed).

export type TickFase = "enviando" | "enviado" | "entregado" | "leido" | "fallido" | null;

// Normaliza el estado del acuse a una de 5 fases.
export function tickFase(estado: string | null | undefined): TickFase {
  const e = (estado || "").toLowerCase();
  if (e === "enviando") return "enviando";
  if (e === "fallido" || e === "failed" || e === "error") return "fallido";
  if (e === "respondido" || e === "read" || e === "leido") return "leido";
  if (e === "entregado" || e === "delivered") return "entregado";
  if (e === "enviado" || e === "sent") return "enviado";
  return null;
}

// Semáforo comercial por lead (columna `senal` de las vistas de inbox), derivado
// de los acuses: caliente=respondió/leyó reciente, tibio=leyó sin responder,
// frio=entregado no leído, fallido=envío falló. Mismo círculo en Oportunidades
// (AutomationSidebar) y en reactivación (ContactSidebar).
export const SENAL_META: Record<string, { color: string; label: string }> = {
  caliente: { color: "#22c55e", label: "Caliente · respondió, llamar" },
  tibio: { color: "#f59e0b", label: "Tibio · leyó sin responder" },
  frio: { color: "#94a3b8", label: "Frío · entregado, no leído" },
  fallido: { color: "#f43f5e", label: "Falló el envío" },
};
export function senalMeta(senal: string | null | undefined) {
  return senal ? SENAL_META[senal] : undefined;
}

export interface AcuseInfo {
  fase: Exclude<TickFase, null>;
  corto: string;
  largo: string;
  clase: string;
  badge: string;
}

// Traduce el acuse (wamid) del último mensaje saliente a un texto claro que
// explique en qué punto va el mensaje frente al lead. `corto` para el badge de
// la cabecera; `largo` para la tira explicativa sobre el compositor.
export function estadoAcuse(estado: string | null | undefined): AcuseInfo | null {
  switch (tickFase(estado)) {
    case "enviando":
      return { fase: "enviando", corto: "Enviando", largo: "Enviando el mensaje…", clase: "text-muted-foreground", badge: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    case "enviado":
      return { fase: "enviado", corto: "Enviado", largo: "Enviado — todavía no le llega al lead", clase: "text-muted-foreground", badge: "bg-muted text-muted-foreground border-border" };
    case "entregado":
      return { fase: "entregado", corto: "Entregado", largo: "Entregado — el lead aún no lo ha leído", clase: "text-sky-600", badge: "bg-sky-500/10 text-sky-600 border-sky-500/30" };
    case "leido":
      return { fase: "leido", corto: "Leído", largo: "Leído por el lead", clase: "text-sky-600 font-medium", badge: "bg-sky-500/15 text-sky-700 border-sky-500/40" };
    case "fallido":
      return { fase: "fallido", corto: "Falló", largo: "No se pudo entregar el mensaje al lead", clase: "text-rose-600 font-medium", badge: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
    default:
      return null;
  }
}

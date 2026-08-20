// Rellena {{variable}} en plantillas con los datos del lead. Mismas variables
// que usa el sistema de correos (_shared/correo.ts en las edge functions):
// nombre, empresa, ciudad, pais, propuesta_valor, gancho.
export type LeadVars = {
  nombre?: string;
  ciudad?: string;
  pais?: string;
  propuesta_valor?: string;
  problemas?: string[];
};

export function fillTemplate(template: string, lead: LeadVars): string {
  const vars: Record<string, string> = {
    nombre: lead.nombre || "",
    empresa: lead.nombre || "",
    ciudad: lead.ciudad || "",
    pais: lead.pais || "",
    propuesta_valor: lead.propuesta_valor || "",
    gancho: Array.isArray(lead.problemas) && lead.problemas.length ? lead.problemas[0] : "",
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

// voice-variables.ts — Single Source of Truth para variables de voz ElevenLabs ↔ CRM
// Sincroniza: CRM (Sheet/Supabase) → n8n/Orchestrator → ElevenLabs dynamic_variables

export const ELEVENLABS_VOICE_VARIABLES = [
  // Lead info
  { crmField: "nombre", elevenVar: "lead_name", required: true, transform: "trim" },
  { crmField: "broker_name", elevenVar: "broker_name", required: true, transform: "default:LexHouse" },
  { crmField: "telefono", elevenVar: "lead_phone", required: true, transform: "normPhoneE164" },
  { crmField: "tipo_interes", elevenVar: "lead_interest", required: false, transform: "default:información general" },
  { crmField: "resumen", elevenVar: "lead_notes", required: false, transform: "default:sin notas" },
  { crmField: "call_objective", elevenVar: "call_objective", required: true, transform: "default:agendar_visita" },

  // Property info (condicional has_property)
  { crmField: "has_property", elevenVar: "has_property", required: true, transform: "booleanFrom:propiedad" },
  { crmField: "propiedad", elevenVar: "property_title", required: false, transform: "default:" },
  { crmField: "tipo_operacion", elevenVar: "property_operation", required: false, transform: "default:venta" },
  { crmField: "tipo_propiedad", elevenVar: "property_type", required: false, transform: "default:" },
  { crmField: "valor_uf", elevenVar: "property_price", required: false, transform: "formatPriceWithCurrency" },
  { crmField: "ubicacion", elevenVar: "property_city", required: false, transform: "default:" },
  { crmField: "direccion", elevenVar: "property_address", required: false, transform: "default:" },
  { crmField: "dormitorios", elevenVar: "property_bedrooms", required: false, transform: "numberOrEmpty" },
  { crmField: "banos", elevenVar: "property_bathrooms", required: false, transform: "numberOrEmpty" },
  { crmField: "m2_totales", elevenVar: "property_sqm", required: false, transform: "numberOrEmpty" },
  { crmField: "informe", elevenVar: "property_description", required: false, transform: "default:" },
  { crmField: "agent_instructions", elevenVar: "agent_instructions", required: true, transform: "default:instrucciones_estandar" },
] as const;

export type ElevenLabsVoiceVar = typeof ELEVENLABS_VOICE_VARIABLES[number]["elevenVar"];

export const ELEVENLABS_AGENT_ID = "agent_5801kj0vngjhfrjvnypa36vvagmv";
export const ELEVENLABS_PHONE_NUMBER_ID = "phnum_2801kv51jv67err933c5ettx80me";
export const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

export function normPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("569") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("9") && digits.length === 9) return `+56${digits}`;
  if (digits.startsWith("56") && digits.length >= 11) return `+${digits}`;
  return `+56${digits}`;
}

export function formatPriceWithCurrency(valorUf: string | number, tipoMoneda: string = "UF"): string {
  const num = typeof valorUf === "string" ? parseFloat(valorUf.replace(/[^\d.]/g, "")) : valorUf;
  if (isNaN(num)) return "";
  return `${num.toLocaleString("es-CL")} ${tipoMoneda.toUpperCase()}`;
}

export function booleanFromPropiedad(propiedad: string): "true" | "false" {
  return propiedad && propiedad.trim().length > 0 ? "true" : "false";
}

export function numberOrEmpty(val: string | number): string {
  const num = typeof val === "string" ? parseInt(val.replace(/\D/g, ""), 10) : val;
  return isNaN(num) ? "" : String(num);
}

export function buildDynamicVariables(crmData: Record<string, any>): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const mapping of ELEVENLABS_VOICE_VARIABLES) {
    const raw = crmData[mapping.crmField];
    let value: string;

    switch (mapping.transform) {
      case "trim":
        value = raw?.trim() || "";
        break;
      case "normPhoneE164":
        value = raw ? normPhoneE164(raw) : "";
        break;
      case "formatPriceWithCurrency":
        value = formatPriceWithCurrency(raw, crmData["tipo_moneda"] || "UF");
        break;
      case "booleanFrom:propiedad":
        value = booleanFromPropiedad(crmData["propiedad"] || "");
        break;
      case "numberOrEmpty":
        value = numberOrEmpty(raw);
        break;
      default:
        if (mapping.transform.startsWith("default:")) {
          const def = mapping.transform.replace("default:", "");
          value = raw ? String(raw) : def;
        } else {
          value = raw ? String(raw) : "";
        }
    }

    if (mapping.required && !value) {
      console.warn(`[voice-variables] Variable requerida vacía: ${mapping.elevenVar} (crm: ${mapping.crmField})`);
    }

    vars[mapping.elevenVar] = value;
  }

  return vars;
}

// Mapeo de headers del Sheet actual (con espacios/acentos) → campos canónicos
export const SHEET_HEADER_TO_CRM: Record<string, string> = {
  "NOMBRE ": "nombre",
  "NOMBRE": "nombre",
  "TELEFONO": "telefono",
  "PROPIEDAD": "propiedad",
  "TIPO PROPIEDAD": "tipo_propiedad",
  "TIPO_OPERACION": "tipo_operacion",
  "VALOR UF": "valor_uf",
  "tipo moneda": "tipo_moneda",
  "TIPO MONEDA": "tipo_moneda",
  "UBICACION": "ubicacion",
  "DIRECCION": "direccion",
  "DORMITORIOS": "dormitorios",
  "BANOS": "banos",
  "M2 TOTALES": "m2_totales",
  "M2 CONSTRUIDOS": "m2_totales",
  "RESUMEN": "resumen",
  "INFORME": "informe",
  "PROPOSITO": "tipo_interes",
  "TIPO INTERES": "tipo_interes",
};

export function normalizeSheetRow(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [sheetKey, crmKey] of Object.entries(SHEET_HEADER_TO_CRM)) {
    if (row[sheetKey] !== undefined) {
      normalized[crmKey] = row[sheetKey];
    }
  }
  // broker_name por defecto si no viene
  if (!normalized.broker_name) normalized.broker_name = "LexHouse";
  // call_objective por defecto
  if (!normalized.call_objective) normalized.call_objective = "agendar_visita";
  // agent_instructions por defecto
  if (!normalized.agent_instructions) normalized.agent_instructions = "instrucciones_estandar";
  return normalized;
}
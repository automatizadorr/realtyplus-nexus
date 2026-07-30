// Buscador de leads (prospección) con Perplexity Sonar (búsqueda web nativa).
// Replica la skill "prospeccion": busca negocios reales de un nicho+ciudad,
// analiza su presencia digital, puntúa la oportunidad y devuelve un dataset.
// Requiere caller admin (has_role) y el secreto PERPLEXITY_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sonar Pro: búsqueda web con más contexto (mejor para extraer datos de contacto).
const MODEL = "sonar-pro";

// Extrae el primer array JSON de objetos ([{...}]) con corchetes balanceados.
function extractFirstJsonArray(text: string): unknown[] | null {
  const m = text.match(/\[\s*\{/);
  if (!m || m.index === undefined) return null;
  const start = m.index;
  let depth = 0, inStr = false, esc = false, quote = "";
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        try { const a = JSON.parse(text.slice(start, i + 1)); return Array.isArray(a) ? a : null; }
        catch { return null; }
      }
    }
  }
  return null;
}

function buildPrompt(nicho: string, ciudad: string, servicio: string, cantidad: number): string {
  return `Eres un prospector experto. Busca en internet ${cantidad} negocios REALES del rubro "${nicho}" ubicados en "${ciudad}" (Chile salvo que la ciudad indique otro país).

REGLA FUNDAMENTAL: solo datos reales y verificados con la búsqueda web. Nunca inventes negocios, teléfonos, webs ni correos. Si un dato no lo encuentras, déjalo como cadena vacía "".

Para cada negocio, con la información pública que encuentres:
- Analiza su presencia digital (si tiene web, HTTPS, si se ve moderna o antigua, si tiene CRM/automatización visible, redes sociales, formulario, WhatsApp).
- Puntúa de 0 a 100 la OPORTUNIDAD para venderle este servicio: "${servicio}". Más puntaje = más lo necesita.
- Clasifica "tipo_lead" en exactamente uno de: "Oportunidad caliente" (activo, con WhatsApp/email visible, sin automatización), "Reactivar" (parece cliente antiguo o cuenta inactiva/solo Instagram), "Nuevo" (sin evidencia previa).
- Lista 2-3 "problemas" concretos detectados (frases cortas, reales).
- El primer elemento de "problemas" debe servir como gancho de venta.

Devuelve EXCLUSIVAMENTE un array JSON válido (sin texto antes ni después, sin markdown) con este formato exacto por elemento:
{"nombre":"","ciudad":"","region":"","web":"","telefono":"","whatsapp":"","email":"","instagram":"","score":0,"nivel":"Alta|Media|Baja","problemas":["",""],"tipo_lead":"Oportunidad caliente|Reactivar|Nuevo"}

No incluyas franquicias grandes con CRM corporativo salvo que no encuentres suficientes. Prioriza negocios con email o WhatsApp visible. Ordena de mayor a menor score.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY no configurado en el proyecto" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth admin (mismo patrón que send-n8n-webhook) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: se requiere rol admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Payload ---
    const body = await req.json();
    const nicho = (body?.nicho ?? "").toString().trim();
    const ciudad = (body?.ciudad ?? "").toString().trim();
    const servicio = (body?.servicio ?? "CRM inmobiliario con captación de leads y automatización de WhatsApp").toString().trim();
    let cantidad = parseInt(body?.cantidad, 10);
    if (!Number.isFinite(cantidad)) cantidad = 15;
    cantidad = Math.min(Math.max(cantidad, 5), 30);

    if (!nicho || !ciudad) {
      return new Response(JSON.stringify({ error: "Faltan 'nicho' y/o 'ciudad'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Llamada a Perplexity Sonar (búsqueda web + análisis en una sola llamada) ---
    const pplxRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Eres un prospector experto que responde EXCLUSIVAMENTE con un array JSON válido (sin markdown, sin texto antes ni después). Solo usas datos reales verificados con la búsqueda web; nunca inventas negocios, teléfonos, webs ni correos." },
          { role: "user", content: buildPrompt(nicho, ciudad, servicio, cantidad) },
        ],
      }),
      signal: AbortSignal.timeout(230000),
    });

    const data = await pplxRes.json();
    if (!pplxRes.ok) {
      const msg = data?.error?.message || data?.error || `HTTP ${pplxRes.status}`;
      return new Response(JSON.stringify({ error: `Perplexity API: ${msg}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Respuesta OpenAI-compatible: choices[0].message.content.
    const text = (data?.choices?.[0]?.message?.content ?? "").toString();

    const leads = extractFirstJsonArray(text) ?? [];
    if (leads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Perplexity no devolvió un dataset parseable", leads: [], raw: text.slice(0, 2000) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, count: leads.length, leads }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("buscar-leads error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

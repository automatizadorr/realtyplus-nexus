// Buscador de leads (prospección) con Perplexity Sonar (búsqueda web nativa).
// Fusiona la skill "prospeccion" (kit-prospeccion) con el CRM Nexus:
//  - busca negocios reales de un nicho+ciudad y analiza su presencia digital
//  - puntúa la oportunidad y clasifica el tipo de lead
//  - genera material de venta LISTO (propuesta de valor + mensajes WhatsApp/email)
//  - calcula estadísticas del nicho (% sin web, con email, score promedio...)
//  - DEDUPLICA contra el historial del usuario (no vuelve a proponer contactados)
//  - PERSISTE la búsqueda y los prospectos (historial reabrible + mini-CRM)
// Requiere caller admin (has_role) y el secreto PERPLEXITY_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sonar Pro: búsqueda web con más contexto (mejor para extraer datos de contacto).
const MODEL = "sonar-pro";

type Lead = {
  id?: string;
  nombre?: string; ciudad?: string; region?: string; web?: string;
  telefono?: string; whatsapp?: string; email?: string; instagram?: string;
  direccion?: string; google_maps?: string; fuente?: string;
  score?: number; nivel?: string; tipo_lead?: string; problemas?: string[];
  propuesta_valor?: string; mensaje_whatsapp?: string; mensaje_email?: string;
  repetido?: boolean;
};

// Extrae los objetos JSON ({...}) del primer array [{...}] de la respuesta.
// TOLERANTE a fallos comunes de los LLM de búsqueda (Perplexity):
//  - texto/prosa, ```json fences o citas [1][2] antes/después del array
//  - TRUNCACIÓN: si la respuesta se cortó por max_tokens y el array quedó a
//    medias, rescata todos los objetos que SÍ alcanzaron a cerrarse (en vez de
//    perder los 15-30 leads por un único objeto incompleto al final).
// Nota: solo trata la comilla doble como delimitador (JSON válido). Los apóstrofos
// (p. ej. región "O'Higgins") van dentro de strings dobles y no rompen el parseo.
function extractLeadObjects(text: string): Record<string, unknown>[] {
  const startArr = text.search(/\[\s*\{/);
  if (startArr === -1) return [];
  const objs: Record<string, unknown>[] = [];
  let depth = 0, objStart = -1, inStr = false, esc = false;
  for (let i = startArr; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) objStart = i; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { objs.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* objeto corrupto, se ignora */ }
        objStart = -1;
      }
    } else if (c === "]" && depth === 0) {
      break; // fin del array de nivel superior
    }
  }
  return objs;
}

function dedupKey(l: Lead): string {
  return `${(l.nombre ?? "").trim().toLowerCase()}|${(l.ciudad ?? "").trim().toLowerCase()}`;
}

function buildPrompt(nicho: string, ciudad: string, servicio: string, cantidad: number, evitar: string[], soloWhatsapp = false): string {
  const evitarTxt = evitar.length
    ? `\n\nNO incluyas estos negocios (ya fueron prospectados): ${evitar.slice(0, 60).join("; ")}.`
    : "";
  const waTxt = soloWhatsapp
    ? `\n\nFILTRO OBLIGATORIO: incluye ÚNICAMENTE negocios que tengan un número de teléfono o WhatsApp visible y verificable en internet. Si no encuentras un número para un negocio, descártalo y busca otro. Los campos "telefono" y/o "whatsapp" NO pueden quedar vacíos en ningún resultado.`
    : "";
  return `Eres un prospector experto. Busca en internet ${cantidad} negocios REALES del rubro "${nicho}" ubicados en "${ciudad}" (Chile salvo que la ciudad indique otro país).${waTxt}

REGLA FUNDAMENTAL: solo datos reales y verificados con la búsqueda web. Nunca inventes negocios, teléfonos, webs ni correos. Si un dato no lo encuentras, déjalo como cadena vacía "".

Para cada negocio, con la información pública que encuentres:
- Analiza su presencia digital (si tiene web, HTTPS, si se ve moderna o antigua, si tiene CRM/automatización visible, redes sociales, formulario, WhatsApp).
- Puntúa de 0 a 100 la OPORTUNIDAD para venderle este servicio: "${servicio}". Más puntaje = más lo necesita.
- Clasifica "tipo_lead" en exactamente uno de: "Oportunidad caliente" (activo, con WhatsApp/email visible, sin automatización), "Reactivar" (parece cliente antiguo o cuenta inactiva/solo Instagram), "Nuevo" (sin evidencia previa), "Descartar" (franquicia con CRM corporativo).
- Lista 2-3 "problemas" concretos detectados (frases cortas, reales). El primero debe servir como gancho de venta.
- "fuente": dónde encontraste el negocio (p. ej. "Google Business", "directorio", "Instagram", "web propia").
- "propuesta_valor": 1 frase de cómo "${servicio}" resuelve su principal problema (concreta, con el dato real detectado).
- "mensaje_whatsapp": mensaje breve (3-4 líneas) de primer contacto por WhatsApp, personalizado con el nombre del negocio y el problema real. Tono cercano, sin presión, con una pregunta o CTA suave al final. NO menciones precios.
- "mensaje_email": versión email (5-6 líneas máximo) del mismo mensaje, un poco más formal. NO menciones precios.

Devuelve EXCLUSIVAMENTE un array JSON válido (sin texto antes ni después, sin markdown) con este formato exacto por elemento:
{"nombre":"","ciudad":"","region":"","web":"","telefono":"","whatsapp":"","email":"","instagram":"","direccion":"","google_maps":"","fuente":"","score":0,"nivel":"Alta|Media|Baja","tipo_lead":"Oportunidad caliente|Reactivar|Nuevo|Descartar","problemas":["",""],"propuesta_valor":"","mensaje_whatsapp":"","mensaje_email":""}

No incluyas franquicias grandes con CRM corporativo salvo que no encuentres suficientes (si las incluyes, márcalas tipo_lead "Descartar"). Prioriza negocios con email o WhatsApp visible. Ordena de mayor a menor score.${evitarTxt}`;
}

// Estadísticas agregadas del nicho para el panel de resumen.
function computeStats(leads: Lead[]) {
  const n = leads.length || 1;
  const pct = (c: number) => Math.round((c / n) * 100);
  const scores = leads.map((l) => (typeof l.score === "number" ? l.score : 0));
  const conEmail = leads.filter((l) => (l.email ?? "").trim()).length;
  const conWhatsapp = leads.filter((l) => (l.whatsapp ?? "").trim() || (l.telefono ?? "").trim()).length;
  const dist: Record<string, number> = {};
  for (const l of leads) {
    const t = (l.tipo_lead ?? "Nuevo").trim() || "Nuevo";
    dist[t] = (dist[t] ?? 0) + 1;
  }
  return {
    total: leads.length,
    con_email: conEmail,
    con_whatsapp: conWhatsapp,
    sin_web_pct: pct(leads.filter((l) => !(l.web ?? "").trim()).length),
    sin_email_pct: pct(leads.filter((l) => !(l.email ?? "").trim()).length),
    con_instagram_pct: pct(leads.filter((l) => (l.instagram ?? "").trim()).length),
    score_promedio: Math.round(scores.reduce((a, b) => a + b, 0) / n),
    distribucion_tipo: dist,
  };
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
    const userId = userData.user.id;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userId, _role: "admin" });
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
    const excluirRepetidos = body?.excluir_repetidos !== false; // default: true
    const soloWhatsapp = body?.solo_whatsapp === true;
    let cantidad = parseInt(body?.cantidad, 10);
    if (!Number.isFinite(cantidad)) cantidad = 15;
    cantidad = Math.min(Math.max(cantidad, 5), 30);

    if (!nicho || !ciudad) {
      return new Response(JSON.stringify({ error: "Faltan 'nicho' y/o 'ciudad'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Historial previo del usuario (para dedup, para no repetir en el prompt y
    // para devolver el id de los repetidos ya guardados) ---
    const { data: previos } = await svc
      .from("prospeccion_leads")
      .select("dedup_key, id, nombre")
      .eq("creado_por", userId);
    const clavesPrevias = new Set((previos ?? []).map((r: { dedup_key: string }) => r.dedup_key));
    const idPrevios = new Map<string, string>();
    for (const r of (previos ?? []) as { dedup_key: string; id: string }[]) {
      if (r.dedup_key) idPrevios.set(r.dedup_key, r.id);
    }
    const nombresPrevios = (previos ?? [])
      .map((r: { nombre?: string }) => (r.nombre ?? "").trim())
      .filter(Boolean);

    // --- Llamada a Perplexity Sonar (búsqueda web + análisis en una sola llamada) ---
    // El tope de tokens de salida se ESCALA con la cantidad: cada lead lleva
    // propuesta + mensaje WhatsApp + mensaje email + problemas (~450-600 tokens).
    // Con 8000 fijos el JSON se truncaba a mitad para 15-30 leads → "no parseable".
    const maxTokens = Math.min(3000 + cantidad * 600, 24000); // 15→12k, 30→21k
    const pplxRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Eres un prospector experto que responde EXCLUSIVAMENTE con un array JSON válido (sin markdown, sin texto antes ni después). Solo usas datos reales verificados con la búsqueda web; nunca inventas negocios, teléfonos, webs ni correos." },
          { role: "user", content: buildPrompt(nicho, ciudad, servicio, cantidad, nombresPrevios, soloWhatsapp) },
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
    const finishReason = (data?.choices?.[0]?.finish_reason ?? "").toString();
    let parsed = extractLeadObjects(text) as Lead[];
    if (parsed.length === 0) {
      // finish_reason "length" = la respuesta se cortó por tokens (subir cantidad/tokens).
      const trunc = finishReason === "length";
      const msg = trunc
        ? "Perplexity cortó la respuesta por longitud antes de devolver leads. Reduce la cantidad e inténtalo de nuevo."
        : "Perplexity no devolvió un dataset parseable";
      console.error("buscar-leads parse-empty:", { finishReason, textPreview: text.slice(0, 300) });
      return new Response(JSON.stringify({ success: false, error: msg, leads: [], finish_reason: finishReason, raw: text.slice(0, 2000) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtro de respaldo: si el usuario pidió solo WhatsApp, descartar los que no tienen
    // teléfono/whatsapp aunque Perplexity los haya incluido igualmente.
    if (soloWhatsapp) {
      parsed = parsed.filter((l) => (l.telefono ?? "").toString().trim() || (l.whatsapp ?? "").toString().trim());
    }

    // --- Deduplicación contra el historial ---
    // Los repetidos ya guardados llevan su id real (mini-CRM editable desde el primer momento).
    const marcados: Lead[] = parsed.map((l) => {
      const k = dedupKey(l);
      const copy: Lead = { ...l, repetido: clavesPrevias.has(k) };
      const prevId = idPrevios.get(k);
      if (prevId) copy.id = prevId;
      return copy;
    });
    const nuevos = marcados.filter((l) => !l.repetido);
    const visibles = excluirRepetidos ? nuevos : marcados;
    const stats = computeStats(visibles);

    // --- Persistir la búsqueda (cabecera) ---
    const { data: busq, error: busqErr } = await svc
      .from("prospeccion_busquedas")
      .insert({
        creado_por: userId,
        nicho, ciudad, servicio,
        cantidad_solicitada: cantidad,
        cantidad_encontrada: marcados.length,
        nuevos: nuevos.length,
        repetidos: marcados.length - nuevos.length,
        estadisticas: stats,
      })
      .select("id")
      .single();

    let busquedaId: string | null = null;
    if (!busqErr && busq) {
      busquedaId = busq.id;
      // Insertar solo los nuevos (dedup global por índice único). onConflict ignora choques.
      const rows = nuevos.map((l) => ({
        busqueda_id: busquedaId,
        creado_por: userId,
        nombre: l.nombre ?? "", ciudad: l.ciudad ?? "", region: l.region ?? "",
        web: l.web ?? "", telefono: l.telefono ?? "", whatsapp: l.whatsapp ?? "",
        email: l.email ?? "", instagram: l.instagram ?? "", direccion: l.direccion ?? "",
        google_maps: l.google_maps ?? "", fuente: l.fuente ?? "",
        score: typeof l.score === "number" ? l.score : null,
        nivel: l.nivel ?? "", tipo_lead: l.tipo_lead ?? "Nuevo",
        problemas: Array.isArray(l.problemas) ? l.problemas : [],
        propuesta_valor: l.propuesta_valor ?? "",
        mensaje_whatsapp: l.mensaje_whatsapp ?? "",
        mensaje_email: l.mensaje_email ?? "",
      }));
      if (rows.length) {
        const { data: inserted, error: insErr } = await svc
          .from("prospeccion_leads")
          .insert(rows)
          .select("id, dedup_key");
        if (insErr) {
          console.error("buscar-leads insert error:", insErr.message);
        } else if (inserted) {
          // Devolvemos los ids para que el mini-CRM (estado/notas) funcione de inmediato.
          const idByKey = new Map<string, string>();
          for (const r of inserted as { id: string; dedup_key: string }[]) {
            if (r.dedup_key) idByKey.set(r.dedup_key, r.id);
          }
          for (const l of visibles) {
            if (!l.id) {
              const id = idByKey.get(dedupKey(l));
              if (id) l.id = id;
            }
          }
        }
      }
    } else if (busqErr) {
      console.error("buscar-leads persist error:", busqErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      busqueda_id: busquedaId,
      count: visibles.length,
      nuevos: nuevos.length,
      repetidos: marcados.length - nuevos.length,
      stats,
      leads: visibles,
    }), {
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

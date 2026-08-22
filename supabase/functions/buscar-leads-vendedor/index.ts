// Buscador de leads (prospección) para el VENDEDOR, con el mismo historial y
// mini-CRM que "Buscar Leads" del admin (prospeccion_busquedas/prospeccion_leads),
// pero con un motor gratuito en vez de Perplexity (de pago):
//   1) SerpApi (engine=google_maps) busca negocios REALES del nicho+ciudad y
//      trae datos estructurados de Google Maps (nombre, dirección, teléfono,
//      rating, reseñas) — sin que un LLM tenga que "navegar" ni inventar nada.
//   2) Un modelo NVIDIA NIM (gratis, build.nvidia.com) SOLO agrega el scoring
//      y redacta los mensajes de contacto sobre esos datos ya verificados —
//      nunca inventa nombre/teléfono/dirección (se copian tal cual de SerpApi).
// Requiere rol vendedor activo y los secretos SERPAPI_KEY + NVIDIA_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

type Negocio = {
  idx: number;
  nombre: string; direccion?: string; telefono?: string; web?: string;
  rating?: number; reviews?: number; categoria?: string; google_maps?: string;
};

type Lead = Negocio & {
  id?: string; ciudad?: string;
  score?: number; nivel?: string; tipo_lead?: string; problemas?: string[];
  propuesta_valor?: string; mensaje_whatsapp?: string; mensaje_email?: string;
  repetido?: boolean;
};

function dedupKey(nombre: string, ciudad: string): string {
  return `${(nombre ?? "").trim().toLowerCase()}|${(ciudad ?? "").trim().toLowerCase()}`;
}

// Extrae el primer array JSON [{...}] de la respuesta del modelo, tolerante a
// prosa/markdown/truncación (mismo patrón que buscar-leads con Perplexity).
function extractJsonArray(text: string): Record<string, unknown>[] {
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
    } else if (c === "]" && depth === 0) break;
  }
  return objs;
}

function buildPrompt(negocios: Negocio[], servicio: string): string {
  return `Te paso ${negocios.length} negocios REALES (datos verificados de Google Maps: nombre, dirección, teléfono, rating, reseñas). NO inventes ni cambies esos datos — cópialos EXACTOS, incluido "idx".

Para cada uno, agrega estos campos (en español):
- "score": 0-100, qué tan buena oportunidad es para ofrecerle "${servicio}" (más reseñas/rating + poca o ninguna presencia web = más oportunidad de digitalizarlo; usa criterio, no inventes cifras que no tengas).
- "nivel": exactamente "Alta", "Media" o "Baja".
- "tipo_lead": exactamente uno de "Oportunidad caliente", "Reactivar", "Nuevo", "Descartar".
- "problemas": 2-3 frases cortas y realistas sobre lo que le falta digitalmente, basadas SOLO en los datos que tienes (ej. si no tiene web, si tiene pocas reseñas). El primero sirve de gancho de venta.
- "propuesta_valor": 1 frase concreta de cómo "${servicio}" ayuda a este negocio puntual.
- "mensaje_whatsapp": mensaje de primer contacto (3-4 líneas), personalizado con su nombre real, tono cercano y humano (no te presentes como IA), SIN mencionar precios, SIN inventar cifras/porcentajes/ROI/resultados garantizados, con una pregunta o invitación suave a conversar al final.
- "mensaje_email": versión email (5-6 líneas), mismo tono, sin precios, sin cifras inventadas.

Devuelve EXCLUSIVAMENTE un array JSON válido (sin markdown, sin texto antes ni después) con los ${negocios.length} negocios, en el MISMO orden, sin quitar ni agregar ninguno.

Negocios:
${JSON.stringify(negocios)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");

    if (!SERPAPI_KEY) {
      return new Response(JSON.stringify({ error: "SERPAPI_KEY no configurado en el proyecto" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!NVIDIA_API_KEY) {
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY no configurado en el proyecto" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: vendedor activo (o admin) ---
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
      const { data: isVendedor } = await svc.rpc("has_role", { _user_id: userId, _role: "vendedor" });
      const { data: activo } = await svc.rpc("vendedor_activo", { _user_id: userId });
      if (!isVendedor || !activo) {
        return new Response(JSON.stringify({ error: "Forbidden: se requiere rol vendedor activo" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Payload ---
    const body = await req.json();
    const nicho = (body?.nicho ?? "").toString().trim();
    const ciudad = (body?.ciudad ?? "").toString().trim();
    const servicio = (body?.servicio ?? "un servicio para hacer crecer su negocio con tecnología e inteligencia artificial").toString().trim();
    const excluirRepetidos = body?.excluir_repetidos !== false;

    let cantidad = parseInt(body?.cantidad, 10);
    if (!Number.isFinite(cantidad)) cantidad = 15;
    cantidad = Math.min(Math.max(cantidad, 5), 30);

    if (!nicho || !ciudad) {
      return new Response(JSON.stringify({ error: "Faltan 'nicho' y/o 'ciudad'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Historial previo del usuario (dedup) ---
    const { data: previos } = await svc
      .from("prospeccion_leads")
      .select("dedup_key, id")
      .eq("creado_por", userId);
    const clavesPrevias = new Set((previos ?? []).map((r: { dedup_key: string }) => r.dedup_key));
    const idPrevios = new Map<string, string>();
    for (const r of (previos ?? []) as { dedup_key: string; id: string }[]) {
      if (r.dedup_key) idPrevios.set(r.dedup_key, r.id);
    }

    // --- 1) SerpApi: Google Maps, datos estructurados reales ---
    const negocios: Negocio[] = [];
    const vistos = new Set<string>();
    let start = 0;
    // Pagina hasta juntar suficientes candidatos nuevos (máx 3 páginas ~60 resultados).
    for (let pagina = 0; pagina < 3 && negocios.length < cantidad * 2; pagina++) {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_maps");
      url.searchParams.set("type", "search");
      url.searchParams.set("q", `${nicho} en ${ciudad}`);
      url.searchParams.set("hl", "es");
      url.searchParams.set("api_key", SERPAPI_KEY);
      if (start > 0) url.searchParams.set("start", String(start));

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        return new Response(JSON.stringify({ error: `SerpApi: ${msg}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const results: Record<string, unknown>[] = Array.isArray(data?.local_results) ? data.local_results : [];
      if (results.length === 0) break;
      for (const r of results) {
        const nombre = (r.title as string ?? "").trim();
        if (!nombre) continue;
        const key = dedupKey(nombre, ciudad);
        if (vistos.has(key)) continue;
        vistos.add(key);
        negocios.push({
          idx: negocios.length,
          nombre,
          direccion: (r.address as string) ?? "",
          telefono: (r.phone as string) ?? "",
          web: (r.website as string) ?? "",
          rating: typeof r.rating === "number" ? r.rating : undefined,
          reviews: typeof r.reviews === "number" ? r.reviews : undefined,
          categoria: (r.type as string) ?? "",
          google_maps: (r.place_id as string) ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : "",
        });
      }
      start += 20;
    }

    if (negocios.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "SerpApi no encontró negocios para ese rubro/ciudad. Prueba con otro término.", leads: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca repetidos contra el historial ANTES de gastar tokens de NVIDIA en ellos.
    const marcadosPrevios = negocios.map((n) => ({ ...n, repetido: clavesPrevias.has(dedupKey(n.nombre, ciudad)) }));
    const nuevosCandidatos = (excluirRepetidos ? marcadosPrevios.filter((n) => !n.repetido) : marcadosPrevios).slice(0, cantidad);
    const aProcesar = nuevosCandidatos.filter((n) => !n.repetido);

    // --- 2) NVIDIA NIM: scoring + mensajes SOLO sobre los negocios nuevos ---
    let enriquecidos: Record<string, unknown>[] = [];
    if (aProcesar.length > 0) {
      const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          temperature: 0.3,
          max_tokens: Math.min(2000 + aProcesar.length * 500, 16000),
          messages: [
            { role: "system", content: "Eres un experto en prospección B2B para el sector inmobiliario. Respondes EXCLUSIVAMENTE con un array JSON válido (sin markdown, sin texto antes ni después). Nunca inventas datos de contacto; solo copias los que te dan." },
            { role: "user", content: buildPrompt(aProcesar, servicio) },
          ],
        }),
        signal: AbortSignal.timeout(120000),
      });
      const nvData = await nvRes.json().catch(() => ({}));
      if (!nvRes.ok) {
        const msg = nvData?.error?.message || nvData?.error || `HTTP ${nvRes.status}`;
        return new Response(JSON.stringify({ error: `NVIDIA API: ${msg}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = (nvData?.choices?.[0]?.message?.content ?? "").toString();
      enriquecidos = extractJsonArray(text);
    }
    const porIdx = new Map<number, Record<string, unknown>>();
    for (const e of enriquecidos) {
      const idx = typeof e.idx === "number" ? e.idx : Number(e.idx);
      if (Number.isFinite(idx)) porIdx.set(idx, e);
    }

    const marcados: Lead[] = nuevosCandidatos.map((n) => {
      const e = porIdx.get(n.idx) ?? {};
      const prevId = idPrevios.get(dedupKey(n.nombre, ciudad));
      return {
        ...n,
        ciudad,
        id: prevId,
        score: typeof e.score === "number" ? e.score : undefined,
        nivel: (e.nivel as string) ?? "",
        tipo_lead: (e.tipo_lead as string) ?? "Nuevo",
        problemas: Array.isArray(e.problemas) ? (e.problemas as string[]) : [],
        propuesta_valor: (e.propuesta_valor as string) ?? "",
        mensaje_whatsapp: (e.mensaje_whatsapp as string) ?? "",
        mensaje_email: (e.mensaje_email as string) ?? "",
      };
    });

    const nuevos = marcados.filter((l) => !l.repetido);
    const stats = {
      total: marcados.length,
      con_email: 0,
      con_whatsapp: nuevos.filter((l) => (l.telefono ?? "").trim()).length,
      sin_web_pct: Math.round((nuevos.filter((l) => !(l.web ?? "").trim()).length / (nuevos.length || 1)) * 100),
      sin_email_pct: 100,
      con_instagram_pct: 0,
      score_promedio: Math.round(nuevos.reduce((a, l) => a + (l.score ?? 0), 0) / (nuevos.length || 1)),
      distribucion_tipo: nuevos.reduce((acc: Record<string, number>, l) => {
        const t = l.tipo_lead || "Nuevo";
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // --- Persistir (mismas tablas que el admin) ---
    const { data: busq, error: busqErr } = await svc
      .from("prospeccion_busquedas")
      .insert({
        creado_por: userId, nicho, ciudad, servicio,
        cantidad_solicitada: cantidad, cantidad_encontrada: marcados.length,
        nuevos: nuevos.length, repetidos: marcados.length - nuevos.length,
        estadisticas: stats, motor: "serpapi_nvidia",
      })
      .select("id").single();

    let busquedaId: string | null = null;
    if (!busqErr && busq) {
      busquedaId = busq.id;
      const rows = nuevos.map((l) => ({
        busqueda_id: busquedaId, creado_por: userId,
        nombre: l.nombre ?? "", ciudad, region: "",
        web: l.web ?? "", telefono: l.telefono ?? "", whatsapp: l.telefono ?? "",
        email: "", instagram: "", direccion: l.direccion ?? "",
        google_maps: l.google_maps ?? "", fuente: "Google Maps (SerpApi)",
        score: typeof l.score === "number" ? l.score : null,
        nivel: l.nivel ?? "", tipo_lead: l.tipo_lead ?? "Nuevo",
        problemas: l.problemas ?? [],
        propuesta_valor: l.propuesta_valor ?? "",
        mensaje_whatsapp: l.mensaje_whatsapp ?? "",
        mensaje_email: l.mensaje_email ?? "",
      }));
      if (rows.length) {
        const { data: inserted, error: insErr } = await svc
          .from("prospeccion_leads").insert(rows).select("id, dedup_key");
        if (insErr) {
          console.error("buscar-leads-vendedor insert error:", insErr.message);
        } else if (inserted) {
          const idByKey = new Map<string, string>();
          for (const r of inserted as { id: string; dedup_key: string }[]) if (r.dedup_key) idByKey.set(r.dedup_key, r.id);
          for (const l of marcados) if (!l.id) l.id = idByKey.get(dedupKey(l.nombre, ciudad));
        }
      }
    } else if (busqErr) {
      console.error("buscar-leads-vendedor persist error:", busqErr.message);
    }

    const visibles = excluirRepetidos ? nuevos : marcados;
    return new Response(JSON.stringify({
      success: true, busqueda_id: busquedaId,
      count: visibles.length, nuevos: nuevos.length, repetidos: marcados.length - nuevos.length,
      stats, leads: visibles,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("buscar-leads-vendedor error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Buscador de leads (prospección) para el VENDEDOR, con el mismo historial y
// mini-CRM que "Buscar Leads" del admin (prospeccion_busquedas/prospeccion_leads),
// pero con un motor gratuito en vez de Perplexity (de pago):
//   1) SerpApi (engine=google_maps) busca negocios REALES del nicho+ciudad y
//      trae datos estructurados de Google Maps (nombre, dirección, teléfono,
//      rating, reseñas) — sin que un LLM tenga que "navegar" ni inventar nada.
//   1b) Opcionalmente busca tambien perfiles de Instagram y paginas de
//      Facebook del mismo nicho/ciudad (SerpApi engine=google acotado con
//      site:). Esos leads casi nunca publican telefono, pero si dejan un
//      perfil con el que se puede abrir conversacion por DM.
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
  // Redes: solo se llenan cuando el negocio se encontro en Instagram/Facebook.
  instagram?: string; facebook?: string;
  /** De donde salio: "Google Maps (SerpApi)" | "Instagram" | "Facebook". */
  fuente?: string;
  /** Bio / descripcion del perfil, para que la IA tenga contexto real. */
  descripcion?: string;
};

type Lead = Negocio & {
  id?: string; ciudad?: string;
  score?: number; nivel?: string; tipo_lead?: string; problemas?: string[];
  propuesta_valor?: string; mensaje_whatsapp?: string; mensaje_email?: string;
  mensaje_instagram?: string;
  repetido?: boolean;
};

type Fuente = "maps" | "instagram" | "facebook";
const FUENTE_LABEL: Record<Fuente, string> = {
  maps: "Google Maps (SerpApi)", instagram: "Instagram", facebook: "Facebook",
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
- "mensaje_instagram": versión para mensaje directo de Instagram/Facebook (2-3 líneas, más informal y corta que la de WhatsApp, sin links, sin precios, terminando con una pregunta simple).

Devuelve EXCLUSIVAMENTE un array JSON válido (sin markdown, sin texto antes ni después) con los ${negocios.length} negocios, en el MISMO orden, sin quitar ni agregar ninguno.

Ten en cuenta que algunos negocios vienen de un perfil de Instagram/Facebook: de esos no hay teléfono ni dirección, solo el nombre, el handle y la descripción del perfil. NO inventes lo que falta — trabaja con lo que hay.

Negocios:
${JSON.stringify(negocios)}`;
}

// Enriquecimiento determinista, SIN LLM: se usa cuando NVIDIA falla, se cae o se
// pasa del presupuesto de tiempo. Solo mira datos reales de SerpApi (web, rating,
// reseñas, teléfono) — no inventa cifras ni datos de contacto.
function enriquecerFallback(n: Negocio, servicio: string): Record<string, unknown> {
  const sinWeb = !(n.web ?? "").trim();
  const reviews = typeof n.reviews === "number" ? n.reviews : 0;
  const rating = typeof n.rating === "number" ? n.rating : 0;
  let score = 45;
  if (sinWeb) score += 20;
  if (reviews > 0 && reviews < 30) score += 10;
  else if (reviews >= 30) score += 5;
  if (rating >= 4) score += 10;
  score = Math.max(0, Math.min(100, score));

  const problemas: string[] = [];
  if (sinWeb) problemas.push("No figura con sitio web propio en su ficha de Google Maps.");
  else problemas.push("Tiene web, pero no se ve captación ni seguimiento automático de contactos.");
  if (reviews === 0) problemas.push("No tiene reseñas visibles en Google Maps.");
  else problemas.push(`Tiene ${reviews} reseñas visibles${rating ? ` y ${rating} de valoración` : ""}.`);
  if (!(n.telefono ?? "").trim()) problemas.push("No publica teléfono de contacto en la ficha.");

  return {
    idx: n.idx,
    score,
    nivel: score >= 70 ? "Alta" : score >= 50 ? "Media" : "Baja",
    tipo_lead: score >= 70 ? "Oportunidad caliente" : "Nuevo",
    problemas,
    propuesta_valor: `${servicio} para que ${n.nombre} capte y responda a más contactos sin hacerlo todo a mano.`,
    mensaje_whatsapp: `Hola, ¿hablo con alguien de ${n.nombre}?
Les vi en Google Maps y me llamó la atención lo que hacen.
Trabajo con ${servicio} y creo que les puede encajar bien.
¿Te parece si te cuento en un par de minutos y me dices si te sirve?`,
    mensaje_email: `Hola,

Les escribo porque encontré a ${n.nombre} en Google Maps y me pareció que encajan con lo que hago.

Trabajo con ${servicio}, ayudando a negocios como el suyo a captar contactos y darles seguimiento sin que se pierda ninguno.

Si les interesa, les mando un ejemplo concreto pensado para ${n.nombre}.

¿Se los envío?

Un saludo.`,
    mensaje_instagram: `Hola, ¿cómo están? Los vi por acá y me gustó lo que hacen en ${n.nombre}.
Trabajo con ${servicio} y creo que les puede encajar.
¿Les cuento en dos minutos y me dicen si les sirve?`,
  };
}

// -------------------------------------------------------------------------
// Busqueda de perfiles en Instagram / Facebook.
//
// SerpApi no tiene un motor propio para estas redes, pero el buscador de
// Google acotado con `site:` devuelve los perfiles publicos del nicho en la
// ciudad. De ahi salen: nombre visible, handle y la descripcion del perfil —
// suficiente para escribir un DM con contexto real, sin inventar nada.
// -------------------------------------------------------------------------
function handleDesdeUrl(url: string, red: "instagram" | "facebook"): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes(red)) return null;
    const partes = u.pathname.split("/").filter(Boolean);
    if (partes.length === 0) return null;
    const handle = partes[0];
    // Rutas que no son perfiles.
    const reservadas = new Set([
      "p", "reel", "reels", "explore", "stories", "tv", "accounts", "directory",
      "watch", "groups", "events", "marketplace", "pages", "sharer", "photo", "media",
    ]);
    if (reservadas.has(handle.toLowerCase())) return null;
    if (!/^[A-Za-z0-9._-]{2,50}$/.test(handle)) return null;
    return handle;
  } catch {
    return null;
  }
}

async function buscarEnRed(
  apiKey: string, red: "instagram" | "facebook", nicho: string, ciudad: string, limite: number, timeoutMs: number,
): Promise<Negocio[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", `site:${red}.com ${nicho} ${ciudad}`);
  url.searchParams.set("hl", "es");
  url.searchParams.set("num", String(Math.min(Math.max(limite, 10), 20)));
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SerpApi ${red}: ${data?.error || `HTTP ${res.status}`}`);

  const organicos: Record<string, unknown>[] = Array.isArray(data?.organic_results) ? data.organic_results : [];
  const salida: Negocio[] = [];
  for (const r of organicos) {
    const link = (r.link as string) ?? "";
    const handle = handleDesdeUrl(link, red);
    if (!handle) continue;
    // El title de Google viene como "Nombre (@handle) • Instagram photos..."
    const titulo = ((r.title as string) ?? "").split(/[|•·]/)[0].replace(/\(@[^)]*\)/, "").trim();
    const nombre = titulo || handle;
    salida.push({
      idx: 0, // se reasigna al fusionar con el resto de las fuentes
      nombre,
      web: "",
      telefono: "",
      instagram: red === "instagram" ? handle : undefined,
      facebook: red === "facebook" ? handle : undefined,
      descripcion: ((r.snippet as string) ?? "").slice(0, 400),
      fuente: FUENTE_LABEL[red],
      google_maps: "",
    });
    if (salida.length >= limite) break;
  }
  return salida;
}

// Un lote chico (5 negocios) por llamada: el modelo gratuito tarda demasiado si
// tiene que escribir el JSON de 15+ leads de una sola vez (era la causa del
// "Signal timed out" que tumbaba la búsqueda entera).
async function enriquecerConNvidia(
  apiKey: string, lote: Negocio[], servicio: string, timeoutMs: number,
): Promise<Record<string, unknown>[]> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      temperature: 0.3,
      max_tokens: Math.min(600 + lote.length * 450, 4000),
      messages: [
        { role: "system", content: "Eres un experto en prospección B2B para el sector inmobiliario. Respondes EXCLUSIVAMENTE con un array JSON válido (sin markdown, sin texto antes ni después). Nunca inventas datos de contacto; solo copias los que te dan." },
        { role: "user", content: buildPrompt(lote, servicio) },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`NVIDIA API: ${msg}`);
  }
  return extractJsonArray((data?.choices?.[0]?.message?.content ?? "").toString());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Presupuesto de tiempo: la función tiene un límite de pared, así que SerpApi y
  // NVIDIA se acotan contra este reloj en vez de contra timeouts fijos y largos.
  const t0 = Date.now();

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

    // Fuentes elegidas por el vendedor. Sin nada valido se busca en Maps,
    // que es la que trae datos de contacto duros.
    const fuentesPedidas: Fuente[] = Array.isArray(body?.fuentes)
      ? (body.fuentes as unknown[]).filter((f): f is Fuente => f === "maps" || f === "instagram" || f === "facebook")
      : [];
    const fuentes: Fuente[] = fuentesPedidas.length ? fuentesPedidas : ["maps"];

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
    const avisosFuente: string[] = [];
    let start = 0;
    // Pagina hasta juntar suficientes candidatos nuevos (máx 3 páginas ~60 resultados).
    for (let pagina = 0; fuentes.includes("maps") && pagina < 3 && negocios.length < cantidad * 2 && Date.now() - t0 < 45000; pagina++) {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_maps");
      url.searchParams.set("type", "search");
      url.searchParams.set("q", `${nicho} en ${ciudad}`);
      url.searchParams.set("hl", "es");
      url.searchParams.set("api_key", SERPAPI_KEY);
      if (start > 0) url.searchParams.set("start", String(start));

      let res: Response;
      try {
        res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
      } catch (e) {
        // Timeout o corte de red: si ya juntamos negocios seguimos con lo que hay.
        const m = e instanceof Error ? e.message : String(e);
        console.error("buscar-leads-vendedor SerpApi fetch:", m);
        if (negocios.length > 0) break;
        // Con redes pedidas la busqueda sigue: Maps solo aporta una parte.
        if (fuentes.some((f) => f !== "maps")) { avisosFuente.push(`Google Maps no respondió (${m}).`); break; }
        return new Response(JSON.stringify({ error: `SerpApi no respondió a tiempo (${m}). Reintenta en unos segundos.` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        if (negocios.length > 0) break;
        if (fuentes.some((f) => f !== "maps")) { avisosFuente.push(`Google Maps: ${msg}.`); break; }
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
          fuente: FUENTE_LABEL.maps,
        });
      }
      start += 20;
    }

    // --- 1b) SerpApi: perfiles de Instagram / Facebook del mismo nicho ---
    // Van en paralelo entre si: son dos llamadas independientes y cortas.
    const redes = fuentes.filter((f): f is "instagram" | "facebook" => f !== "maps");
    if (redes.length > 0 && Date.now() - t0 < 60000) {
      // Si Maps no se pidio, las redes se reparten toda la cantidad solicitada.
      const porRed = Math.max(5, Math.ceil((fuentes.includes("maps") ? cantidad : cantidad * 2) / redes.length));
      const resultados = await Promise.allSettled(
        redes.map((red) => buscarEnRed(SERPAPI_KEY, red, nicho, ciudad, porRed, 20000)),
      );
      for (let i = 0; i < resultados.length; i++) {
        const r = resultados[i];
        if (r.status !== "fulfilled") {
          const m = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`buscar-leads-vendedor ${redes[i]}:`, m);
          avisosFuente.push(`${FUENTE_LABEL[redes[i]]} no devolvió resultados (${m}).`);
          continue;
        }
        for (const n of r.value) {
          const key = dedupKey(n.nombre, ciudad);
          if (vistos.has(key)) continue;
          vistos.add(key);
          negocios.push({ ...n, idx: negocios.length });
        }
      }
    }

    // Los idx se reasignan al final: son la clave con la que el modelo
    // devuelve cada negocio enriquecido, y las redes entraron después.
    for (let i = 0; i < negocios.length; i++) negocios[i].idx = i;

    if (negocios.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `No se encontraron negocios para ese rubro/ciudad en ${fuentes.map((f) => FUENTE_LABEL[f]).join(" ni ")}. Prueba con otro término o agrega otra fuente.`,
        leads: [],
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca repetidos contra el historial ANTES de gastar tokens de NVIDIA en ellos.
    const marcadosPrevios = negocios.map((n) => ({ ...n, repetido: clavesPrevias.has(dedupKey(n.nombre, ciudad)) }));
    const disponibles = excluirRepetidos ? marcadosPrevios.filter((n) => !n.repetido) : marcadosPrevios;
    // Intercala las fuentes antes de recortar a `cantidad`: Maps entra primero
    // y llena la lista, asi que sin esto los perfiles de Instagram/Facebook
    // quedarian siempre fuera del corte.
    const porFuente = new Map<string, Negocio[]>();
    for (const n of disponibles) {
      const k = n.fuente ?? FUENTE_LABEL.maps;
      if (!porFuente.has(k)) porFuente.set(k, []);
      porFuente.get(k)!.push(n);
    }
    const colas = [...porFuente.values()];
    const intercalados: typeof disponibles = [];
    for (let i = 0; intercalados.length < disponibles.length; i++) {
      let avanzo = false;
      for (const cola of colas) {
        if (i < cola.length) { intercalados.push(cola[i] as (typeof disponibles)[number]); avanzo = true; }
      }
      if (!avanzo) break;
    }
    const nuevosCandidatos = intercalados.slice(0, cantidad);
    const aProcesar = nuevosCandidatos.filter((n) => !n.repetido);

    // --- 2) NVIDIA NIM: scoring + mensajes SOLO sobre los negocios nuevos ---
    // En lotes chicos y en paralelo. Un lote que falle NO tumba la búsqueda: esos
    // negocios se completan con enriquecerFallback() y el usuario igual recibe
    // los datos de contacto reales de SerpApi.
    const LOTE = 5;
    const PRESUPUESTO_MS = 110000;
    const enriquecidos: Record<string, unknown>[] = [];
    if (aProcesar.length > 0) {
      const lotes: Negocio[][] = [];
      for (let i = 0; i < aProcesar.length; i += LOTE) lotes.push(aProcesar.slice(i, i + LOTE));
      const restanteMs = Math.max(10000, Math.min(50000, PRESUPUESTO_MS - (Date.now() - t0)));
      const resultados = await Promise.allSettled(
        lotes.map((l) => enriquecerConNvidia(NVIDIA_API_KEY, l, servicio, restanteMs)),
      );
      for (const r of resultados) {
        if (r.status === "fulfilled") enriquecidos.push(...r.value);
        else console.error("buscar-leads-vendedor lote NVIDIA falló:", r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }
    const porIdx = new Map<number, Record<string, unknown>>();
    for (const e of enriquecidos) {
      const idx = typeof e.idx === "number" ? e.idx : Number(e.idx);
      if (Number.isFinite(idx)) porIdx.set(idx, e);
    }
    // Todo lo que el modelo no devolvió (lote caído, JSON corrupto, negocio saltado)
    // se rellena con el enriquecimiento determinista.
    let conFallback = 0;
    for (const n of aProcesar) {
      if (!porIdx.has(n.idx)) { porIdx.set(n.idx, enriquecerFallback(n, servicio)); conFallback++; }
    }
    const aviso = [
      conFallback > 0
        ? `${conFallback} de ${aProcesar.length} leads se completaron sin IA (el modelo gratuito no alcanzó a responder). Los datos de contacto son igual de reales; solo el texto sugerido viene de plantilla.`
        : null,
      ...avisosFuente,
    ].filter(Boolean).join(" ");

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
        mensaje_instagram: (e.mensaje_instagram as string) ?? "",
      };
    });

    const nuevos = marcados.filter((l) => !l.repetido);
    const stats = {
      total: marcados.length,
      con_email: 0,
      con_whatsapp: nuevos.filter((l) => (l.telefono ?? "").trim()).length,
      sin_web_pct: Math.round((nuevos.filter((l) => !(l.web ?? "").trim()).length / (nuevos.length || 1)) * 100),
      sin_email_pct: 100,
      con_instagram_pct: Math.round((nuevos.filter((l) => (l.instagram ?? "").trim()).length / (nuevos.length || 1)) * 100),
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
        estadisticas: stats, motor: `serpapi_nvidia:${fuentes.join("+")}`,
      })
      .select("id").single();

    let busquedaId: string | null = null;
    if (!busqErr && busq) {
      busquedaId = busq.id;
      const rows = nuevos.map((l) => ({
        busqueda_id: busquedaId, creado_por: userId,
        nombre: l.nombre ?? "", ciudad, region: "",
        web: l.web ?? "", telefono: l.telefono ?? "", whatsapp: l.telefono ?? "",
        email: "", instagram: l.instagram ?? "", facebook: l.facebook ?? "",
        direccion: l.direccion ?? "",
        google_maps: l.google_maps ?? "", fuente: l.fuente ?? FUENTE_LABEL.maps,
        score: typeof l.score === "number" ? l.score : null,
        nivel: l.nivel ?? "", tipo_lead: l.tipo_lead ?? "Nuevo",
        problemas: l.problemas ?? [],
        propuesta_valor: l.propuesta_valor ?? "",
        mensaje_whatsapp: l.mensaje_whatsapp ?? "",
        mensaje_email: l.mensaje_email ?? "",
        mensaje_instagram: l.mensaje_instagram ?? "",
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
      stats, leads: visibles, aviso,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("buscar-leads-vendedor error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// CRON de CLASIFICACIÓN IA - WhatsApp Segmentado.
//
// Pensado para correr en AUTOMÁTICO una vez al día a las 06:00 de Madrid (DST-proof).
// 1. Busca leads con actividad reciente (mensajes en la ventana, default 24h).
// 2. Para cada uno arma la conversación y llama a `clasificar-whatsapp-ia` (DeepSeek),
//    que asigna UN segmento de 9 y lo aplica en la BD (vía tag-lead).
// 3. Postea UN LOTE al webhook n8n /etiquetas-leads-nuevos con, por cada lead:
//    { lead_id, nombre, telefono, etiqueta, resumen, mensajes }, listo para el nodo
//    "Separar Leads" → "Switch Etiqueta" del flujo segmentado.
//    EXCLUYE del envío los leads cuyo segmento sea "Sin Respuesta al Bot" (el lead no
//    respondió) o que tengan "Sigue en campaña" (estado_lead): siguen en campaña a la
//    espera de que el lead conteste, no se les manda WhatsApp de segmento.
//
// Auth: header X-Webhook-Secret (AUTO_TAG_CRON_SECRET o N8N_WEBHOOK_SECRET).
//
// Body (todos opcionales):
//   ventana_horas: number   ventana de actividad (default 24)
//   pais: string            filtra los leads por país (ej. "Chile")
//   dry_run: boolean        NO aplica etiquetas ni postea a n8n (solo devuelve el lote)
//   hora_madrid: number     guarda DST-proof: solo continúa si la hora local de Madrid coincide
//   max_leads / offset      paginación por LOTES (cada lead hace DeepSeek + tag-lead)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// URL del webhook del flujo n8n "Clasificacion IA - WhatsApp Segmentado". Configurable
// por env (N8N_CLASIFICACION_URL) por si cambia el path.
const N8N_CLASIFICACION_URL =
  Deno.env.get("N8N_CLASIFICACION_URL") ??
  "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/etiquetas-leads-nuevos";

// Etiquetas que NO se envían al webhook: el lead sigue en campaña, pendiente de que
// conteste. Situación 6 del protocolo = "Sigue en campaña" (el lead no respondió; el
// chat IA sigue activo reenviando plantillas). Las situaciones 1–5 (gestionadas) sí van.
const ETIQUETAS_NO_ENVIAR = ["Sigue en campaña", "Sin Respuesta al Bot"];

const norm = (s: unknown) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Núcleo de dígitos del teléfono (descarta sufijo JID @s.whatsapp.net).
const coreTel = (t: unknown) => (t ?? "").toString().split("@")[0].replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const CRON_SECRET = Deno.env.get("AUTO_TAG_CRON_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const incoming = req.headers.get("x-webhook-secret") ?? "";
    const authorized =
      (!!CRON_SECRET && incoming === CRON_SECRET) ||
      (!!WEBHOOK_SECRET && incoming === WEBHOOK_SECRET);
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const paisFiltro = (body?.pais ?? "").toString().trim();
    const VENTANA_HORAS = Number(body?.ventana_horas) > 0 ? Number(body.ventana_horas) : 24;
    const cutoff = new Date(Date.now() - VENTANA_HORAS * 3600 * 1000).toISOString();

    // Guarda de hora local (opcional): si se pasa hora_madrid, SOLO continúa cuando la
    // hora actual en Europe/Madrid coincide. Permite agendar el cron a 04:00 Y 05:00 UTC
    // y que dispare exactamente a las 06:00 de Madrid TODO el año (CEST/CET), una vez al
    // día. No aplica en dry_run.
    const horaMadrid =
      body?.hora_madrid !== undefined && body?.hora_madrid !== null && Number.isFinite(Number(body.hora_madrid))
        ? Math.floor(Number(body.hora_madrid)) : null;
    if (!dryRun && horaMadrid !== null) {
      const horaActual = Number(
        new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date())
      ) % 24;
      if (horaActual !== horaMadrid) {
        return json({ success: true, skipped: true, reason: `hora Madrid=${horaActual} ≠ objetivo ${horaMadrid}; no se clasifica en esta corrida` });
      }
    }

    // Paginación por LOTES para no exceder el límite de recursos de la Edge Function
    // (cada lead hace DeepSeek + tag-lead).
    const MAX_LEADS = Number(Deno.env.get("MAX_LEADS") ?? "50");
    const maxLeads = Number(body?.max_leads) > 0 ? Math.floor(Number(body.max_leads)) : MAX_LEADS;
    const offset = Number(body?.offset) > 0 ? Math.floor(Number(body.offset)) : 0;
    const HARD_CAP = 1000;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Teléfonos a procesar:
    //    - con `pais`: todos los leads (no archivados) de ese país.
    //    - sin `pais`: teléfonos con actividad reciente (WhatsApp + automatización).
    let telefonos: string[];
    if (paisFiltro) {
      const { data: porPais, error: paisErr } = await supabase
        .from("leads_campana")
        .select("telefono, archivado, pais")
        .ilike("pais", `%${paisFiltro}%`)
        .order("telefono", { ascending: true })
        .limit(HARD_CAP);
      if (paisErr) throw paisErr;
      telefonos = [...new Set((porPais ?? [])
        .filter((l) => l.archivado !== true)
        .map((l) => coreTel(l.telefono))
        .filter(Boolean))].slice(offset, offset + maxLeads);
    } else {
      const [waAct, autoAct] = await Promise.all([
        supabase.from("mensajes_whatsapp").select("telefono, created_at").gte("created_at", cutoff).order("created_at", { ascending: false }),
        supabase.from("mensajes_automatizacion").select("telefono, created_at").gte("created_at", cutoff).order("created_at", { ascending: false }),
      ]);
      if (waAct.error) throw waAct.error;
      telefonos = [...new Set([...(waAct.data ?? []), ...(autoAct.data ?? [])]
        .map((m) => coreTel(m.telefono)).filter(Boolean))]
        .slice(offset, offset + maxLeads);
    }

    // 2. Catálogo de etiquetas (service role → ignora RLS). Para resolver "Sigue en
    //    campaña" por id y excluir esos leads del envío.
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags").select("id, nombre");
    if (tagsErr) throw tagsErr;
    const idPorNombre = new Map<string, string>();
    for (const t of tags ?? []) idPorNombre.set(norm(t.nombre), t.id);
    const noEnviarIds = new Set(
      ETIQUETAS_NO_ENVIAR.map((n) => idPorNombre.get(norm(n))).filter(Boolean) as string[],
    );
    const noEnviarNorm = new Set(ETIQUETAS_NO_ENVIAR.map(norm));

    const resultados: Array<Record<string, unknown>> = [];

    for (const telefono of telefonos) {
      // 2a. Lead no archivado para este teléfono (acepta sufijo JID de WhatsApp).
      const { data: lead } = await supabase
        .from("leads_campana")
        .select("id, id_contacto, nombre, telefono, pais, email, archivado, tag_ids")
        .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
        .maybeSingle();
      if (!lead || lead.archivado === true) continue;

      // 2b. Conversación del lead (últimos 40 mensajes, en orden cronológico).
      const { data: msgs } = await supabase
        .from("mensajes_whatsapp")
        .select("contenido, direccion, created_at")
        .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
        .order("created_at", { ascending: false })
        .limit(40);
      const conversacion = (msgs ?? [])
        .slice()
        .reverse()
        .map((m) => ({
          rol: m.direccion === "inbound" ? "lead" : "agente",
          texto: (m.contenido ?? "").toString(),
        }))
        .filter((t) => t.texto.trim());
      if (conversacion.length === 0) continue;

      // 2c. Delegar en clasificar-whatsapp-ia: asigna el segmento y devuelve resumen.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/clasificar-whatsapp-ia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": WEBHOOK_SECRET,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({
            telefono,
            nombre: lead.nombre ?? "",
            conversacion,
            crear_si_no_existe: false,
            aplicar: !dryRun,
          }),
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json().catch(() => ({}));
        const segmento = (data?.segmento ?? "").toString();
        // Tags resultantes: tras aplicar (tag-lead las devuelve) o las actuales en dry-run.
        const tagIds: string[] = Array.isArray(data?.tag_ids)
          ? data.tag_ids
          : (Array.isArray(lead.tag_ids) ? lead.tag_ids : []);
        resultados.push({
          lead_id: lead.id_contacto ?? lead.id,
          nombre: lead.nombre ?? "",
          telefono,
          pais: lead.pais ?? "",
          etiqueta: segmento,
          resumen: (data?.resumen ?? "").toString(),
          mensajes: conversacion,
          tag_ids: tagIds,
          ok: res.ok && data?.success === true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultados.push({ lead_id: lead.id_contacto ?? lead.id, nombre: lead.nombre ?? "", telefono, pais: lead.pais ?? "", etiqueta: "", resumen: "", mensajes: conversacion, tag_ids: [], ok: false, error: msg });
      }
    }

    // 3. Filtrar qué leads se envían al webhook segmentado:
    //    - deben tener un segmento asignado,
    //    - EXCLUYENDO "Sin Respuesta al Bot" (segmento) y "Sigue en campaña" (estado),
    //      ya sea por el nombre del segmento o por estar en sus tag_ids.
    const excluido = (r: Record<string, unknown>) => {
      if (noEnviarNorm.has(norm(r.etiqueta))) return true;
      const ids = Array.isArray(r.tag_ids) ? (r.tag_ids as string[]) : [];
      return ids.some((id) => noEnviarIds.has(id));
    };

    const leads_a_enviar = resultados
      .filter((r) => (r.etiqueta as string)?.toString().trim() && !excluido(r))
      // El webhook solo necesita estos campos (el resto eran de control interno).
      .map((r) => ({
        lead_id: r.lead_id,
        nombre: r.nombre,
        telefono: r.telefono,
        etiqueta: r.etiqueta,
        resumen: r.resumen,
        mensajes: r.mensajes,
      }));

    const omitidos_sin_respuesta = resultados.filter((r) => excluido(r)).length;
    const omitidos_sin_segmento = resultados.filter((r) => !(r.etiqueta as string)?.toString().trim()).length;

    // 4. POST UN solo lote al webhook (salvo dry_run).
    let n8n_status = 0;
    let n8n_response = "";
    const payload = {
      evento: "cron_clasificacion_ia",
      timestamp: new Date().toISOString(),
      ventana_horas: VENTANA_HORAS,
      leads_clasificados: leads_a_enviar.length,
      leads: leads_a_enviar,
    };

    if (dryRun) {
      n8n_response = "dry_run: no se aplicaron etiquetas ni se posteó a n8n";
    } else if (leads_a_enviar.length > 0) {
      // Adjunta el Excel (misma lógica que TaggedExport) generado por
      // clasificacion-excel. Best-effort: si falla, el reporte se envía igual sin él.
      // Mapa teléfono(dígitos) → resumen IA de esta corrida, para añadir la columna
      // "Resumen IA" al Excel (el resumen no se persiste en BD, vive solo aquí).
      const resumenes: Record<string, string> = {};
      for (const r of resultados) {
        const tel = (r.telefono ?? "").toString();
        const res = (r.resumen ?? "").toString();
        if (tel && res) resumenes[tel] = res;
      }
      try {
        const exRes = await fetch(`${SUPABASE_URL}/functions/v1/clasificacion-excel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": WEBHOOK_SECRET ?? CRON_SECRET,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ ventana_horas: VENTANA_HORAS, pais: paisFiltro, resumenes }),
          signal: AbortSignal.timeout(40000),
        });
        const ex = await exRes.json().catch(() => ({}));
        if (exRes.ok && ex?.success && ex?.base64) {
          (payload as Record<string, unknown>).excel_base64 = ex.base64;
          (payload as Record<string, unknown>).excel_filename = ex.filename;
        }
      } catch (_e) { /* sigue sin Excel */ }

      try {
        const wh = await fetch(N8N_CLASIFICACION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(WEBHOOK_SECRET ? { "x-webhook-secret": WEBHOOK_SECRET } : {}) },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        });
        n8n_status = wh.status;
        n8n_response = await wh.text();
      } catch (e) {
        n8n_response = e instanceof Error ? e.message : String(e);
      }
    } else {
      n8n_response = "sin leads que enviar (todos sin segmento, 'Sin Respuesta al Bot' o 'Sigue en campaña')";
    }

    return json({
      success: true,
      ...(dryRun ? { dry_run: true } : {}),
      ...(paisFiltro ? { pais: paisFiltro } : {}),
      ventana_horas: VENTANA_HORAS,
      leads_candidatos: telefonos.length,
      leads_procesados: resultados.length,
      leads_enviados: leads_a_enviar.length,
      omitidos_sin_respuesta,
      omitidos_sin_segmento,
      n8n_status,
      n8n_response,
      ...(dryRun ? { leads_preview: leads_a_enviar } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-clasificacion-ia error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

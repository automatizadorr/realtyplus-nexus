// Envío CONSOLIDADO a n8n /expansion (reporte a jefatura), pensado para correr en
// AUTOMÁTICO cada 24h desde pg_cron. Junta los leads de la ventana (default 24h) por
// UNIÓN de dos criterios: (A) etiquetados/actualizados en la ventana (updated_at) y
// (B) con actividad de mensajes en la ventana. Arma UN solo payload agrupado por
// etiqueta con conversaciones y métricas (mismo formato que el botón "Enviar a n8n
// /expansion" de TaggedExport) y lo postea una sola vez. EXCLUYE "Sigue en campaña".
//
// Auth: header X-Webhook-Secret (AUTO_TAG_CRON_SECRET o N8N_WEBHOOK_SECRET).
//
// Body (todos opcionales):
//   ventana_horas: number   ventana de actividad a incluir (default 24)
//   pais: string            filtra los leads por país (ej. "Bolivia")
//   dry_run: boolean        NO postea a n8n; solo devuelve los conteos de lo que se enviaría
//
// Adjunto: llama a clasificacion-excel y añade excel_base64 + excel_filename al payload
// (el Code node de n8n los decodifica y adjunta el .xlsx; n8n no puede armar el xlsx solo).
//
// Respuesta: { success, ventana_horas, total_leads, total_mensajes, total_etiquetas, con_excel, n8n_status, n8n_response }
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

// URL del webhook en n8n que recibe el reporte diario consolidado (etiquetas +
// resumen de reactivación). Configurable por env; fallback = /auto-tag-chile.
const N8N_EXPANSION_URL =
  Deno.env.get("N8N_EXPANSION_URL") ??
  "https://n8n.lexhouse-ai.online/webhook/auto-tag-chile";

// Estado que NO va a expansión: el lead aún no contestó, sigue en campaña.
const ETIQUETA_NO_ENVIAR = "Sigue en campaña";

// Tope de leads por corrida (defensa ante ventanas anómalas; 24h debería ser mucho menos).
const MAX_LEADS = 400;

// Normaliza nombres de etiqueta para comparar (minúsculas, sin tildes).
const norm = (s: unknown) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Núcleo de dígitos del teléfono (descarta sufijo JID @s.whatsapp.net).
const coreTel = (t: unknown) => (t ?? "").toString().split("@")[0].replace(/\D/g, "");

// Timestamp numérico para ordenar; los sin fecha válida van al final.
const msgTime = (m: Record<string, unknown>) => {
  const t = m?.created_at ? new Date(String(m.created_at)).getTime() : NaN;
  return Number.isNaN(t) ? Infinity : t;
};

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

    // Guarda de hora local (opcional): si se pasa hora_madrid, la función SOLO continúa
    // cuando la hora actual en Europe/Madrid coincide. Permite agendar el cron a 06:00 Y
    // 07:00 UTC y que dispare exactamente a las 08:00 de Madrid TODO el año (a prueba de
    // horario de verano CEST/CET), sin enviar dos veces. No aplica en dry_run.
    const horaMadrid =
      body?.hora_madrid !== undefined && body?.hora_madrid !== null && Number.isFinite(Number(body.hora_madrid))
        ? Math.floor(Number(body.hora_madrid)) : null;
    if (!dryRun && horaMadrid !== null) {
      const horaActual = Number(
        new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date())
      ) % 24;
      if (horaActual !== horaMadrid) {
        return json({ success: true, skipped: true, reason: `hora Madrid=${horaActual} ≠ objetivo ${horaMadrid}; no se envía en esta corrida` });
      }
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Teléfonos con ACTIVIDAD en la ventana (WhatsApp + automatización).
    const [waAct, autoAct] = await Promise.all([
      supabase.from("mensajes_whatsapp").select("telefono, created_at").gte("created_at", cutoff),
      supabase.from("mensajes_automatizacion").select("telefono, created_at").gte("created_at", cutoff),
    ]);
    if (waAct.error) throw waAct.error;
    const activos = new Set<string>();
    for (const m of [...(waAct.data ?? []), ...(autoAct.data ?? [])]) {
      const c = coreTel(m.telefono);
      if (c) activos.add(c);
    }
    // (No se corta aquí aunque no haya actividad: el Set A —etiquetados/actualizados en
    //  la ventana— puede traer leads igual, por el criterio unión.)

    // 2. Catálogo de etiquetas (service role → ignora RLS).
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags").select("id, nombre, color, es_permanente");
    if (tagsErr) throw tagsErr;
    const tagMap = new Map<string, { nombre: string; color: string; es_permanente: boolean }>();
    for (const t of tags ?? []) tagMap.set(t.id, { nombre: t.nombre, color: t.color, es_permanente: !!t.es_permanente });
    const sigueId = (tags ?? []).find((t) => norm(t.nombre) === norm(ETIQUETA_NO_ENVIAR))?.id ?? null;

    // 3. Leads candidatos = UNIÓN de dos sets (etiquetados, no archivados, país opcional):
    //    A) ACTUALIZADOS en la ventana (updated_at >= cutoff): captura los etiquetados hoy
    //       aunque su conversación sea vieja (ej. backfills).
    //    B) Con ACTIVIDAD de mensajes en la ventana (teléfono en `activos`).
    //    Se excluye "Sigue en campaña". Consultar por estos dos criterios (en vez de traer
    //    TODOS los etiquetados) evita el tope de 1000 filas de PostgREST.
    const LEAD_COLS =
      "id, id_contacto, nombre, telefono, email, pais, estado, bot_activo, ha_respondido, archivado, ultimo_contacto_at, fecha_respuesta, fecha_proximo_contacto, origen, tag_ids";

    // Set A: etiquetados actualizados en la ventana.
    let qA = supabase.from("leads_campana").select(LEAD_COLS)
      .not("tag_ids", "is", null).neq("tag_ids", "{}").gte("updated_at", cutoff);
    if (paisFiltro) qA = qA.ilike("pais", `%${paisFiltro}%`);
    const { data: setA, error: aErr } = await qA;
    if (aErr) throw aErr;

    // Set B: etiquetados con actividad de mensajes en la ventana (por lotes de teléfonos).
    const activosArr = [...activos];
    const setB: Record<string, unknown>[] = [];
    for (let i = 0; i < activosArr.length; i += 40) {
      const batch = activosArr.slice(i, i + 40);
      const orFilter = batch.flatMap((p) => [`telefono.eq.${p}`, `telefono.like.${p}@%`]).join(",");
      let qB = supabase.from("leads_campana").select(LEAD_COLS)
        .not("tag_ids", "is", null).neq("tag_ids", "{}").or(orFilter);
      if (paisFiltro) qB = qB.ilike("pais", `%${paisFiltro}%`);
      const { data, error } = await qB;
      if (error) throw error;
      if (data) setB.push(...data);
    }

    // Unión por id + filtros finales (no archivados, fuera "Sigue en campaña").
    const byId = new Map<string, Record<string, unknown>>();
    for (const l of [...(setA ?? []), ...setB]) byId.set(l.id as string, l);
    const leads = [...byId.values()]
      .filter((l) => l.archivado !== true)
      .filter((l) => !(sigueId && Array.isArray(l.tag_ids) && (l.tag_ids as string[]).includes(sigueId)))
      .slice(0, MAX_LEADS);

    if (leads.length === 0) {
      if (dryRun) {
        return json({ success: true, dry_run: true, ventana_horas: VENTANA_HORAS, total_leads: 0, total_mensajes: 0, total_etiquetas: 0, n8n_status: 0, n8n_response: "dry_run: sin actividad en la ventana" });
      }
      // Sin leads: igual notificamos a n8n con aviso de sin actividad.
      const sinActividadPayload = {
        timestamp: new Date().toISOString(),
        evento: "auto_expansion_24h",
        ventana_horas: VENTANA_HORAS,
        filtro: paisFiltro || "todas",
        sin_actividad: true,
        total_leads: 0,
        total_mensajes: 0,
        total_etiquetas: 0,
        etiquetas: [],
        mensaje: `Sin leads gestionados con actividad en las últimas ${VENTANA_HORAS}h. Todos los leads activos siguen en campaña o sin clasificar.`,
      };
      const outSecret = Deno.env.get("N8N_WEBHOOK_SECRET") || Deno.env.get("AUTO_TAG_CRON_SECRET") || "";
      let n8n_status = 0; let n8n_response = "";
      try {
        const wh = await fetch(N8N_EXPANSION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-secret": outSecret },
          body: JSON.stringify(sinActividadPayload),
          signal: AbortSignal.timeout(30000),
        });
        n8n_status = wh.status;
        n8n_response = await wh.text();
      } catch (e) { n8n_response = e instanceof Error ? e.message : String(e); }
      return json({ success: true, sin_actividad: true, ventana_horas: VENTANA_HORAS, total_leads: 0, n8n_status, n8n_response });
    }

    // 4. Conversaciones de esos leads (WhatsApp + automatización), por lotes para no
    //    romper la URL. Dedup y orden cronológico por fecha real.
    const phones = [...new Set(leads.map((l) => coreTel(l.telefono)).filter(Boolean))];
    const fetchMsgs = async (table: "mensajes_whatsapp" | "mensajes_automatizacion") => {
      const out: Record<string, unknown>[] = [];
      const CHUNK = 40;
      for (let i = 0; i < phones.length; i += CHUNK) {
        const batch = phones.slice(i, i + CHUNK);
        const orFilter = batch.flatMap((p) => [`telefono.eq.${p}`, `telefono.like.${p}@%`]).join(",");
        const { data, error } = await supabase.from(table).select("*").or(orFilter);
        if (error) throw error;
        if (data) out.push(...data);
      }
      return out;
    };
    const [msgsWA, msgsAuto] = await Promise.all([fetchMsgs("mensajes_whatsapp"), fetchMsgs("mensajes_automatizacion")]);

    const all = [
      ...msgsWA.map((m) => ({ ...m, _canal: "WhatsApp" })),
      ...msgsAuto.map((m) => ({ ...m, _canal: (m as Record<string, unknown>).canal ?? "Auto" })),
    ] as Record<string, unknown>[];
    const seen = new Set<string>();
    const deduped = all.filter((m) => {
      const key = `${coreTel(m.telefono)}|${m.direccion}|${m.created_at ?? ""}|${(m.contenido ?? "").toString().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => msgTime(a) - msgTime(b));
    const msgsByPhone = new Map<string, Record<string, unknown>[]>();
    for (const l of leads) msgsByPhone.set(coreTel(l.telefono), []);
    for (const m of deduped) {
      const arr = msgsByPhone.get(coreTel(m.telefono));
      if (arr) arr.push(m);
    }
    const totalMsgs = [...msgsByPhone.values()].reduce((a, arr) => a + arr.length, 0);

    // 5. Agrupar por etiqueta y armar el payload (formato /expansion = TaggedExport).
    const byTag = new Map<string, Record<string, unknown>[]>();
    for (const l of leads) {
      for (const tid of (Array.isArray(l.tag_ids) ? l.tag_ids : [])) {
        if (tid === sigueId) continue; // no mostrar la sección "Sigue en campaña"
        if (!byTag.has(tid)) byTag.set(tid, []);
        byTag.get(tid)!.push(l);
      }
    }

    const orderedTagIds = [...byTag.keys()].sort((a, b) =>
      (tagMap.get(a)?.nombre ?? "").localeCompare(tagMap.get(b)?.nombre ?? "", "es"));

    const etiquetas = orderedTagIds.map((tid) => {
      const tInfo = tagMap.get(tid);
      const tLeads = byTag.get(tid) ?? [];
      const tResp = tLeads.filter((l) => l.ha_respondido).length;
      const tasaResp = tLeads.length ? Math.round((tResp / tLeads.length) * 100) : 0;
      const leadsPayload = tLeads.map((l) => {
        const msgs = msgsByPhone.get(coreTel(l.telefono)) ?? [];
        return {
          id_contacto: l.id_contacto ?? null,
          nombre: l.nombre ?? "",
          telefono: l.telefono ?? "",
          email: l.email ?? null,
          pais: l.pais ?? null,
          estado: l.estado ?? null,
          bot_activo: l.bot_activo ?? null,
          ha_respondido: l.ha_respondido ?? null,
          ultimo_contacto_at: l.ultimo_contacto_at ?? null,
          fecha_respuesta: l.fecha_respuesta ?? null,
          fecha_proximo_contacto: l.fecha_proximo_contacto ?? null,
          origen: l.origen ?? null,
          etiquetas: (Array.isArray(l.tag_ids) ? l.tag_ids : []).map((id: string) => tagMap.get(id)?.nombre ?? id),
          mensajes_enviados: msgs.filter((m) => m.direccion === "outbound").length,
          mensajes_recibidos: msgs.filter((m) => m.direccion === "inbound").length,
          total_mensajes: msgs.length,
          conversacion: msgs.map((m) => ({
            fecha: m.created_at ?? null,
            direccion: m.direccion ?? null,
            canal: m._canal ?? null,
            contenido: m.contenido ?? null,
            autor: m.autor ?? (m.direccion === "outbound" ? "Bot" : "Cliente"),
          })),
        };
      });
      return {
        id: tid,
        nombre: tInfo?.nombre ?? tid,
        color: tInfo?.color ?? "#64748b",
        es_permanente: !!tInfo?.es_permanente,
        total_leads: tLeads.length,
        respondieron: tResp,
        tasa_respuesta: tasaResp,
        leads: leadsPayload,
      };
    });

    const payload = {
      timestamp: new Date().toISOString(),
      evento: "auto_expansion_24h",
      ventana_horas: VENTANA_HORAS,
      filtro: paisFiltro || "todas",
      total_leads: leads.length,
      total_mensajes: totalMsgs,
      total_etiquetas: etiquetas.length,
      total_etiquetas_con_leads: byTag.size,
      etiquetas,
    };

    // 6. Postear UNA sola vez a /expansion (salvo dry_run).
    if (dryRun) {
      return json({
        success: true, dry_run: true, ventana_horas: VENTANA_HORAS,
        ...(paisFiltro ? { pais: paisFiltro } : {}),
        total_leads: leads.length, total_mensajes: totalMsgs, total_etiquetas: etiquetas.length,
        n8n_status: 0, n8n_response: "dry_run: no se posteó a n8n",
      });
    }

    // 5.b Adjuntar el Excel (.xlsx) con la MISMA lógica que TaggedExport, generado por la
    // Edge Function clasificacion-excel. El Code node de n8n NO puede construir el xlsx
    // (no trae SheetJS): solo decodifica este excel_base64 con prepareBinaryData. Es
    // best-effort: si falla, el reporte se envía igual sin adjunto.
    // ⚠️ clasificacion-excel arma su PROPIO set (misma ventana + país) e INCLUYE
    // "Sigue en campaña" (el Excel es revisión interna COMPLETA, igual que TaggedExport),
    // aunque las secciones del cuerpo del reporte sí lo excluyan.
    try {
      const exRes = await fetch(`${SUPABASE_URL}/functions/v1/clasificacion-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET ?? CRON_SECRET,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
        body: JSON.stringify({ ventana_horas: VENTANA_HORAS, ...(paisFiltro ? { pais: paisFiltro } : {}) }),
        signal: AbortSignal.timeout(40000),
      });
      const ex = await exRes.json().catch(() => ({}));
      if (exRes.ok && ex?.success && ex?.base64) {
        (payload as Record<string, unknown>).excel_base64 = ex.base64;
        (payload as Record<string, unknown>).excel_filename = ex.filename;
      }
    } catch (_e) { /* sigue sin Excel */ }

    const outgoingSecret = WEBHOOK_SECRET || CRON_SECRET || "";

    let n8n_status = 0;
    let n8n_response = "";
    let delivered = false;
    try {
      const wh = await fetch(N8N_EXPANSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": outgoingSecret },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      n8n_status = wh.status;
      n8n_response = await wh.text();
      delivered = wh.ok;
    } catch (e) {
      n8n_response = e instanceof Error ? e.message : String(e);
    }

    // success refleja la ENTREGA real: si n8n no confirma 2xx, no fue silencioso.
    return json({
      success: delivered,
      ventana_horas: VENTANA_HORAS,
      ...(paisFiltro ? { pais: paisFiltro } : {}),
      total_leads: leads.length,
      total_mensajes: totalMsgs,
      total_etiquetas: etiquetas.length,
      con_excel: !!(payload as Record<string, unknown>).excel_base64,
      n8n_url: N8N_EXPANSION_URL,
      n8n_status,
      n8n_response,
      ...(delivered
        ? {}
        : { warning: "n8n no confirmó 2xx: verifica que el workflow esté ACTIVO y que su N8N_WEBHOOK_SECRET coincida con el token" }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("enviar-expansion error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

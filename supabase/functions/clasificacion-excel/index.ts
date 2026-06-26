// Genera un Excel (.xlsx) de leads etiquetados con la MISMA LÓGICA que la
// exportación de reactivación (src/pages/TaggedExport.tsx → handleExcel): dos hojas
//   1) "Resumen Etiquetas": por etiqueta → Leads, Respondieron, Tasa %, Mensajes.
//   2) "Leads Etiquetados": una fila por lead con ~32 columnas + métricas de mensajes
//      (cruce WhatsApp + automatización, deduplicado y normalizado por dígitos).
//
// Pensada para que cron-clasificacion-ia la llame y adjunte el .xlsx (base64) al
// payload del webhook /etiquetas-leads-nuevos (reporte de expansión por correo).
//
// Alcance: leads ETIQUETADOS, no archivados, con actividad O actualizados en la
// ventana (default 24h). Incluye TODOS (también "Sigue en campaña"): el Excel es para
// revisión interna, igual que en TaggedExport.
//
// Auth: header X-Webhook-Secret (CRON_TOKEN embebido, AUTO_TAG_CRON_SECRET o N8N_WEBHOOK_SECRET).
// Body: { ventana_horas?: number, pais?: string }
// Respuesta: { success, filename, base64, total_leads, total_etiquetas }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

const CRON_TOKEN = "rpchile_cron_2026_a8K3mZqL";

// ── Helpers (réplica de TaggedExport) ───────────────────────
const normPhone = (t: unknown) => (t ?? "").toString().split("@")[0].replace(/\D/g, "");
const yesNo = (v: unknown) => (v === null || v === undefined ? "" : v ? "Sí" : "No");
const formatDate = (iso: unknown) => {
  if (!iso) return "";
  const d = new Date(String(iso));
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
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
      incoming === CRON_TOKEN ||
      (!!CRON_SECRET && incoming === CRON_SECRET) ||
      (!!WEBHOOK_SECRET && incoming === WEBHOOK_SECRET);
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const paisFiltro = (body?.pais ?? "").toString().trim();
    const VENTANA_HORAS = Number(body?.ventana_horas) > 0 ? Number(body.ventana_horas) : 24;
    const cutoff = new Date(Date.now() - VENTANA_HORAS * 3600 * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Teléfonos con actividad en la ventana (WhatsApp + automatización).
    const [waAct, autoAct] = await Promise.all([
      supabase.from("mensajes_whatsapp").select("telefono, created_at").gte("created_at", cutoff),
      supabase.from("mensajes_automatizacion").select("telefono, created_at").gte("created_at", cutoff),
    ]);
    if (waAct.error) throw waAct.error;
    const activos = new Set<string>();
    for (const m of [...(waAct.data ?? []), ...(autoAct.data ?? [])]) {
      const c = normPhone(m.telefono);
      if (c) activos.add(c);
    }

    // 2. Catálogo de etiquetas.
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags").select("id, nombre, color, es_permanente");
    if (tagsErr) throw tagsErr;
    const tagsFull = (tags ?? []) as Array<{ id: string; nombre: string; color: string; es_permanente: boolean }>;
    const tagMap = new Map(tagsFull.map((t) => [t.id, t]));

    // 3. Leads candidatos = etiquetados, no archivados, (actualizados en ventana) ∪
    //    (con actividad de mensajes en ventana). País opcional.
    const setA = await (async () => {
      let q = supabase.from("leads_campana").select("*")
        .not("tag_ids", "is", null).neq("tag_ids", "{}").gte("updated_at", cutoff);
      if (paisFiltro) q = q.ilike("pais", `%${paisFiltro}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    })();

    const activosArr = [...activos];
    const setB: Record<string, unknown>[] = [];
    for (let i = 0; i < activosArr.length; i += 40) {
      const batch = activosArr.slice(i, i + 40);
      const orFilter = batch.flatMap((p) => [`telefono.eq.${p}`, `telefono.like.${p}@%`]).join(",");
      let q = supabase.from("leads_campana").select("*")
        .not("tag_ids", "is", null).neq("tag_ids", "{}").or(orFilter);
      if (paisFiltro) q = q.ilike("pais", `%${paisFiltro}%`);
      const { data, error } = await q;
      if (error) throw error;
      if (data) setB.push(...data);
    }

    const byId = new Map<string, Record<string, unknown>>();
    for (const l of [...setA, ...setB]) byId.set(l.id as string, l);
    const leads = [...byId.values()].filter((l) => l.archivado !== true);

    // 4. Mensajes de esos leads (WhatsApp + automatización), por lotes; dedup + orden.
    const phones = [...new Set(leads.map((l) => normPhone(l.telefono)).filter(Boolean))];
    const fetchMsgs = async (table: "mensajes_whatsapp" | "mensajes_automatizacion") => {
      const out: Record<string, unknown>[] = [];
      for (let i = 0; i < phones.length; i += 40) {
        const batch = phones.slice(i, i + 40);
        const orFilter = batch.flatMap((p) => [`telefono.eq.${p}`, `telefono.like.${p}@%`]).join(",");
        const { data, error } = await supabase.from(table).select("*").or(orFilter);
        if (error) throw error;
        if (data) out.push(...data);
      }
      return out;
    };
    const [msgsWA, msgsAuto] = await Promise.all([fetchMsgs("mensajes_whatsapp"), fetchMsgs("mensajes_automatizacion")]);

    const all = [...msgsWA, ...msgsAuto] as Record<string, unknown>[];
    const seen = new Set<string>();
    const deduped = all.filter((m) => {
      const key = `${normPhone(m.telefono)}|${m.direccion}|${m.created_at ?? ""}|${(m.contenido ?? "").toString().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => msgTime(a) - msgTime(b));
    const msgsByPhone = new Map<string, Record<string, unknown>[]>();
    for (const l of leads) msgsByPhone.set(normPhone(l.telefono), []);
    for (const m of deduped) {
      const arr = msgsByPhone.get(normPhone(m.telefono));
      if (arr) arr.push(m);
    }
    const msgStats = new Map<string, { enviados: number; recibidos: number; ultimoMsg: string; ultimaFecha: string }>();
    for (const [phone, msgs] of msgsByPhone) {
      const enviados = msgs.filter((m) => m.direccion === "outbound").length;
      const recibidos = msgs.filter((m) => m.direccion === "inbound").length;
      const last = msgs.at(-1);
      msgStats.set(phone, {
        enviados, recibidos,
        ultimoMsg: (last?.contenido ?? "").toString().slice(0, 80),
        ultimaFecha: (last?.created_at ?? "").toString(),
      });
    }

    // 5. Hoja "Leads Etiquetados" (mismas columnas que TaggedExport).
    const rows = leads.map((l) => {
      const tagIds: string[] = Array.isArray(l.tag_ids) ? l.tag_ids : [];
      const etiquetas = tagIds.map((id) => tagMap.get(id)?.nombre ?? id).join(", ");
      const s = msgStats.get(normPhone(l.telefono)) ?? { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" };
      const telDigits = normPhone(l.telefono);
      return {
        "ID Lead": l.id ?? "",
        "ID Contacto": l.id_contacto ?? "",
        "Nombre": l.nombre ?? "",
        "Teléfono": l.telefono ?? "",
        "Teléfono (E.164)": telDigits ? `+${telDigits}` : "",
        "Teléfono (dígitos)": telDigits,
        "WhatsApp Link": telDigits ? `https://wa.me/${telDigits}` : "",
        "Email": l.email ?? "",
        "País": l.pais ?? "",
        "Timezone": l.timezone ?? "",
        "Estado": l.estado ?? "",
        "Motivo Cierre": l.motivo_cierre ?? "",
        "Etiquetas": etiquetas,
        "Etiquetas (IDs)": tagIds.join(", "),
        "Bot Activo": yesNo(l.bot_activo),
        "Archivado": yesNo(l.archivado),
        "Ha Respondido": yesNo(l.ha_respondido),
        "Puntuación": l.puntuacion ?? "",
        "Fase Secuencia": l.fase_secuencia ?? "",
        "Días Reales": l.dias_reales ?? "",
        "Origen": l.origen ?? "",
        "Franquiciado ID": l.franquiciado_id ?? "",
        "Creado": formatDate(l.created_at),
        "Actualizado": formatDate(l.updated_at),
        "Último Contacto": formatDate(l.ultimo_contacto_at),
        "Fecha Respuesta": formatDate(l.fecha_respuesta),
        "Próximo Contacto": formatDate(l.fecha_proximo_contacto),
        "Msgs Enviados": s.enviados,
        "Msgs Recibidos": s.recibidos,
        "Msgs Total": s.enviados + s.recibidos,
        "Último Mensaje": s.ultimoMsg,
        "Fecha Último Msg": formatDate(s.ultimaFecha),
      };
    });

    // 6. Hoja "Resumen Etiquetas": permanentes primero, luego con leads (alfabético).
    const byTag = new Map<string, Record<string, unknown>[]>();
    for (const l of leads) {
      for (const tid of (Array.isArray(l.tag_ids) ? l.tag_ids : [])) {
        if (!byTag.has(tid)) byTag.set(tid, []);
        byTag.get(tid)!.push(l);
      }
    }
    const ordered = tagsFull
      .filter((t) => t.es_permanente || (byTag.get(t.id)?.length ?? 0) > 0)
      .sort((a, b) => {
        if (!!a.es_permanente !== !!b.es_permanente) return a.es_permanente ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, "es");
      });
    const resumen = ordered.map((tag) => {
      const tLeads = byTag.get(tag.id) ?? [];
      const tResp = tLeads.filter((l) => l.ha_respondido).length;
      const tMsgs = tLeads.reduce((acc, l) => {
        const s = msgStats.get(normPhone(l.telefono));
        return acc + (s ? s.enviados + s.recibidos : 0);
      }, 0);
      return {
        "Etiqueta": tag.nombre,
        "Permanente": tag.es_permanente ? "Sí" : "No",
        "Leads": tLeads.length,
        "Respondieron": tResp,
        "Tasa %": tLeads.length ? Math.round((tResp / tLeads.length) * 100) : 0,
        "Mensajes": tMsgs,
      };
    });

    // 7. Construir el workbook (mismas anchuras que TaggedExport) y exportar base64.
    const wb = XLSX.utils.book_new();
    const wsResumen = XLSX.utils.json_to_sheet(resumen);
    (wsResumen as Record<string, unknown>)["!cols"] = [28, 11, 8, 13, 8, 10].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Etiquetas");

    const ws = XLSX.utils.json_to_sheet(rows);
    (ws as Record<string, unknown>)["!cols"] =
      [36, 14, 28, 16, 18, 16, 28, 32, 14, 10, 14, 18, 30, 30, 11, 11, 14, 11, 11, 11, 14, 36, 18, 18, 18, 18, 18, 12, 12, 12, 40, 20].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Leads Etiquetados");

    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);
    const label = paisFiltro ? paisFiltro.toLowerCase() : "todos";
    const filename = `leads-clasificados-${label}-${today}.xlsx`;

    return json({
      success: true,
      filename,
      base64,
      total_leads: leads.length,
      total_etiquetas: resumen.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("clasificacion-excel error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

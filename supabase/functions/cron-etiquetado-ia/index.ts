// CRON de auto-etiquetado con IA (cada ~10h).
//
// 1. Busca leads NO archivados con actividad reciente (mensajes en la ventana).
// 2. Para cada uno arma la conversación y llama a `etiquetar-ia` (DeepSeek),
//    que aplica las etiquetas en la BD y devuelve además un resumen breve.
// 3. Postea un LOTE al webhook de n8n /auto-tag-chile con, por cada lead:
//    { telefono, nombre, etiquetas, resumen }, más el catálogo completo de etiquetas.
//
// Auth: header X-Webhook-Secret (mismo secreto que N8N_WEBHOOK_SECRET).
// Pensado para invocarse desde pg_cron vía pg_net (ver migración).
//
// Variables de entorno opcionales:
//   VENTANA_HORAS   ventana de actividad a mirar (default 12, con solape para no perder leads)
//   MAX_LEADS       tope de leads por corrida (default 50)
//   N8N_AUTO_TAG_URL  override de la URL del webhook
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

const N8N_AUTO_TAG_URL =
  Deno.env.get("N8N_AUTO_TAG_URL") ??
  "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/auto-tag-chile";

// Token de respaldo embebido para autorizar el disparo del cron. Se usa porque
// la cuenta no puede gestionar secretos en este proyecto (gestionado por Lovable)
// y N8N_WEBHOOK_SECRET no está disponible en texto plano. El repo es privado.
const CRON_TOKEN = "rpchile_cron_2026_a8K3mZqL";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const CRON_SECRET = Deno.env.get("AUTO_TAG_CRON_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Autoriza la llamada del cron con un secreto dedicado (AUTO_TAG_CRON_SECRET)
    // o, si se conoce, con el N8N_WEBHOOK_SECRET compartido.
    const incoming = req.headers.get("x-webhook-secret") ?? "";
    const authorized =
      incoming === CRON_TOKEN ||
      (!!CRON_SECRET && incoming === CRON_SECRET) ||
      (!!WEBHOOK_SECRET && incoming === WEBHOOK_SECRET);
    if (!authorized) {
      return json({ error: "Unauthorized" }, 401);
    }

    const VENTANA_HORAS = Number(Deno.env.get("VENTANA_HORAS") ?? "12");
    const MAX_LEADS = Number(Deno.env.get("MAX_LEADS") ?? "50");
    const cutoff = new Date(Date.now() - VENTANA_HORAS * 3600 * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Teléfonos con actividad reciente (cualquier dirección) dentro de la ventana.
    const { data: recientes, error: recErr } = await supabase
      .from("mensajes_whatsapp")
      .select("telefono, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (recErr) throw recErr;

    // Normaliza al núcleo de dígitos (los mensajes pueden traer sufijo JID @s.whatsapp.net).
    const coreTel = (t: unknown) => (t ?? "").toString().split("@")[0].replace(/\D/g, "");
    const telefonos = [...new Set((recientes ?? []).map((m) => coreTel(m.telefono)).filter(Boolean))]
      .slice(0, MAX_LEADS);

    // 2. Catálogo COMPLETO de etiquetas (service role → ignora RLS).
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags")
      .select("id, nombre, color, es_permanente")
      .order("nombre", { ascending: true });
    if (tagsErr) throw tagsErr;
    const etiquetas_totales = (tags ?? []).map((t) => ({
      id: t.id, nombre: t.nombre, color: t.color, es_permanente: t.es_permanente,
    }));

    const resultados: Array<Record<string, unknown>> = [];

    for (const telefono of telefonos) {
      // 2a. Lead no archivado para este teléfono (acepta sufijo JID de WhatsApp).
      const { data: lead } = await supabase
        .from("leads_campana")
        .select("id, id_contacto, nombre, telefono, pais, archivado")
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

      // 2c. Delegar en etiquetar-ia: aplica etiquetas (DeepSeek) y devuelve resumen.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/etiquetar-ia`, {
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
          }),
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json().catch(() => ({}));
        const etiquetas = Array.isArray(data?.decision?.tag_nombres) ? data.decision.tag_nombres : [];
        resultados.push({
          telefono,
          id_contacto: lead.id_contacto ?? "",
          nombre: lead.nombre ?? "",
          pais: lead.pais ?? "",
          etiquetas,
          resumen: (data?.resumen ?? "").toString(),
          ok: res.ok && data?.success === true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultados.push({ telefono, id_contacto: lead.id_contacto ?? "", nombre: lead.nombre ?? "", pais: lead.pais ?? "", etiquetas: [], resumen: "", ok: false, error: msg });
      }
    }

    // 3. Postear el lote al webhook de n8n (/auto-tag-chile).
    const payload = {
      evento: "cron_etiquetado_ia",
      generado_en: new Date().toISOString(),
      ventana_horas: VENTANA_HORAS,
      total: resultados.length,
      leads: resultados,
      etiquetas_totales,
    };

    let n8n_status = 0;
    let n8n_response = "";
    try {
      const wh = await fetch(N8N_AUTO_TAG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      n8n_status = wh.status;
      n8n_response = await wh.text();
    } catch (e) {
      n8n_response = e instanceof Error ? e.message : String(e);
    }

    return json({
      success: true,
      ventana_horas: VENTANA_HORAS,
      leads_con_actividad: telefonos.length,
      leads_procesados: resultados.length,
      n8n_status,
      n8n_response,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-etiquetado-ia error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

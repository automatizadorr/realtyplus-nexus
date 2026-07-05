// CRON de auto-etiquetado con IA (cada ~10h).
//
// 1. Busca leads NO archivados con actividad reciente (mensajes en la ventana).
// 2. Para cada uno arma la conversación y llama a `etiquetar-ia` (DeepSeek),
//    que aplica las etiquetas en la BD y devuelve además un resumen breve.
// 3. Postea un LOTE al webhook de n8n /auto-tag-chile con, por cada lead:
//    { telefono, nombre, etiquetas, resumen }, más el catálogo completo de etiquetas.
//    SOLO se envían los leads que recibieron alguna etiqueta, EXCLUYENDO únicamente
//    "Sigue en campaña" (el lead aún no contestó). Todos los demás estados van a
//    expansión, incluido "No interesa" (rechazó).
//    Cuando un "Sigue en campaña" responde, su actividad reciente lo hace pasar de
//    nuevo por etiquetar-ia, que (grupo exclusivo estado_lead) reemplaza ese estado
//    por el que corresponda → deja de estar excluido y se envía a expansión.
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

// Único estado que NO se envía a expansión: "Sigue en campaña" (el lead aún no ha
// contestado, sigue trabajándose en campaña). El resto SÍ se envía, incluido
// "No interesa" (rechazó). En cuanto un "Sigue en campaña" conteste, etiquetar-ia
// (grupo exclusivo estado_lead) reemplaza ese estado y el lead entra al envío.
const ETIQUETAS_NO_ENVIAR = ["Sigue en campaña"];

// Estados que blindan al lead de ser re-etiquetado por este cron.
// Si un lead ya tiene uno de estos estados, se salta por completo (no se llama a
// DeepSeek, no se toca su estado, no se envía a reactivación).
// - "Cita agendada": ya tiene reunión pactada — contactarlo de nuevo quema el cierre.
// - "Agente asignado": ya tiene un humano a cargo — la IA no debe interferir.
// - "Conversación Activa": está en plena charla con el bot — otro mensaje lo confunde.
const ESTADOS_PROTEGIDOS = ["Cita agendada", "Agente asignado", "Conversación Activa"];

// Normaliza para comparar nombres de etiqueta (minúsculas, sin tildes, sin espacios).
const norm = (s: unknown) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

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

    // Modo de prueba: dry_run NO aplica etiquetas ni postea a n8n (solo devuelve el
    // lote que SE enviaría). pais filtra los leads por país (ej. "Bolivia") en vez de
    // por actividad reciente — útil para probar el pipeline sobre un segmento.
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const paisFiltro = (body?.pais ?? "").toString().trim();
    // Por defecto el cron SOLO ETIQUETA (acumula en leads_campana) y NO postea a n8n,
    // para no fragmentar. El envío consolidado se hace todo junto a /expansion desde la
    // página "Exportar Etiquetados" (TaggedExport) o con un servicio dedicado. Para
    // restaurar el POST por-corrida al viejo /auto-tag-chile, pasar enviar:true.
    const enviar = body?.enviar === true;

    const VENTANA_HORAS = Number(Deno.env.get("VENTANA_HORAS") ?? "12");
    const MAX_LEADS = Number(Deno.env.get("MAX_LEADS") ?? "50");
    const cutoff = new Date(Date.now() - VENTANA_HORAS * 3600 * 1000).toISOString();

    // Overrides por body para procesar en LOTES y no exceder el límite de recursos de la
    // Edge Function (error 546) en corridas reales (cada lead hace DeepSeek + tag-lead).
    //   max_leads: tamaño del lote (default MAX_LEADS).
    //   offset:    salta los primeros N teléfonos únicos (paginar: 0, max_leads, 2*max_leads…).
    // Operan sobre la lista de teléfonos ÚNICOS ya ordenada, así la paginación es estable.
    const maxLeads = Number(body?.max_leads) > 0 ? Math.floor(Number(body.max_leads)) : MAX_LEADS;
    const offset = Number(body?.offset) > 0 ? Math.floor(Number(body.offset)) : 0;
    const HARD_CAP = 1000; // techo de filas a traer antes de deduplicar/paginar

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Normaliza al núcleo de dígitos (los mensajes pueden traer sufijo JID @s.whatsapp.net).
    const coreTel = (t: unknown) => (t ?? "").toString().split("@")[0].replace(/\D/g, "");

    // 1. Teléfonos a procesar:
    //    - con `pais`: todos los leads (no archivados) de ese país.
    //    - sin `pais`: teléfonos con actividad reciente dentro de la ventana.
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
      const { data: recientes, error: recErr } = await supabase
        .from("mensajes_whatsapp")
        .select("telefono, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });
      if (recErr) throw recErr;
      telefonos = [...new Set((recientes ?? []).map((m) => coreTel(m.telefono)).filter(Boolean))]
        .slice(offset, offset + maxLeads);
    }

    // 2. Catálogo COMPLETO de etiquetas (service role → ignora RLS).
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags")
      .select("id, nombre, color, es_permanente")
      .order("nombre", { ascending: true });
    if (tagsErr) throw tagsErr;
    const etiquetas_totales = (tags ?? []).map((t) => ({
      id: t.id, nombre: t.nombre, color: t.color, es_permanente: t.es_permanente,
    }));

    // IDs de las etiquetas protegidas resueltos desde el catálogo real.
    const estadosProtegidosIds = new Set(
      (tags ?? [])
        .filter((t) => ESTADOS_PROTEGIDOS.some((e) => norm(e) === norm(t.nombre)))
        .map((t) => t.id),
    );

    const resultados: Array<Record<string, unknown>> = [];
    let omitidos_estado_protegido = 0;

    for (const telefono of telefonos) {
      // 2a. Lead no archivado para este teléfono (acepta sufijo JID de WhatsApp).
      const { data: lead } = await supabase
        .from("leads_campana")
        .select("id, id_contacto, nombre, telefono, pais, email, archivado, tag_ids")
        .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
        .maybeSingle();
      if (!lead || lead.archivado === true) continue;

      // Saltar leads que ya tienen un estado protegido (cita, agente asignado, etc.).
      // Ni se llama a DeepSeek ni se toca su estado; su ciclo de vida queda intacto.
      const leadTagIds: string[] = Array.isArray(lead.tag_ids) ? lead.tag_ids : [];
      if (leadTagIds.some((id) => estadosProtegidosIds.has(id))) {
        omitidos_estado_protegido++;
        continue;
      }

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
            aplicar: !dryRun,
          }),
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json().catch(() => ({}));
        const etiquetas = Array.isArray(data?.decision?.tag_nombres) ? data.decision.tag_nombres : [];
        resultados.push({
          telefono,
          id_contacto: lead.id_contacto ?? "",
          nombre: lead.nombre ?? "",
          correo: lead.email ?? "",
          pais: lead.pais ?? "",
          etiquetas,
          resumen: (data?.resumen ?? "").toString(),
          ok: res.ok && data?.success === true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultados.push({ telefono, id_contacto: lead.id_contacto ?? "", nombre: lead.nombre ?? "", correo: lead.email ?? "", pais: lead.pais ?? "", etiquetas: [], resumen: "", ok: false, error: msg });
      }
    }

    // 3. Filtrar qué leads se envían a expansión vía n8n:
    //    - SOLO los que recibieron al menos una etiqueta.
    //    - EXCLUYENDO únicamente "Sigue en campaña" (el lead aún no contestó). Al
    //      contestar, etiquetar-ia reemplaza ese estado y el lead vuelve a entrar aquí.
    const noEnviarNorm = ETIQUETAS_NO_ENVIAR.map(norm);
    const tieneEstadoEnCampana = (etqs: unknown) =>
      Array.isArray(etqs) && etqs.some((e) => noEnviarNorm.includes(norm(e)));

    const leads_a_enviar = resultados.filter((r) => {
      const etiquetas = Array.isArray(r.etiquetas) ? r.etiquetas : [];
      return etiquetas.length > 0 && !tieneEstadoEnCampana(etiquetas);
    });
    const omitidos_sigue_campana = resultados.filter((r) => tieneEstadoEnCampana(r.etiquetas)).length;
    const omitidos_sin_etiqueta = resultados.filter(
      (r) => (Array.isArray(r.etiquetas) ? r.etiquetas.length : 0) === 0,
    ).length;

    // 4. POST a n8n. Por defecto NO se postea: el cron solo etiqueta y los datos quedan
    //    en leads_campana para enviarlos TODOS JUNTOS a /expansion (reporte a jefatura).
    //    Solo si enviar:true se hace el POST por-corrida al viejo /auto-tag-chile.
    let n8n_status = 0;
    let n8n_response = "";
    if (dryRun) {
      n8n_response = "dry_run: no se aplicaron etiquetas ni se posteó a n8n";
    } else if (!enviar) {
      n8n_response = "solo etiquetado: datos guardados en leads_campana. Enviar TODO JUNTO a /expansion desde 'Exportar Etiquetados'. (Para postear por-corrida usar enviar:true)";
    } else if (leads_a_enviar.length > 0) {
      const payload = {
        evento: "cron_etiquetado_ia",
        generado_en: new Date().toISOString(),
        ventana_horas: VENTANA_HORAS,
        total: leads_a_enviar.length,
        leads: leads_a_enviar,
        etiquetas_totales,
      };
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
    } else {
      n8n_response = "sin leads que enviar (todos sin etiqueta o en 'Sigue en campaña')";
    }

    return json({
      success: true,
      ...(dryRun ? { dry_run: true } : {}),
      ...(!dryRun && !enviar ? { solo_etiquetado: true } : {}),
      ...(paisFiltro ? { pais: paisFiltro } : {}),
      ventana_horas: VENTANA_HORAS,
      leads_candidatos: telefonos.length,
      leads_procesados: resultados.length,
      leads_enviados: leads_a_enviar.length,
      omitidos_estado_protegido,
      omitidos_sigue_campana,
      omitidos_sin_etiqueta,
      n8n_status,
      n8n_response,
      ...(dryRun ? { leads_preview: leads_a_enviar } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-etiquetado-ia error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

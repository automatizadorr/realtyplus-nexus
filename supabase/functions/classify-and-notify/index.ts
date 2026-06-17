import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY     = Deno.env.get("ANTHROPIC_API_KEY")!;
const N8N_SECRET        = Deno.env.get("N8N_WEBHOOK_SECRET") ?? "";
const CRON_SECRET       = Deno.env.get("CRON_SECRET") ?? "";
const N8N_URL           = "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/webhook";
const WINDOW_HOURS      = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Normaliza timestamp a segundos Unix independientemente de si viene en ms o s */
function toSeconds(ts: number): number {
  return ts > 1e12 ? Math.floor(ts / 1000) : ts;
}

/** Limpia un número de teléfono a solo dígitos */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

const AI_LABELS = [
  "Lead Caliente",
  "Interesado en Financiamiento",
  "Listo para Cerrar",
  "Solo Consultando",
  "Requiere Seguimiento IA",
  "Conversación Activa",
  "No interesa",
  "Cita agendada",
] as const;

type AiLabel = (typeof AI_LABELS)[number];

function isValidLabel(s: string): s is AiLabel {
  return AI_LABELS.includes(s as AiLabel);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Auth: solo GitHub Actions puede invocar esta función ──
  const incomingSecret = req.headers.get("x-cron-secret");
  if (CRON_SECRET && incomingSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const svc = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - WINDOW_HOURS * 3600;

  try {
    // ── 1. Cargar todas las etiquetas ──
    const { data: allTags, error: tagsErr } = await svc
      .from("lead_tags")
      .select("id, nombre, es_permanente");
    if (tagsErr) throw new Error(`lead_tags: ${tagsErr.message}`);

    const tagByName = new Map<string, string>(
      (allTags ?? []).map((t) => [t.nombre as string, t.id as string]),
    );
    const permanentIds = new Set(
      (allTags ?? []).filter((t) => t.es_permanente).map((t) => t.id as string),
    );

    // ── 2. Conversaciones con actividad en la ventana ──
    const { data: allConvs, error: convErr } = await svc
      .from("conversations")
      .select("id, phone, jid, name, last_message_at")
      .not("last_message_at", "is", null);
    if (convErr) throw new Error(`conversations: ${convErr.message}`);

    const recentConvs = (allConvs ?? []).filter((c) => {
      const ts = toSeconds(c.last_message_at as number);
      return ts >= windowStart;
    });

    if (recentConvs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, tagged: 0, message: `Sin actividad en las últimas ${WINDOW_HOURS}h` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: {
      lead_id: string;
      nombre: string;
      telefono: string;
      etiqueta: string;
      mensajes: number;
    }[] = [];
    const skipped: string[] = [];

    // ── 3. Procesar cada conversación ──
    for (const conv of recentConvs) {
      try {
        // 3a. Mensajes de la conversación
        const { data: messages } = await svc
          .from("messages")
          .select("content, role, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(60);

        if (!messages || messages.length === 0) {
          skipped.push(`conv ${conv.id}: sin mensajes`);
          continue;
        }

        // 3b. Buscar lead por teléfono
        const rawPhone = digitsOnly(conv.phone ?? conv.jid?.split("@")[0] ?? "");
        if (!rawPhone) { skipped.push(`conv ${conv.id}: sin teléfono`); continue; }

        const { data: leads } = await svc
          .from("leads_campana")
          .select("id, nombre, telefono, tag_ids")
          .or(`telefono.ilike.%${rawPhone}%,telefono.eq.${conv.phone}`)
          .neq("archivado", true)
          .limit(1);

        const lead = leads?.[0];
        if (!lead) { skipped.push(`conv ${conv.id}: lead no encontrado (${rawPhone})`); continue; }

        // 3c. ¿Respondió el lead?
        const leadResponded = messages.some((m) => m.role === "user");
        let tagName: string;

        if (!leadResponded) {
          // Sin respuesta → etiqueta directa, sin llamar a Claude
          tagName = "Sin Respuesta al Bot";
        } else {
          // 3d. Armar transcript y clasificar con Claude Haiku
          const transcript = messages
            .map((m) => `${m.role === "assistant" ? "Agente IA" : "Lead"}: ${m.content}`)
            .join("\n")
            .slice(0, 3500);

          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 20,
              system: `Eres un clasificador de leads inmobiliarios. Analiza la conversación y responde ÚNICAMENTE con el nombre exacto de la etiqueta más apropiada:
- Lead Caliente (pregunta por precio, disponibilidad o quiere ver inmueble)
- Interesado en Financiamiento (menciona crédito, hipoteca o necesita financiamiento)
- Listo para Cerrar (listo para comprar, señales claras de decisión)
- Solo Consultando (curiosidad sin urgencia ni intención clara)
- Requiere Seguimiento IA (respondió pero conversación sin conclusión)
- Conversación Activa (intercambio fluido sin clasificación definitiva)
- No interesa (expresó desinterés explícito)
- Cita agendada (solicitó o confirmó visita o cita)
Responde solo con el nombre, sin puntos ni comillas.`,
              messages: [{ role: "user", content: transcript }],
            }),
          });

          const claudeJson = await claudeRes.json();
          const raw = (claudeJson.content?.[0]?.text ?? "").trim();
          tagName = isValidLabel(raw) ? raw : "Requiere Seguimiento IA";
        }

        const tagId = tagByName.get(tagName);
        if (!tagId) { skipped.push(`conv ${conv.id}: etiqueta "${tagName}" no existe en BD`); continue; }

        // 3e. Actualizar tag_ids: preservar permanentes, reemplazar IA
        const existing: string[] = lead.tag_ids ?? [];
        const permanent = existing.filter((id) => permanentIds.has(id));
        const updated = [...new Set([...permanent, tagId])];

        await svc
          .from("leads_campana")
          .update({ tag_ids: updated, updated_at: new Date().toISOString() })
          .eq("id", lead.id);

        results.push({
          lead_id: lead.id,
          nombre: lead.nombre,
          telefono: lead.telefono,
          etiqueta: tagName,
          mensajes: messages.length,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Error conv ${conv.id}:`, msg);
        skipped.push(`conv ${conv.id}: ${msg}`);
      }
    }

    // ── 4. Enviar webhook a n8n ──
    const payload = {
      evento: "clasificacion_ia_leads",
      timestamp: new Date().toISOString(),
      ventana_horas: WINDOW_HOURS,
      conversaciones_analizadas: recentConvs.length,
      leads_clasificados: results.length,
      omitidos: skipped.length,
      leads: results,
    };

    try {
      const webhookRes = await fetch(N8N_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(N8N_SECRET ? { "X-Webhook-Secret": N8N_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });
      console.log(`Webhook n8n: ${webhookRes.status}`);
    } catch (webhookErr) {
      console.warn("n8n no disponible:", webhookErr instanceof Error ? webhookErr.message : webhookErr);
    }

    return new Response(JSON.stringify({ success: true, ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("classify-and-notify fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

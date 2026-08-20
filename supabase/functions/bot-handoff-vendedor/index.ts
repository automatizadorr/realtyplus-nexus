// Fase B del pipeline: Camil-AI (n8n) llama esto cuando un lead de
// leads_campana responde/califica. YA NO asigna un vendedor automático
// (el reparto pasó a ser 100% manual, ver [[project_nexus_pipeline_vendedor]]):
// solo apaga bot_activo para que Camil-AI no le siga escribiendo mientras
// el admin decide a quién enviárselo desde el panel. El aviso de la
// escalación al admin ya lo maneja la rama "🚨 ¿Escalar a Humano?" propia
// del workflow (email + tabla escalaciones + Sheets) — esto es un paso
// aparte, en simultáneo.
//
// Auth: header X-Webhook-Secret (secreto dedicado BOT_HANDOFF_SECRET).
//
// Conectado desde el workflow "Canil-AI" (n8n, localhost:5678, id
// ouf0maiCEFpDc60d) en la rama "🚨 ¿Escalar a Humano?" → nodo HTTP Request
// "🎯 Entregar a Vendedor (Nexus)", en paralelo a "📥 Registrar Escalación".
//
// Body:
//   telefono: string   (requerido) — mismo formato que usa Camil-AI para el lead
//   motivo?: string    contexto opcional para el log de etapa
//
// Efecto: bot_activo = false. Si el lead todavía no tiene vendedor_id,
// queda "sin asignar" (visible para el admin en el panel) hasta que lo
// envíe a alguien. Idempotente: no pisa nada si ya se había apagado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("BOT_HANDOFF_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const telefono = (body?.telefono ?? "").toString().replace(/\D/g, "");
    const motivo: string = typeof body?.motivo === "string" ? body.motivo.trim() : "Escalado por Camil-AI";
    if (!telefono) return json({ error: "telefono requerido" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("leads_campana")
      .select("id, vendedor_id, bot_activo")
      .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return json({ success: false, error: `Lead no encontrado para teléfono: ${telefono}` }, 404);

    if (lead.bot_activo === false) {
      return json({ success: true, skipped: true, reason: "El bot ya estaba apagado para este lead", lead_id: lead.id, vendedor_id: lead.vendedor_id });
    }

    const { error: updateErr } = await supabase
      .from("leads_campana")
      .update({ bot_activo: false })
      .eq("id", lead.id);
    if (updateErr) throw updateErr;

    return json({ success: true, lead_id: lead.id, vendedor_id: lead.vendedor_id, motivo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bot-handoff-vendedor error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

// Fase B del pipeline de vendedor: Camil-AI (n8n) llama esto cuando un lead de
// leads_campana responde/califica, para entregarlo a un vendedor humano.
// Auth: header X-Webhook-Secret (secreto dedicado BOT_HANDOFF_SECRET, distinto
// del N8N_WEBHOOK_SECRET que usan tag-lead/send-n8n-webhook, para no acoplar
// este flujo a esos otros).
//
// Conectado desde el workflow "Canil-AI" (n8n, localhost:5678, id
// ouf0maiCEFpDc60d) en la rama "🚨 ¿Escalar a Humano?" → nodo HTTP Request
// "🎯 Entregar a Vendedor (Nexus)", en paralelo a "📥 Registrar Escalación".
//
// Body:
//   telefono: string   (requerido) — mismo formato que usa Camil-AI para el lead
//   motivo?: string    contexto opcional para el log de etapa
//
// Efecto si hay vendedor disponible para el país del lead:
//   - vendedor_id = el elegido (round-robin por menor carga, elegir_vendedor_para)
//   - etapa_venta = 'interesado', fecha_asignacion = now()
//   - bot_activo = false (para que Camil-AI no le siga escribiendo a la vez)
//   - log en leads_campana_etapa_log
// Si el lead ya tenía vendedor_id (idempotente, reintentos de n8n no lo reasignan)
// o no hay vendedor activo para su país, no toca nada y devuelve success:false
// con la razón — así el workflow puede decidir (dejar el bot activo, avisar a Mario).
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
    const motivo: string = typeof body?.motivo === "string" ? body.motivo.trim() : "Entregado por Camil-AI";
    if (!telefono) return json({ error: "telefono requerido" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead, error: leadErr } = await supabase
      .from("leads_campana")
      .select("id, pais, vendedor_id, etapa_venta")
      .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return json({ success: false, error: `Lead no encontrado para teléfono: ${telefono}` }, 404);

    if (lead.vendedor_id) {
      return json({ success: false, skipped: true, reason: "El lead ya tiene vendedor asignado", lead_id: lead.id });
    }
    if (!lead.pais) {
      return json({ success: false, reason: "El lead no tiene país, no se puede elegir vendedor", lead_id: lead.id });
    }

    const { data: vendedorId, error: elegirErr } = await supabase.rpc("elegir_vendedor_para", { _pais: lead.pais });
    if (elegirErr) throw elegirErr;
    if (!vendedorId) {
      return json({ success: false, reason: `Sin vendedor activo para el país "${lead.pais}"`, lead_id: lead.id });
    }

    const { error: updateErr } = await supabase
      .from("leads_campana")
      .update({
        vendedor_id: vendedorId,
        etapa_venta: "interesado",
        fecha_asignacion: new Date().toISOString(),
        bot_activo: false,
      })
      .eq("id", lead.id);
    if (updateErr) throw updateErr;

    await supabase.from("leads_campana_etapa_log").insert({
      lead_id: lead.id,
      user_id: null,
      etapa_anterior: lead.etapa_venta,
      etapa_nueva: "interesado",
    });

    return json({ success: true, lead_id: lead.id, vendedor_id: vendedorId, motivo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bot-handoff-vendedor error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

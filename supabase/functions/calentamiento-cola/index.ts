// Cola de calentamiento: la puerta entre n8n y las reglas que viven en la
// base de datos.
//
// Existe para que el workflow NO necesite la service_role key. Las RPC
// leads_para_calentar / calentamiento_registrar están revocadas para anon y
// authenticated a propósito: solo las puede llamar el service_role, y esa
// llave no debe andar dando vueltas dentro de un nodo de n8n. Esta function
// la usa por dentro y hacia afuera pide el mismo x-webhook-secret que ya
// usan los nodos de captación, así se reutiliza el credential que existe.
//
// Auth: header X-Webhook-Secret (BOT_HANDOFF_SECRET).
//
// Body:
//   { "accion": "cola", "limite"?: 50 }
//       -> { leads: [ { lead_id, telefono, nombre, fase, cuerpo,
//                       media_url, media_tipo, horas_callado } ] }
//
//   { "accion": "registrar", "lead_id": "...", "fase": 1, "mensaje"?: "..." }
//       -> { ok: true }   se llama DESPUÉS de que WhatsApp aceptó el envío
//
//   { "accion": "reset", "telefono": "..." }
//       -> { reseteados: n }   corte manual; el flujo normal se resetea solo
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

    if (!WEBHOOK_SECRET || (req.headers.get("x-webhook-secret") ?? "") !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const accion = typeof body?.accion === "string" ? body.accion : "cola";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    if (accion === "cola") {
      const limite = Number.isFinite(body?.limite) ? Math.min(Number(body.limite), 200) : 50;
      const { data, error } = await supabase.rpc("leads_para_calentar", { _limite: limite });
      if (error) throw error;
      return json({ leads: data ?? [], total: (data ?? []).length });
    }

    if (accion === "registrar") {
      const lead_id = typeof body?.lead_id === "string" ? body.lead_id : "";
      const fase = Number(body?.fase);
      if (!lead_id || !Number.isFinite(fase)) return json({ error: "lead_id y fase requeridos" }, 400);
      const { error } = await supabase.rpc("calentamiento_registrar", {
        _lead_id: lead_id, _fase: fase,
        _mensaje: typeof body?.mensaje === "string" ? body.mensaje : null,
      });
      if (error) throw error;
      return json({ ok: true, lead_id, fase });
    }

    if (accion === "reset") {
      const telefono = typeof body?.telefono === "string" ? body.telefono : "";
      if (!telefono) return json({ error: "telefono requerido" }, 400);
      const { data, error } = await supabase.rpc("calentamiento_reset", { _telefono: telefono });
      if (error) throw error;
      return json({ reseteados: data ?? 0 });
    }

    return json({ error: `accion desconocida: ${accion}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("calentamiento-cola error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

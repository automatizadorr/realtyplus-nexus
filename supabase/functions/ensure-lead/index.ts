// Asegura que un contacto de WhatsApp EXISTA como lead en leads_campana, para que su
// conversación aparezca en el inbox del frontend (la vista se maneja por leads_campana).
// Idempotente: si el lead ya existe (match por dígitos del teléfono), no duplica; opcional-
// mente completa el nombre si estaba vacío. Si no existe, lo crea con el teléfono en dígitos.
//
// Pensado para llamarse desde n8n al entrar un mensaje inbound (junto al guardado del mensaje).
//
// Auth: header X-Webhook-Secret (AUTO_TAG_CRON_SECRET o N8N_WEBHOOK_SECRET).
//
// Body:
//   telefono: string   (requerido) — el wa_id de WhatsApp (dígitos)
//   nombre?: string    nombre del perfil de WhatsApp
//   pais?: string
//
// Respuesta: { success, lead_id, telefono, created }
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

// Núcleo de dígitos del teléfono (descarta sufijo JID @s.whatsapp.net, +, espacios).
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
    const telefono = coreTel(body?.telefono);
    const nombre = (body?.nombre ?? "").toString().trim();
    const pais = (body?.pais ?? "").toString().trim() || null;
    if (!telefono) return json({ error: "telefono requerido" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. ¿Ya existe el lead? (acepta variantes con sufijo JID de WhatsApp)
    const { data: lead, error: findErr } = await supabase
      .from("leads_campana")
      .select("id, nombre, telefono")
      .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
      .maybeSingle();
    if (findErr) throw findErr;

    if (lead) {
      // Completa el nombre si estaba vacío y ahora tenemos uno del perfil de WhatsApp.
      if (nombre && !(lead.nombre ?? "").toString().trim()) {
        await supabase.from("leads_campana").update({ nombre }).eq("id", lead.id);
      }
      return json({ success: true, lead_id: lead.id, telefono, created: false });
    }

    // 2. No existe → crearlo con el teléfono en dígitos (así engancha con los mensajes).
    const { data: created, error: insErr } = await supabase
      .from("leads_campana")
      .insert({
        telefono,
        nombre: nombre || `Lead ${telefono}`,
        pais,
        origen: "whatsapp-inbound",
        ha_respondido: true,
        tag_ids: [] as string[],
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    return json({ success: true, lead_id: created.id, telefono, created: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ensure-lead error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

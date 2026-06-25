// Inserta un mensaje de automatización en mensajes_automatizacion (lo que alimenta la
// sección /automatizacion inbox, vista_inbox_automatizacion). Se hace con SERVICE ROLE
// para saltar el RLS: insertar en esa tabla ahora requiere admin y a anon se le revocó
// el INSERT, así que el nodo de Supabase de n8n (anon key) ya NO puede escribir ahí.
// Esta función lo resuelve sin aflojar la seguridad (queda gateada por el secreto).
//
// Auth: header X-Webhook-Secret (CRON_TOKEN embebido, AUTO_TAG_CRON_SECRET o N8N_WEBHOOK_SECRET).
//
// Body (telefono y contenido son obligatorios; el resto opcional):
//   telefono, contenido, direccion ("outbound"|"inbound", default "outbound"),
//   canal (default "whatsapp"), campaign_name, nombre, pais, email, id_contacto,
//   estado_envio, wamid, plantilla_usada, dia_secuencia, n8n_execution_id
//
// Respuesta: { success, id }
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

const CRON_TOKEN = "rpchile_cron_2026_a8K3mZqL";

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
      incoming === CRON_TOKEN ||
      (!!CRON_SECRET && incoming === CRON_SECRET) ||
      (!!WEBHOOK_SECRET && incoming === WEBHOOK_SECRET);
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const telefono = coreTel(body?.telefono);
    const contenido = (body?.contenido ?? body?.mensaje ?? "").toString();
    if (!telefono) return json({ error: "telefono requerido" }, 400);
    if (!contenido.trim()) return json({ error: "contenido requerido" }, 400);

    const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : v.toString());

    const row: Record<string, unknown> = {
      telefono,
      contenido,
      direccion: (body?.direccion ?? "outbound").toString(),
      canal: (body?.canal ?? "whatsapp").toString(),
      campaign_name: str(body?.campaign_name),
      nombre: str(body?.nombre),
      pais: str(body?.pais),
      email: str(body?.email),
      id_contacto: str(body?.id_contacto),
      estado_envio: str(body?.estado_envio),
      wamid: str(body?.wamid),
      plantilla_usada: str(body?.plantilla_usada),
      n8n_execution_id: str(body?.n8n_execution_id),
      dia_secuencia: Number.isFinite(Number(body?.dia_secuencia)) ? Number(body.dia_secuencia) : null,
      leido: body?.leido === true,
    };

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await supabase
      .from("mensajes_automatizacion")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;

    return json({ success: true, id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("log-auto-message error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

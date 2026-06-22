// Envía un evento de lead al webhook de auto-etiquetado de n8n (/auto-tag-chile),
// adjuntando SIEMPRE el catálogo COMPLETO y actualizado de etiquetas (lead_tags).
//
// Se lee lead_tags con la service role (server-side), así que el envío trae todas
// las etiquetas que existan en ese momento, sin depender del RLS del cliente ni de
// claves en el frontend.
//
// Auth: header X-Webhook-Secret (mismo secreto que N8N_WEBHOOK_SECRET en n8n).
//
// Body:
//   telefono: string            (requerido)
//   mensaje?: string            el texto del lead a clasificar
//   evento?: string             (default "mensaje_recibido")
//   nombre?: string             nombre del lead
//
// Respuesta: { success, etiquetas_enviadas, n8n_status, n8n_response } o { error }
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

// URL del webhook en n8n. Configurable por env; con fallback a la instancia conocida.
const N8N_AUTO_TAG_URL =
  Deno.env.get("N8N_AUTO_TAG_URL") ??
  "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/auto-tag-chile";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Auth — mismo secreto que usa n8n para el resto de funciones.
    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const telefonoRaw = (body?.telefono ?? "").toString();
    const telefono = telefonoRaw.split("@")[0].replace(/\D/g, "");
    if (!telefono) return json({ error: "telefono requerido" }, 400);

    const mensaje = (body?.mensaje ?? "").toString();
    const evento = (body?.evento ?? "mensaje_recibido").toString();
    const nombre = (body?.nombre ?? "").toString();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 2. Leer TODAS las etiquetas vivas (service role → ignora RLS).
    const { data: tags, error: tagsErr } = await supabase
      .from("lead_tags")
      .select("id, nombre, color, es_permanente")
      .order("nombre", { ascending: true });
    if (tagsErr) throw tagsErr;

    const etiquetas_totales = (tags ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      color: t.color,
      es_permanente: t.es_permanente,
    }));

    // 3. Postear al webhook de n8n con el catálogo completo adjunto.
    const payload = {
      telefono,
      nombre,
      mensaje,
      evento,
      enviado_en: new Date().toISOString(),
      etiquetas_totales,
    };

    try {
      const res = await fetch(N8N_AUTO_TAG_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      return json({
        success: true,
        etiquetas_enviadas: etiquetas_totales.length,
        n8n_status: res.status,
        n8n_response: text,
        ...(res.ok ? {} : { warning: "n8n devolvió un status no-2xx" }),
      });
    } catch (fetchErr) {
      // Entrega best-effort: no rompemos si n8n está caído.
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn("auto-tag-chile webhook inalcanzable:", msg);
      return json({
        success: true,
        etiquetas_enviadas: etiquetas_totales.length,
        warning: "n8n inalcanzable",
        error: msg,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-auto-tag-chile error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

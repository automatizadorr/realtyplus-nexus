// Cola de recordatorios de reunión: la puerta entre n8n y las reglas que
// viven en la base de datos.
//
// Mismo patrón que `calentamiento-cola` y por la misma razón: las RPC
// `recordatorios_pendientes` / `recordatorio_registrar` / `recordatorio_respuesta`
// están revocadas para anon y authenticated, así que solo las puede llamar el
// service_role — y esa llave no debe andar dentro de un nodo de n8n. Esta
// function la usa por dentro y hacia afuera pide el mismo x-webhook-secret que
// ya usan los nodos de captación y de calentamiento.
//
// Auth: header X-Webhook-Secret (BOT_HANDOFF_SECRET).
//
// Body:
//   { "accion": "cola", "limite"?: 50 }
//       -> { recordatorios: [ { agendamiento_id, lead_id, telefono, nombre,
//                               primer_nombre, tipo, modo, fecha_inicio,
//                               fecha_local, hora_local, meet_link, cuerpo,
//                               plantilla_nombre, plantilla_idioma,
//                               minutos_restan } ] }
//
//       `tipo`  = "previo" (T-5 h, pide confirmar) | "inminente" (T-1 h)
//       `modo`  = "libre" si la ventana de 24 h de WhatsApp está abierta
//                 (manda `cuerpo` como texto) | "plantilla" si está cerrada
//                 (manda la HSM `plantilla_nombre|plantilla_idioma`).
//       Es LA bifurcación del workflow: fuera de la ventana un texto libre
//       no sale, Meta lo rechaza.
//
//   { "accion": "registrar", "agendamiento_id": "...", "tipo": "previo",
//     "modo"?: "libre" }
//       -> { ok: true }   se llama DESPUÉS de que WhatsApp aceptó el envío.
//       El UNIQUE (agendamiento_id, tipo) hace que un reintento no mande
//       el mismo recordatorio dos veces.
//
//   { "accion": "respuesta", "telefono": "...", "texto": "Confirmo", "forzar"?: false }
//       -> { accion: "confirmada" | "reagendar" | "sin_clasificar" | "sin_reunion", ... }
//       Lo llama el bot cuando entra un mensaje: si el lead tocó un botón
//       del recordatorio, deja la reunión confirmada y avisa al vendedor.
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
      const { data, error } = await supabase.rpc("recordatorios_pendientes", { _limite: limite });
      if (error) throw error;
      return json({ recordatorios: data ?? [], total: (data ?? []).length });
    }

    if (accion === "registrar") {
      const agendamiento_id = typeof body?.agendamiento_id === "string" ? body.agendamiento_id : "";
      const tipo = typeof body?.tipo === "string" ? body.tipo : "";
      if (!agendamiento_id || !tipo) return json({ error: "agendamiento_id y tipo requeridos" }, 400);
      const { data, error } = await supabase.rpc("recordatorio_registrar", {
        _agendamiento_id: agendamiento_id,
        _tipo: tipo,
        _modo: typeof body?.modo === "string" ? body.modo : null,
      });
      if (error) throw error;
      return json({ ok: data === true, agendamiento_id, tipo });
    }

    if (accion === "respuesta") {
      const telefono = typeof body?.telefono === "string" ? body.telefono : "";
      const texto = typeof body?.texto === "string" ? body.texto : "";
      if (!telefono) return json({ error: "telefono requerido" }, 400);
      const { data, error } = await supabase.rpc("recordatorio_respuesta", {
        _telefono: telefono,
        _texto: texto,
        // Por defecto solo se interpreta si el recordatorio de T-5 h salió de
        // verdad: sin eso, cualquier "dale" de una conversación normal
        // marcaría la reunión como confirmada.
        _forzar: body?.forzar === true,
      });
      if (error) throw error;
      return json(data ?? { accion: "sin_reunion" });
    }

    return json({ error: `accion desconocida: ${accion}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("recordatorios-cola error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

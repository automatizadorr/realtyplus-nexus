// Webhook de eventos de Resend → actualiza public.correo_envios.
// Endpoint público (verify_jwt=false); la seguridad la da la firma Svix de Resend.
// Configurar en Resend → Webhooks: URL de esta función + secreto → RESEND_WEBHOOK_SECRET.
// Eventos: email.delivered (recibió), email.opened (abrió), email.clicked,
//          email.bounced (rebotó), email.complained (queja).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Prioridad de estado: no "degradar" (p. ej. un delivered tardío no pisa un opened).
const PRIORIDAD: Record<string, number> = {
  enviado: 1, entregado: 2, abierto: 3, click: 4, rebotado: 9, quejado: 9, fallido: 9,
};

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// Verificación de firma Svix (el esquema que usa Resend).
async function verifySvix(secret: string, headers: Headers, payload: string): Promise<boolean> {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const key = b64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = `${id}.${ts}.${payload}`;
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signed));
  const expected = bytesToB64(mac);
  // El header trae una o más firmas "v1,<sig>" separadas por espacio.
  return sigHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    return sig === expected;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

    const raw = await req.text();

    // Si hay secreto configurado, verificamos la firma; si no, aceptamos con aviso
    // (recomendado fijarlo cuanto antes).
    if (SECRET) {
      const ok = await verifySvix(SECRET, req.headers, raw);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Firma inválida" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("resend-webhook: RESEND_WEBHOOK_SECRET no configurado; aceptando sin verificar firma.");
    }

    const evt = JSON.parse(raw);
    const type: string = (evt?.type ?? "").toString();
    const data = evt?.data ?? {};
    const resendId: string = (data?.email_id ?? data?.id ?? "").toString();
    const to: string = Array.isArray(data?.to) ? (data.to[0] ?? "") : (data?.to ?? "");
    const nowIso = new Date().toISOString();

    if (!resendId) {
      return new Response(JSON.stringify({ ok: true, skipped: "sin email_id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // type → estado + campo de fecha
    const map: Record<string, { estado: string; campo?: string; contador?: string }> = {
      "email.sent":              { estado: "enviado" },
      "email.delivered":         { estado: "entregado", campo: "entregado_at" },
      "email.opened":            { estado: "abierto",  campo: "abierto_at", contador: "opens" },
      "email.clicked":           { estado: "click",    campo: "click_at",  contador: "clicks" },
      "email.bounced":           { estado: "rebotado", campo: "rebotado_at" },
      "email.delivery_delayed":  { estado: "enviado" },
      "email.complained":        { estado: "quejado" },
    };
    const m = map[type];
    if (!m) {
      return new Response(JSON.stringify({ ok: true, ignored: type }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: row } = await svc
      .from("correo_envios")
      .select("id, estado, opens, clicks, abierto_at, click_at, entregado_at")
      .eq("resend_id", resendId)
      .maybeSingle();

    const patch: Record<string, unknown> = { ultimo_evento_at: nowIso };
    // No degradar el estado.
    const curPr = row ? (PRIORIDAD[row.estado] ?? 0) : 0;
    if ((PRIORIDAD[m.estado] ?? 0) >= curPr) patch.estado = m.estado;
    // Fecha del evento (solo la primera vez para abierto/click).
    if (m.campo) {
      const existing = row ? (row as Record<string, unknown>)[m.campo] : null;
      if (!existing) patch[m.campo] = nowIso;
    }
    if (m.contador) {
      const cur = row ? Number((row as Record<string, number>)[m.contador] ?? 0) : 0;
      patch[m.contador] = cur + 1;
    }
    if (type === "email.bounced") patch.error = (data?.bounce?.message ?? data?.reason ?? "bounce").toString().slice(0, 300);

    if (row) {
      await svc.from("correo_envios").update(patch).eq("id", row.id);
    } else {
      // El evento llegó antes que el registro de envío: creamos la fila.
      await svc.from("correo_envios").insert({
        resend_id: resendId, email: to || "(desconocido)", estado: m.estado,
        enviado_at: nowIso, ...patch,
      });
    }

    return new Response(JSON.stringify({ ok: true, type, resendId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("resend-webhook error:", msg);
    // Devolvemos 200 para que Resend no reintente indefinidamente por errores de parseo.
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

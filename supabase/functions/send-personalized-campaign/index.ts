// Envío de correos personalizados vía Resend.
// Requiere caller autenticado con rol admin (misma política que send-n8n-webhook).
// El secreto RESEND_API_KEY se guarda en los secrets del proyecto Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Recipient = {
  email: string;
  empresa?: string;
  ciudad?: string;
  gancho?: string;
};

// Reemplaza {{empresa}}, {{ciudad}}, {{gancho}} (y alias en mayúscula) en una plantilla.
function fillTemplate(tpl: string, r: Recipient): string {
  const map: Record<string, string> = {
    empresa: r.empresa ?? "",
    ciudad: r.ciudad ?? "",
    gancho: r.gancho ?? "",
  };
  return tpl.replace(/\{\{\s*(empresa|ciudad|gancho)\s*\}\}/gi, (_m, key) => map[key.toLowerCase()] ?? "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado en el proyecto" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: Bearer + rol admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: se requiere rol admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Payload ---
    const body = await req.json();
    const fromName: string = (body?.fromName ?? "Mario · LexHouse").toString();
    const fromEmail: string = (body?.fromEmail ?? "no-reply@send.lexhouse-ai.com").toString();
    const replyTo: string | undefined = body?.replyTo ? body.replyTo.toString() : undefined;
    const subjectTpl: string = (body?.subject ?? "").toString();
    const htmlTpl: string = (body?.html ?? "").toString();
    const textTpl: string = (body?.text ?? "").toString();
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];

    if (!subjectTpl.trim() || (!htmlTpl.trim() && !textTpl.trim())) {
      return new Response(JSON.stringify({ error: "Falta asunto o cuerpo del correo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Destinatarios válidos y deduplicados.
    const seen = new Set<string>();
    const valid = recipients.filter((r) => {
      const e = (r?.email ?? "").trim().toLowerCase();
      if (!e || !EMAIL_RE.test(e) || seen.has(e)) return false;
      seen.add(e);
      r.email = e;
      return true;
    });
    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: "No hay destinatarios válidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (valid.length > 200) {
      return new Response(JSON.stringify({ error: "Máximo 200 destinatarios por envío" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = `${fromName} <${fromEmail}>`;
    const results: { email: string; ok: boolean; id?: string; error?: string }[] = [];
    // Filas para el log de seguimiento (correo_envios).
    const logRows: Record<string, unknown>[] = [];
    const userId = userData.user.id;
    let sent = 0, failed = 0;

    for (const r of valid) {
      const subject = fillTemplate(subjectTpl, r);
      const payload: Record<string, unknown> = {
        from,
        to: [r.email],
        subject,
      };
      if (replyTo) payload.reply_to = replyTo;
      if (htmlTpl.trim()) payload.html = fillTemplate(htmlTpl, r);
      if (textTpl.trim()) payload.text = fillTemplate(textTpl, r);
      // List-Unsubscribe: mejora la reputación/entregabilidad (baja 1 clic por email).
      const unsubTo = replyTo || fromEmail;
      payload.headers = {
        "List-Unsubscribe": `<mailto:${unsubTo}?subject=baja>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.id) {
          results.push({ email: r.email, ok: true, id: data.id });
          logRows.push({ resend_id: data.id, email: r.email, empresa: r.empresa ?? null, asunto: subject, enviado_por: userId, estado: "enviado" });
          sent++;
        } else {
          const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
          results.push({ email: r.email, ok: false, error: String(errMsg) });
          logRows.push({ email: r.email, empresa: r.empresa ?? null, asunto: subject, enviado_por: userId, estado: "fallido", error: String(errMsg).slice(0, 300) });
          failed++;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        results.push({ email: r.email, ok: false, error: errMsg });
        logRows.push({ email: r.email, empresa: r.empresa ?? null, asunto: subject, enviado_por: userId, estado: "fallido", error: errMsg.slice(0, 300) });
        failed++;
      }
      // Pequeña pausa para respetar el rate limit de Resend (~2 req/s).
      await new Promise((r) => setTimeout(r, 550));
    }

    // Registrar los envíos para el panel de seguimiento (no bloquea la respuesta si falla).
    if (logRows.length) {
      const { error: logErr } = await svc.from("correo_envios").insert(logRows);
      if (logErr) console.error("correo_envios insert error:", logErr.message);
    }

    return new Response(JSON.stringify({ success: true, sent, failed, total: valid.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-personalized-campaign error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

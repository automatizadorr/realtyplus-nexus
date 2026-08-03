// CRON de SECUENCIAS DE CORREOS.
// Pensado para correr en AUTOMÁTICO cada 15 minutos desde pg_cron.
// 1. Toma las filas de secuencia_envios_programados con estado='pendiente'
//    y enviar_en <= ahora (hasta 50 por corrida).
// 2. Envía cada correo vía Resend (from_name/from_email/reply_to del snapshot).
// 3. Registra el envío en correo_envios (con secuencia_nombre/paso) para el
//    panel de seguimiento y la columna "Último correo" del tab Leads de campaña.
// 4. Marca la fila como enviado/fallido.
// Auth: header X-Webhook-Secret (AUTO_TAG_CRON_SECRET o CRON_SECRET).
// En config.toml: verify_jwt = false (lo llama pg_cron, no el navegador).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_POR_CORRIDA = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reemplaza {{variable}} en una plantilla. Resuelve las columnas fijas del
// snapshot (empresa, ciudad, gancho, nombre, email) y CUALQUIER columna del
// sheet guardada en el jsonb `datos` (web, telefono, instagram, region, ...).
function fillTemplate(tpl: string, r: Record<string, unknown>): string {
  const datos = (typeof r.datos === "object" && r.datos !== null ? r.datos : {}) as Record<string, unknown>;
  const map: Record<string, string> = {
    email: (r.email as string) ?? "",
    empresa: (r.empresa as string) ?? "",
    ciudad: (r.ciudad as string) ?? "",
    gancho: (r.gancho as string) ?? "",
    pais: (r.pais as string) || (datos.pais as string) || (datos.country as string) || "",
    // {{nombre}} nunca queda vacío: cae al nombre de la empresa.
    nombre: (r.nombre as string) || (r.empresa as string) || "",
  };
  for (const [k, v] of Object.entries(datos)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) map[k.toLowerCase()] = s;
  }
  return tpl.replace(/\{\{\s*([\w\-.]+)\s*\}\}/gi, (_m, key) => map[key.toLowerCase()] ?? "");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// HTML simple y con marca (azul #003DA5, CTA a la guía), compatible con clientes de correo.
function buildHtml(body: string, ctaTexto: string, ctaUrl: string): string {
  const paras = body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#1f2937;">${esc(p)}</p>`)
    .join("");
  const cta = ctaTexto && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:8px;background:#003DA5;padding:12px 28px;"><a href="${esc(ctaUrl)}" target="_blank" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${esc(ctaTexto)}</a></td></tr></table>`
    : "";
  return `<div style="background:#f4f6fa;padding:24px 12px;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#003DA5;font-weight:700;margin-bottom:18px;">LexHouse</div>
  ${paras}${cta}
  <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">LexHouse · Inteligencia artificial para corredoras de propiedades. Si no quieres recibir más correos, responde este mensaje y te damos de baja.</p>
  </div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const CRON_SECRET = Deno.env.get("AUTO_TAG_CRON_SECRET") || Deno.env.get("CRON_SECRET");
    const incoming = req.headers.get("x-webhook-secret") ?? "";
    const authorized =
      (!!CRON_SECRET && incoming === CRON_SECRET) ||
      (!!WEBHOOK_SECRET && incoming === WEBHOOK_SECRET);
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Pendientes vencidos ---
    const { data: pendientes, error: qErr } = await svc
      .from("secuencia_envios_programados")
      .select("*")
      .eq("estado", "pendiente")
      .lte("enviar_en", new Date().toISOString())
      .order("enviar_en", { ascending: true })
      .limit(MAX_POR_CORRIDA);
    if (qErr) {
      return new Response(JSON.stringify({ error: qErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enviados = 0, fallidos = 0;

    for (const row of pendientes ?? []) {
      const email: string = (row.email ?? "").toString().trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        await svc.from("secuencia_envios_programados")
          .update({ estado: "fallido", error: "email inválido", enviado_at: new Date().toISOString() })
          .eq("id", row.id);
        fallidos++;
        continue;
      }

      const subject = fillTemplate(row.asunto ?? "", row);
      const html = buildHtml(fillTemplate(row.cuerpo ?? "", row), row.cta_texto ?? "", row.cta_url ?? "");
      const from = `${row.from_name ?? "Mario · LexHouse"} <${row.from_email ?? "no-reply@send.lexhouse-ai.com"}>`;
      const payload: Record<string, unknown> = {
        from,
        to: [email],
        subject,
        html,
      };
      const replyTo = row.reply_to as string | null;
      if (replyTo && EMAIL_RE.test(replyTo)) {
        payload.reply_to = replyTo;
        payload.headers = {
          "List-Unsubscribe": `<mailto:${replyTo}?subject=baja>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        };
      }

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
          await svc.from("correo_envios").insert({
            resend_id: data.id,
            email,
            nombre: row.nombre ?? null,
            empresa: row.empresa ?? null,
            pais: (row.pais as string) || null,
            asunto: subject,
            enviado_por: row.creado_por ?? null,
            estado: "enviado",
            secuencia_nombre: row.secuencia_nombre ?? null,
            secuencia_paso: row.paso ?? null,
          });
          await svc.from("secuencia_envios_programados")
            .update({ estado: "enviado", enviado_at: new Date().toISOString(), resend_id: data.id, error: null })
            .eq("id", row.id);
          enviados++;
        } else {
          const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
          await svc.from("secuencia_envios_programados")
            .update({ estado: "fallido", enviado_at: new Date().toISOString(), error: String(errMsg).slice(0, 300) })
            .eq("id", row.id);
          fallidos++;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await svc.from("secuencia_envios_programados")
          .update({ estado: "fallido", enviado_at: new Date().toISOString(), error: errMsg.slice(0, 300) })
          .eq("id", row.id);
        fallidos++;
      }
      // Respetar el rate limit de Resend (~2 req/s).
      await new Promise((r) => setTimeout(r, 550));
    }

    return new Response(JSON.stringify({ success: true, procesados: (pendientes ?? []).length, enviados, fallidos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-secuencias-correo error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Proxies n8n webhook calls. Requires authenticated admin caller.
// Adds X-Webhook-Secret header so n8n can reject unauthenticated callers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEBHOOKS: Record<string, string> = {
  crmrp: "https://n8n.lexhouse-ai.online/webhook/crmrp",
  oportunidades: "https://n8n.lexhouse-ai.online/webhook/oportunidades",
  campanas_segmentadas: "https://n8n.lexhouse-ai.online/webhook/camapañas_segmentadas",
  primer_contacto: "https://n8n.lexhouse-ai.online/webhook/primer_contacto",
  expansion: "https://n8n.lexhouse-ai.online/webhook/expansion",
  auto_tag_chile: "https://n8n.lexhouse-ai.online/webhook/auto-tag-chile",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");

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
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const target = body?.target as string | undefined;
    const payload = body?.payload;
    if (!target || !WEBHOOKS[target]) {
      return new Response(JSON.stringify({ error: "Invalid target webhook" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "Missing payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Envía a n8n con REINTENTOS. Los fallos transitorios (red caída, timeout,
    // 5xx de n8n) se reintentan hasta 3 veces con backoff (1s, 3s). Los 4xx NO se
    // reintentan (error del cliente: reintentar no ayuda). Cada intento tiene un
    // timeout de 10s para que un fetch colgado no bloquee la función indefinidamente.
    // Prioriza ENTREGAR el mensaje al lead: un mensaje perdido es peor que un
    // eventual duplicado si n8n procesó pero tardó en responder.
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [1000, 3000]; // espera antes del intento 2 y 3
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    let lastStatus = 0;
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(WEBHOOKS[target], {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(WEBHOOK_SECRET ? { "X-Webhook-Secret": WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        const text = await res.text();
        if (res.ok) {
          return new Response(JSON.stringify({ success: true, response: text, attempts: attempt }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // 4xx: error del cliente (payload/ruta mala) → no reintentar, devolver ya.
        if (res.status < 500) {
          return new Response(JSON.stringify({ success: false, warning: "n8n webhook 4xx", status: res.status, attempts: attempt }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // 5xx: error transitorio del servidor → reintentar.
        lastStatus = res.status;
        lastError = `n8n non-2xx (${res.status})`;
        console.warn(`n8n webhook intento ${attempt}/${MAX_ATTEMPTS}: status ${res.status}`);
      } catch (fetchErr) {
        // Error de red o timeout (el mensaje casi seguro no llegó) → reintentar.
        lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.warn(`n8n webhook intento ${attempt}/${MAX_ATTEMPTS} falló:`, lastError);
      }
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
    }
    // Agotados los reintentos: el frontend marca el mensaje como fallido y ofrece reintentar.
    return new Response(JSON.stringify({ success: false, warning: "n8n unreachable tras reintentos", status: lastStatus, error: lastError, attempts: MAX_ATTEMPTS }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-n8n-webhook error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

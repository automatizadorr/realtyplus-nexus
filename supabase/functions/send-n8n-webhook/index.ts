// Proxies n8n webhook calls. Requires authenticated admin caller.
// Adds X-Webhook-Secret header so n8n can reject unauthenticated callers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEBHOOKS: Record<string, string> = {
  crmrp: "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/crmrp",
  campanas_segmentadas: "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/camapañas_segmentadas",
  primer_contacto: "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/primer_contacto",
  expansion: "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/expansion",
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

    try {
      const res = await fetch(WEBHOOKS[target], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(WEBHOOK_SECRET ? { "X-Webhook-Secret": WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) {
        return new Response(JSON.stringify({ success: true, warning: "n8n webhook non-2xx", status: res.status }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, response: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn("n8n webhook unreachable:", msg);
      // Don't fail the request — webhook delivery is best-effort.
      return new Response(JSON.stringify({ success: true, warning: "n8n unreachable", error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-n8n-webhook error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

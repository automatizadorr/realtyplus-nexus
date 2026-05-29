// Returns ALL leads from Google Sheets (Sheet4), optionally filtered by country.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SHEET_ID = "17CnhYEbTUrSGUhu9-e2cZo_vkPu4nLkta7ksXwrFnCs";
const RANGE = "Sheet4!A2:G20000";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth guard + admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* ignore */ }
    }
    const filterCountry: string | null = (body?.pais || null)?.toString().trim() || null;
    const onlyUncontacted: boolean = !!body?.solo_no_contactados;
    const phonesList: string[] = Array.isArray(body?.telefonos) ? body.telefonos.map(String) : [];

    const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets gateway error [${res.status}]: ${JSON.stringify(json)}`);

    const rows: string[][] = json.values || [];
    const normPhone = (p: string) => (p || "").replace(/\D/g, "");
    const phoneSet = new Set(phonesList.map(normPhone).filter(Boolean));

    let leads = rows.map((r) => ({
      id_contacto: (r[0] || "").trim(),
      nombres: (r[1] || "").trim(),
      apellidos: (r[2] || "").trim(),
      email: (r[3] || "").trim(),
      telefono: (r[4] || "").trim(),
      pais: (r[5] || "Sin país").trim() || "Sin país",
      dias_transcurridos: Number(r[6]) || 0,
    }));

    if (filterCountry) {
      leads = leads.filter((l) => l.pais.toLowerCase() === filterCountry.toLowerCase());
    }
    if (onlyUncontacted && phoneSet.size > 0) {
      leads = leads.filter((l) => phoneSet.has(normPhone(l.telefono)));
    }

    return new Response(
      JSON.stringify({ success: true, total: leads.length, pais: filterCountry, leads }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sheets-leads error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

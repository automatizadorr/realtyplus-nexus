// Aggregates KPIs by country from Google Sheets (Sheet4 of realtyplus leads).
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
    // Auth guard: require a valid Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sheets gateway error [${res.status}]: ${JSON.stringify(json)}`);

    const rows: string[][] = json.values || [];
    const byCountry = new Map<string, { total: number; sumDias: number; recientes: number }>();
    let total = 0;
    for (const r of rows) {
      const pais = (r[5] || "Sin país").trim() || "Sin país";
      const dias = Number(r[6]) || 0;
      const cur = byCountry.get(pais) || { total: 0, sumDias: 0, recientes: 0 };
      cur.total += 1;
      cur.sumDias += dias;
      if (dias <= 7) cur.recientes += 1;
      byCountry.set(pais, cur);
      total += 1;
    }
    const countries = Array.from(byCountry.entries())
      .map(([pais, v]) => ({
        pais,
        total: v.total,
        recientes_7d: v.recientes,
        promedio_dias: v.total > 0 ? +(v.sumDias / v.total).toFixed(1) : 0,
        pct: total > 0 ? +((v.total / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return new Response(
      JSON.stringify({ success: true, total_contactos: total, total_paises: countries.length, countries }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sheets-country-kpis error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

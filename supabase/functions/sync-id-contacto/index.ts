// Sync ID_CONTACTO from Google Sheets (Sheet4) into leads_campana matched by email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHEET_ID = "17CnhYEbTUrSGUhu9-e2cZo_vkPu4nLkta7ksXwrFnCs";
const RANGE = "Sheet4!A2:E10000"; // ID_CONTACTO, NOMBRES, APELLIDOS, EMAIL, TELEFONO
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    const sheetRes = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const sheetJson = await sheetRes.json();
    if (!sheetRes.ok) {
      throw new Error(`Sheets gateway error [${sheetRes.status}]: ${JSON.stringify(sheetJson)}`);
    }
    const rows: string[][] = sheetJson.values || [];

    // Build email -> id_contacto map (last wins)
    const byEmail = new Map<string, string>();
    for (const r of rows) {
      const id = (r[0] || "").trim();
      const email = (r[3] || "").trim().toLowerCase();
      if (id && email) byEmail.set(email, id);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get all leads that have an email
    const { data: leads, error: leadsErr } = await supabase
      .from("leads_campana")
      .select("id, email, id_contacto")
      .not("email", "is", null);
    if (leadsErr) throw leadsErr;

    let updated = 0;
    let unchanged = 0;
    let unmatched = 0;
    const batchUpdates: { id: string; id_contacto: string }[] = [];

    for (const lead of leads || []) {
      const email = (lead.email || "").trim().toLowerCase();
      if (!email) continue;
      const newId = byEmail.get(email);
      if (!newId) {
        unmatched++;
        continue;
      }
      if (lead.id_contacto === newId) {
        unchanged++;
        continue;
      }
      batchUpdates.push({ id: lead.id, id_contacto: newId });
    }

    // Execute updates in chunks
    const chunkSize = 200;
    for (let i = 0; i < batchUpdates.length; i += chunkSize) {
      const chunk = batchUpdates.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((u) =>
          supabase
            .from("leads_campana")
            .update({ id_contacto: u.id_contacto })
            .eq("id", u.id)
            .then(({ error }) => {
              if (error) console.error("update error", u.id, error.message);
              else updated++;
            }),
        ),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sheet_rows: rows.length,
        sheet_unique_emails: byEmail.size,
        leads_with_email: leads?.length || 0,
        updated,
        unchanged,
        unmatched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync-id-contacto error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

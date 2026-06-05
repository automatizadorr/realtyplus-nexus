// Espeja Google Sheet4 -> tabla public.leads_sheet (upsert).
// Lo llama el cron (header X-Resync-Secret) o un admin autenticado (manual).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-resync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHEET_ID = "17CnhYEbTUrSGUhu9-e2cZo_vkPu4nLkta7ksXwrFnCs";
const RANGE = "Sheet4!A2:G20000";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESYNC_SECRET = Deno.env.get("RESYNC_SECRET");

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Auth: secreto del cron O admin autenticado ---
    const secretHeader = req.headers.get("X-Resync-Secret");
    const isCron = !!RESYNC_SECRET && secretHeader === RESYNC_SECRET;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      const { data: isAdmin } = await svc.rpc("has_role", {
        _user_id: userData.user.id, _role: "admin",
      });
      if (!isAdmin) return json({ error: "Forbidden: admin role required" }, 403);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    // --- Leer Sheet4 vía gateway ---
    const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const sheetJson = await res.json();
    if (!res.ok) throw new Error(`Sheets gateway error [${res.status}]: ${JSON.stringify(sheetJson)}`);

    const rows: string[][] = sheetJson.values || [];
    const normPhone = (p: string) => (p || "").replace(/\D/g, "");
    const now = new Date().toISOString();

    // Mapear filas; clave de upsert = id_contacto, fallback 'tel:<telefono>'.
    // Deduplicar por clave (la última gana) para evitar choques en el upsert.
    const byKey = new Map<string, Record<string, unknown>>();
    let skipped = 0;
    for (const r of rows) {
      const idRaw = (r[0] || "").trim();
      const telefono = (r[4] || "").trim();
      const key = idRaw || (normPhone(telefono) ? `tel:${normPhone(telefono)}` : "");
      if (!key) { skipped++; continue; } // fila sin id ni teléfono → no se puede identificar
      byKey.set(key, {
        id_contacto: key,
        nombres: (r[1] || "").trim(),
        apellidos: (r[2] || "").trim(),
        email: (r[3] || "").trim(),
        telefono,
        pais: (r[5] || "Sin país").trim() || "Sin país",
        dias_transcurridos: Number(r[6]) || 0,
        synced_at: now,
      });
    }
    const records = Array.from(byKey.values());

    // Upsert en chunks
    let upserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await svc.from("leads_sheet").upsert(chunk, { onConflict: "id_contacto" });
      if (error) throw new Error(`upsert error: ${error.message}`);
      upserted += chunk.length;
    }

    return json({ success: true, sheet_rows: rows.length, upserted, skipped }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("resync-leads-sheet error:", msg);
    return json({ success: false, error: msg }, 500);
  }

  function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

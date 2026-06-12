// Actualiza el teléfono de un lead en el Google Sheet (Sheet4 col E) y
// propaga el cambio a las tablas DB que referencian ese teléfono.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHEET_ID = "17CnhYEbTUrSGUhu9-e2cZo_vkPu4nLkta7ksXwrFnCs";
const SHEET_NAME = "Sheet4";
const RANGE = `${SHEET_NAME}!A2:G20000`;
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

const normPhone = (p: string) => (p || "").replace(/\D/g, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");

    // Auth + admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const oldPhoneRaw = String(body?.oldPhone || "").trim();
    const newPhoneRaw = String(body?.newPhone || "").trim();
    if (!oldPhoneRaw || !newPhoneRaw) return json({ error: "oldPhone y newPhone son requeridos" }, 400);

    const oldNorm = normPhone(oldPhoneRaw);
    const newNorm = normPhone(newPhoneRaw);
    if (!oldNorm || !newNorm) return json({ error: "Teléfonos inválidos" }, 400);
    if (oldNorm === newNorm) return json({ success: true, unchanged: true });

    const result: Record<string, unknown> = {
      sheet_updated: false,
      sheet_rows: 0,
      leads_sheet_updated: 0,
      leads_campana_updated: 0,
      leads_escaner_updated: 0,
      mensajes_updated: 0,
    };

    // 1) Google Sheet (best-effort: si faltan credenciales lo saltamos)
    if (LOVABLE_API_KEY && GOOGLE_SHEETS_API_KEY) {
      try {
        const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${RANGE}`, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
          },
        });
        const sj = await res.json();
        if (res.ok) {
          const rows: string[][] = sj.values || [];
          const updates: { range: string; values: string[][] }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const cell = rows[i][4] || "";
            if (normPhone(cell) === oldNorm) {
              const rowNumber = i + 2; // A2 base
              updates.push({
                range: `${SHEET_NAME}!E${rowNumber}`,
                values: [[newPhoneRaw]],
              });
            }
          }
          if (updates.length > 0) {
            const upRes = await fetch(
              `${GATEWAY}/spreadsheets/${SHEET_ID}/values:batchUpdate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  valueInputOption: "RAW",
                  data: updates,
                }),
              },
            );
            const upJson = await upRes.json();
            if (!upRes.ok) {
              console.error("Sheet batchUpdate error", upJson);
            } else {
              result.sheet_updated = true;
              result.sheet_rows = updates.length;
            }
          }
        } else {
          console.error("Sheet read error", sj);
        }
      } catch (e) {
        console.error("Sheet update failed", e);
      }
    }

    // 2) DB: leads_sheet (telefono variant)
    {
      const { data, error } = await svc
        .from("leads_sheet")
        .update({ telefono: newPhoneRaw })
        .eq("telefono", oldPhoneRaw)
        .select("id_contacto");
      if (!error) result.leads_sheet_updated = (data || []).length;
    }

    // 3) leads_campana
    {
      const { data, error } = await svc
        .from("leads_campana")
        .update({ telefono: newPhoneRaw })
        .eq("telefono", oldPhoneRaw)
        .select("id");
      if (!error) result.leads_campana_updated = (data || []).length;
    }

    // 4) leads_escaner
    {
      const { data, error } = await svc
        .from("leads_escaner")
        .update({ telefono: newPhoneRaw })
        .eq("telefono", oldPhoneRaw)
        .select("id");
      if (!error) result.leads_escaner_updated = (data || []).length;
    }

    // 5) mensajes_whatsapp (para no perder el historial)
    {
      const { data, error } = await svc
        .from("mensajes_whatsapp")
        .update({ telefono: newPhoneRaw })
        .eq("telefono", oldPhoneRaw)
        .select("id");
      if (!error) result.mensajes_updated = (data || []).length;
    }

    return json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("update-lead-phone error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

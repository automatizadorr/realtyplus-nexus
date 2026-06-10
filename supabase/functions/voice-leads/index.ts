// Lee/actualiza el Google Sheet "agente_web" (leads del agente de voz Licia-AI).
// GET  -> lista de leads (header dinámico + filas)
// POST -> { action: "update_status", phone, status } actualiza la columna status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SHEET_ID = "17CnhYEbTUrSGUhu9-e2cZo_vkPu4nLkta7ksXwrFnCs";
const SHEET_NAME = "agente_web";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function colLetter(n: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA
  let s = "";
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode((x % 26) + 65) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

const normPhone = (p: string) => (p || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY missing");

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

    const gwHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      "Content-Type": "application/json",
    };

    // Helper: leer toda la hoja
    async function readSheet() {
      const range = `${SHEET_NAME}!A1:ZZ20000`;
      const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values/${range}`, {
        headers: gwHeaders,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(`Sheets read error [${res.status}]: ${JSON.stringify(j)}`);
      const rows: string[][] = j.values || [];
      const headers = (rows[0] || []).map((h) => (h || "").trim());
      const data = rows.slice(1).map((r, idx) => {
        const obj: Record<string, string> = { __row: String(idx + 2) }; // 1-based + header
        headers.forEach((h, i) => {
          if (!h) return;
          obj[h] = (r[i] ?? "").toString();
        });
        return obj;
      });
      return { headers, data };
    }

    if (req.method === "GET") {
      const { headers, data } = await readSheet();
      const leads = data
        .filter((r) => (r["nombre_completo"] || r["full_name"] || r["telefono"] || "").trim() !== "")
        .map((r) => ({
          row: Number(r.__row),
          nombre: r["nombre_completo"] || r["full_name"] || "",
          telefono: r["telefono"] || r["phone"] || "",
          email: r["email"] || "",
          tipo_interes: r["tipo_interes"] || r["interest_type"] || "",
          modelo_franquicia: r["modelo_franquicia"] || r["franchise_model"] || "",
          ubicacion: r["ubicacion_interes"] || r["location"] || "",
          presupuesto: r["presupuesto"] || r["budget"] || "",
          proposito: r["proposito_compra"] || r["purchase_purpose"] || "",
          horario: r["horario_contacto"] || r["preferred_contact_time"] || "",
          resumen: r["resumen_conversacion"] || r["conversation_summary"] || "",
          informe: r["report"] || r["informe"] || "",
          status: (r["status"] || "new").toLowerCase().trim(),
          source: r["source"] || "",
          created_at: r["created_at"] || "",
          tags: r["tags"] || "",
        }))
        .reverse();
      return json({ success: true, total: leads.length, headers, leads });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = body?.action;

      if (action === "update_status") {
        const phone = String(body?.phone || "").trim();
        const status = String(body?.status || "").trim();
        if (!phone || !status) return json({ error: "phone & status required" }, 400);

        const { headers, data } = await readSheet();
        // Asegurar columna status
        let statusIdx = headers.indexOf("status");
        if (statusIdx === -1) {
          statusIdx = headers.length;
          const cell = `${SHEET_NAME}!${colLetter(statusIdx)}1`;
          const r = await fetch(
            `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${cell}?valueInputOption=RAW`,
            {
              method: "PUT",
              headers: gwHeaders,
              body: JSON.stringify({ values: [["status"]] }),
            },
          );
          if (!r.ok) throw new Error(`add status header failed: ${await r.text()}`);
        }

        // Buscar fila por teléfono (normalizado)
        const target = data.find(
          (row) =>
            normPhone(row["telefono"] || row["phone"] || "") === normPhone(phone),
        );
        if (!target) return json({ error: "lead not found" }, 404);

        const rowNum = target.__row;
        const cell = `${SHEET_NAME}!${colLetter(statusIdx)}${rowNum}`;
        const upd = await fetch(
          `${GATEWAY}/spreadsheets/${SHEET_ID}/values/${cell}?valueInputOption=RAW`,
          {
            method: "PUT",
            headers: gwHeaders,
            body: JSON.stringify({ values: [[status]] }),
          },
        );
        const updJson = await upd.json();
        if (!upd.ok) throw new Error(`update failed: ${JSON.stringify(updJson)}`);
        return json({ success: true, row: rowNum, status });
      }

      return json({ error: "unknown action" }, 400);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("voice-leads error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

// Devuelve los leads desde la tabla espejo public.leads_sheet (poblada por
// resync-leads-sheet). Mismo contrato de salida que la versión Google Sheets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* ignore */ }
    }
    const filterCountry: string | null = (body?.pais || null)?.toString().trim() || null;
    const onlyUncontacted: boolean = !!body?.solo_no_contactados;
    const phonesList: string[] = Array.isArray(body?.telefonos) ? body.telefonos.map(String) : [];

    // Leer de la tabla espejo (service role: ignora RLS)
    let query = svc
      .from("leads_sheet")
      .select("id_contacto, nombres, apellidos, email, telefono, pais, dias_transcurridos");
    if (filterCountry) query = query.ilike("pais", filterCountry); // ilike sin % = igualdad case-insensitive
    const { data, error } = await query;
    if (error) throw new Error(`leads_sheet read error: ${error.message}`);

    const normPhone = (p: string) => (p || "").replace(/\D/g, "");
    const phoneSet = new Set(phonesList.map(normPhone).filter(Boolean));

    let leads = (data || []).map((l: any) => ({
      // Los ids sintéticos 'tel:<telefono>' se devuelven vacíos (mismo comportamiento que el Sheet sin id)
      id_contacto: typeof l.id_contacto === "string" && l.id_contacto.startsWith("tel:") ? "" : (l.id_contacto || ""),
      nombres: l.nombres || "",
      apellidos: l.apellidos || "",
      email: l.email || "",
      telefono: l.telefono || "",
      pais: (l.pais || "Sin país") || "Sin país",
      dias_transcurridos: Number(l.dias_transcurridos) || 0,
    }));

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

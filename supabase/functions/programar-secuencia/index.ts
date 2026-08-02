// Programa una secuencia de correos (embudo con guías).
// Crea una fila en secuencia_envios_programados POR contacto y POR paso,
// con enviar_en calculado = fecha_inicio + dias_desde_inicio a la hora
// local de Chile (America/Santiago). El cron `cron-secuencias-correo`
// envía los que vencen vía Resend.
// Auth: Bearer + rol admin (mismo patrón que send-personalized-campaign).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TZ = "America/Santiago";
const MAX_DESTINATARIOS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Convierte "2026-08-02 09:00" en hora local de `tz` a un instante UTC.
// Truco estándar: adivina UTC, lee qué hora local representa en ese tz y corrige.
function zonedToUtc(ymd: string, hhmm: string, tz: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (asUTC - guess)).toISOString();
}

type Recipient = { email: string; empresa?: string; ciudad?: string; gancho?: string; nombre?: string; datos?: Record<string, unknown> };
type PasoOverride = { paso: number; hora?: string; asunto?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: se requiere rol admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Payload ---
    const body = await req.json();
    const secuenciaId: string = (body?.secuencia_id ?? "").toString();
    const fechaInicio: string = (body?.fecha_inicio ?? "").toString();
    const pasosOverride: PasoOverride[] = Array.isArray(body?.pasos) ? body.pasos : [];
    const destinatarios: Recipient[] = Array.isArray(body?.destinatarios) ? body.destinatarios : [];
    const fromName: string = (body?.fromName ?? "Mario · LexHouse").toString();
    const fromEmail: string = (body?.fromEmail ?? "no-reply@send.lexhouse-ai.com").toString();
    const replyTo: string | undefined = body?.replyTo ? body.replyTo.toString() : undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
      return new Response(JSON.stringify({ error: "fecha_inicio debe ser YYYY-MM-DD" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Secuencia + pasos desde la BD ---
    const { data: sec, error: secErr } = await svc
      .from("secuencias_correo")
      .select("id, nombre, total_pasos")
      .eq("id", secuenciaId)
      .single();
    if (secErr || !sec) {
      return new Response(JSON.stringify({ error: "Secuencia no encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pasos, error: pasosErr } = await svc
      .from("secuencias_correo_pasos")
      .select("*")
      .eq("secuencia_id", secuenciaId)
      .order("paso", { ascending: true });
    if (pasosErr || !pasos?.length) {
      return new Response(JSON.stringify({ error: "La secuencia no tiene pasos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Destinatarios válidos y deduplicados ---
    const seen = new Set<string>();
    const valid = destinatarios.filter((r) => {
      const e = (r?.email ?? "").trim().toLowerCase();
      if (!e || !EMAIL_RE.test(e) || seen.has(e)) return false;
      seen.add(e);
      r.email = e;
      return true;
    });
    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: "No hay destinatarios válidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (valid.length > MAX_DESTINATARIOS) {
      return new Response(JSON.stringify({ error: `Máximo ${MAX_DESTINATARIOS} destinatarios por secuencia` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Overrides por paso (hora y asunto editables desde la UI) ---
    const overrides = new Map<number, PasoOverride>();
    for (const p of pasosOverride) {
      if (typeof p.paso !== "number") continue;
      overrides.set(p.paso, p);
    }

    // --- Armar filas: contacto × paso, con hora calculada ---
    const rows: Record<string, unknown>[] = [];
    let programados = 0;
    for (const r of valid) {
      for (const p of pasos) {
        const ov = overrides.get(p.paso);
        const hora: string = (ov?.hora && HORA_RE.test(ov.hora) ? ov.hora : p.hora_envio) ?? "09:00";
        const asunto: string = (ov?.asunto && ov.asunto.trim() ? ov.asunto : p.asunto) ?? "";
        rows.push({
          secuencia_id: sec.id,
          secuencia_nombre: sec.nombre,
          email: r.email,
          empresa: r.empresa ?? null,
          ciudad: r.ciudad ?? null,
          gancho: r.gancho ?? null,
          nombre: r.nombre ?? null,
          datos: r.datos && Object.keys(r.datos).length ? r.datos : null,
          paso: p.paso,
          asunto,
          cuerpo: p.cuerpo,
          cta_texto: p.cta_texto,
          cta_url: p.cta_url,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo ?? null,
          enviar_en: zonedToUtc(fechaInicio, hora, TZ),
          creado_por: userId,
        });
        programados++;
      }
    }

    const { error: insErr } = await svc.from("secuencia_envios_programados").insert(rows);
    if (insErr) {
      return new Response(JSON.stringify({ error: `No se pudo programar: ${insErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      programados,
      contactos: valid.length,
      pasos: pasos.length,
      secuencia: sec.nombre,
      primer_envio: rows[0]?.enviar_en,
      aviso: "El cron envía automáticamente cada 15 minutos; la hora es local de Chile.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("programar-secuencia error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

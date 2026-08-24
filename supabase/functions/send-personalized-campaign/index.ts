// Envío de correos personalizados vía Resend.
// Admin: sin restricción de destinatarios. Vendedor: SOLO puede mandar a
// emails que sean de SUS leads_campana asignados (se filtran server-side,
// nunca confiando en el cliente) — mismo criterio que send-n8n-webhook.
// El secreto RESEND_API_KEY se guarda en los secrets del proyecto Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { applyDomain, corsHeaders, EMAIL_RE, fillTemplate, limiteDiaPara, normalizarModo, pickPais, resendKeyFor, TZ, zonedToUtc } from "../_shared/correo.ts";

// Inicio del día de HOY en la zona horaria del negocio, como instante UTC
// (para contar cuántos correos ya mandó un vendedor "hoy").
function inicioDeHoyUTC(): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const ymd = dtf.format(new Date()); // YYYY-MM-DD en TZ
  return zonedToUtc(ymd, "00:00", TZ);
}

type Recipient = {
  email: string;
  empresa?: string;
  ciudad?: string;
  gancho?: string;
  nombre?: string;
  pais?: string;
  datos?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try { resendKeyFor(0); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: Bearer + rol admin ---
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
    let isVendedor = false;
    if (!isAdmin) {
      const { data } = await svc.rpc("has_role", { _user_id: userData.user.id, _role: "vendedor" });
      isVendedor = Boolean(data);
      if (!isVendedor) {
        return new Response(JSON.stringify({ error: "Forbidden: se requiere rol admin o vendedor" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Payload ---
    const body = await req.json();
    const fromName: string = (body?.fromName ?? "Mario · LexHouse").toString();
    const fromEmail: string = (body?.fromEmail ?? "no-reply@send.lexhouse-ai.com").toString();
    const replyTo: string | undefined = body?.replyTo ? body.replyTo.toString() : undefined;
    const subjectTpl: string = (body?.subject ?? "").toString();
    const htmlTpl: string = (body?.html ?? "").toString();
    const textTpl: string = (body?.text ?? "").toString();
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];
    // Cuenta Resend con la que se envia. El cliente puede pedir una fija
    // (resend1/resend2) para no quemar los dos dominios a la vez; si no pide
    // nada, se alternan como siempre.
    const modoRemitente = normalizarModo(body?.remitente);

    if (!subjectTpl.trim() || (!htmlTpl.trim() && !textTpl.trim())) {
      return new Response(JSON.stringify({ error: "Falta asunto o cuerpo del correo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Envío de PRUEBA: manda 1 solo correo a la propia casilla del usuario
    // logueado (admin o vendedor), para revisar en dónde cae (Principal /
    // Promociones / Spam). Ignora el filtro "solo tus leads" del vendedor
    // porque el destinatario siempre es él mismo, nunca un lead ajeno. No
    // cuenta contra su cupo diario ni queda en el log de campañas reales.
    if (body?.test === true) {
      const testEmail = (userData.user.email ?? "").trim().toLowerCase();
      if (!testEmail) {
        return new Response(JSON.stringify({ error: "Tu sesión no tiene un correo con el que probar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r: Recipient = { email: testEmail, nombre: (body?.testNombre ?? "").toString() || undefined };
      const { key: apiKey, domain: keyDomain } = resendKeyFor(0, modoRemitente);
      const subject = `[PRUEBA] ${fillTemplate(subjectTpl, r)}`;
      const payload: Record<string, unknown> = {
        from: `${fromName} <${applyDomain(fromEmail, keyDomain)}>`,
        to: [testEmail],
        subject,
      };
      const replyToDomain = replyTo ? applyDomain(replyTo, keyDomain) : undefined;
      if (replyToDomain) payload.reply_to = replyToDomain;
      if (htmlTpl.trim()) payload.html = fillTemplate(htmlTpl, r);
      if (textTpl.trim()) payload.text = fillTemplate(textTpl, r);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.id) {
          return new Response(JSON.stringify({ success: true, prueba: true, sent: 1, to: testEmail, id: data.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
        return new Response(JSON.stringify({ success: false, error: String(errMsg) }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let emailsPropios: Set<string> | null = null; // null = sin restricción (admin)
    let cupoVendedorHoy: number | null = null; // null = sin límite personal (admin)
    if (isVendedor) {
      const { data: misLeads } = await svc
        .from("leads_campana")
        .select("email")
        .eq("vendedor_id", userData.user.id)
        .not("email", "is", null);
      emailsPropios = new Set((misLeads ?? []).map((l: { email: string | null }) => (l.email ?? "").trim().toLowerCase()).filter(Boolean));

      // Límite propio del vendedor (vendedores.limite_mensajes_dia, default 55),
      // aparte del cupo global compartido de las 2 cuentas Resend (LIMITE_DIA).
      const { data: perfil } = await svc.from("vendedores").select("limite_mensajes_dia").eq("user_id", userData.user.id).maybeSingle();
      const limitePersonal = perfil?.limite_mensajes_dia ?? 55;
      const { count: yaEnviadosHoy } = await svc
        .from("correo_envios")
        .select("id", { count: "exact", head: true })
        .eq("enviado_por", userData.user.id)
        .neq("estado", "fallido")
        .gte("enviado_at", inicioDeHoyUTC());
      cupoVendedorHoy = Math.max(0, limitePersonal - (yaEnviadosHoy ?? 0));
    }
    // Destinatarios válidos y deduplicados.
    const seen = new Set<string>();
    let valid = recipients.filter((r) => {
      const e = (r?.email ?? "").trim().toLowerCase();
      if (!e || !EMAIL_RE.test(e) || seen.has(e)) return false;
      seen.add(e);
      r.email = e;
      return true;
    });

    // Vendedor: filtra a solo los emails que son de sus propios leads.
    let omitidosAjenos = 0;
    if (emailsPropios) {
      const antes = valid.length;
      valid = valid.filter((r) => emailsPropios!.has(r.email));
      omitidosAjenos = antes - valid.length;
    }

    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: omitidosAjenos > 0 ? "Ninguno de esos destinatarios es un lead tuyo" : "No hay destinatarios válidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (valid.length > 2000) {
      return new Response(JSON.stringify({ error: "Máximo 2000 destinatarios por envío" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { email: string; ok: boolean; id?: string; error?: string; programado?: boolean }[] = [];
    // Filas para el log de seguimiento (correo_envios).
    const logRows: Record<string, unknown>[] = [];
    const userId = userData.user.id;
    let sent = 0, failed = 0, programados = 0;

    // --- Auto-batching: hoy solo el cupo diario; el resto se agenda. ---
    // Un vendedor además está acotado a su propio límite diario (vendedores.limite_mensajes_dia),
    // aparte del cupo global compartido de las 2 cuentas Resend (LIMITE_DIA).
    const limiteResend = limiteDiaPara(modoRemitente);
    const cupoHoy = cupoVendedorHoy !== null ? Math.min(limiteResend, cupoVendedorHoy) : limiteResend;
    const hoy = valid.slice(0, cupoHoy);
    const excedente = valid.slice(cupoHoy);
    const limitadoPorVendedor = cupoVendedorHoy !== null && excedente.length > 0 && cupoHoy === cupoVendedorHoy;

    for (const r of hoy) {
      const { key: apiKey, index: keyIdx, domain: keyDomain } = resendKeyFor(sent + failed, modoRemitente);
      const subject = fillTemplate(subjectTpl, r);
      const payload: Record<string, unknown> = {
        from: `${fromName} <${applyDomain(fromEmail, keyDomain)}>`,
        to: [r.email],
        subject,
      };
      const replyToDomain = replyTo ? applyDomain(replyTo, keyDomain) : undefined;
      if (replyToDomain) payload.reply_to = replyToDomain;
      if (htmlTpl.trim()) payload.html = fillTemplate(htmlTpl, r);
      if (textTpl.trim()) payload.text = fillTemplate(textTpl, r);
      const unsubTo = replyToDomain || applyDomain(fromEmail, keyDomain);
      payload.headers = {
        "List-Unsubscribe": `<mailto:${unsubTo}?subject=baja>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.id) {
          results.push({ email: r.email, ok: true, id: data.id });
          logRows.push({ resend_id: data.id, email: r.email, nombre: r.nombre ?? null, empresa: r.empresa ?? null, pais: pickPais(r) || null, asunto: subject, enviado_por: userId, estado: "enviado", resend_key_index: keyIdx });
          sent++;
        } else {
          const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
          results.push({ email: r.email, ok: false, error: String(errMsg) });
          logRows.push({ email: r.email, nombre: r.nombre ?? null, empresa: r.empresa ?? null, pais: pickPais(r) || null, asunto: subject, enviado_por: userId, estado: "fallido", error: String(errMsg).slice(0, 300), resend_key_index: keyIdx });
          failed++;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        results.push({ email: r.email, ok: false, error: errMsg });
        logRows.push({ email: r.email, nombre: r.nombre ?? null, empresa: r.empresa ?? null, pais: pickPais(r) || null, asunto: subject, enviado_por: userId, estado: "fallido", error: errMsg.slice(0, 300), resend_key_index: keyIdx });
        failed++;
      }
      await new Promise((r) => setTimeout(r, 550));
    }

    // Registrar los envíos para el panel de seguimiento (no bloquea la respuesta si falla).
    if (logRows.length) {
      const { error: logErr } = await svc.from("correo_envios").insert(logRows);
      if (logErr) console.error("correo_envios insert error:", logErr.message);
    }

    // --- Agenda el excedente para los próximos días (100/día) vía el cron. ---
    if (excedente.length) {
      const row: Record<string, unknown>[] = [];
      for (let i = 0; i < excedente.length; i++) {
        const r = excedente[i];
        const dia = Math.floor(i / limiteResend) + 1; // mañana = día 1
        const fecha = new Date();
        fecha.setUTCDate(fecha.getUTCDate() + dia);
        const ymd = fecha.toISOString().slice(0, 10);
        row.push({
          email: r.email,
          empresa: r.empresa ?? null,
          ciudad: r.ciudad ?? null,
          gancho: r.gancho ?? null,
          nombre: r.nombre ?? null,
          pais: pickPais(r) || null,
          datos: r.datos && Object.keys(r.datos).length ? r.datos : null,
          paso: 0,
          secuencia_nombre: "Campaña manual (auto-batching)",
          asunto: subjectTpl,
          cuerpo: textTpl,
          html: htmlTpl,
          cta_texto: "",
          cta_url: "",
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo ?? null,
          remitente_modo: modoRemitente,
          enviar_en: zonedToUtc(ymd, "09:30", TZ),
          creado_por: userId,
        });
      }
      const { error: insErr } = await svc.from("secuencia_envios_programados").insert(row);
      if (insErr) {
        console.error("auto-batching insert error:", insErr.message);
        for (const r of excedente) {
          results.push({ email: r.email, ok: false, error: "No se pudo agendar el excedente" });
          failed++;
        }
      } else {
        programados = excedente.length;
        for (const r of excedente) results.push({ email: r.email, ok: true, programado: true });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent, failed, programados,
      total: valid.length,
      omitidos_ajenos: omitidosAjenos || undefined,
      aviso: [
        programados > 0 && limitadoPorVendedor ? `${programados} programado(s) porque ya usaste tu cupo diario de correos (${cupoVendedorHoy}/día). Se reintenta mañana.` : null,
        programados > 0 && !limitadoPorVendedor ? `${programados} programado(s) para los próximos días (límite diario de Resend: ${limiteResend}/día).` : null,
        omitidosAjenos > 0 ? `${omitidosAjenos} destinatario(s) se omitieron por no ser leads tuyos.` : null,
      ].filter(Boolean).join(" ") || undefined,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-personalized-campaign error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

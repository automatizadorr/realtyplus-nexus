// Clasificación inteligente de leads con DeepSeek para el flujo n8n
// "Clasificacion IA - WhatsApp Segmentado" (webhook /etiquetas-leads-nuevos).
//
// A diferencia de `etiquetar-ia` (que decide el ESTADO de ciclo de vida del lead,
// grupo estado_lead), esta función decide UNA de las 6 SITUACIONES del documento
// "TRATAMIENTO DE LEADS EN CHAT IA" (grupo situacion_lead) y añade "Gestionado" a las
// situaciones 1–5. Reusa `tag-lead` para aplicar (resuelve nombres, grupos y creación).
//
// Auth: header X-Webhook-Secret (mismo secreto que N8N_WEBHOOK_SECRET en n8n).
//
// Body (desde el cron / n8n):
//   telefono: string                         (requerido)
//   conversacion: string | {rol,texto}[]     (requerido) la conversación a analizar
//   nombre?: string                          nombre del lead (para crearlo si no existe)
//   crear_si_no_existe?: boolean             (default false)
//   aplicar?: boolean                        (default true) false = dry-run (no escribe en BD)
//
// Respuesta: { success, lead_id, tag_ids, segmento, respondio, resumen, decision } o { error }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

// Las 6 SITUACIONES del lead (doc "TRATAMIENTO DE LEADS EN CHAT IA"). El modelo elige
// EXACTAMENTE UNA (grupo `situacion_lead` en tag-lead). Las situaciones 1–5 llevan
// además la etiqueta companion "Gestionado"; la 6 (Sigue en campaña) NO.
const SEGMENTOS = [
  "Quiere info, no concreta cita",       // 1
  "Cita agendada",                       // 2
  "Pide info, conversación inacabada",   // 3
  "Pide info, no es el momento",         // 4
  "No interesa",                         // 5
  "Sigue en campaña",                    // 6 (solo cuando el lead NO respondió)
];
// Situaciones que un lead que SÍ respondió puede tener (1–5). La 6 es exclusiva del
// atajo "nunca respondió".
const SEGMENTOS_RESPONDIO = SEGMENTOS.slice(0, 5);

const norm = (s: unknown) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const GESTIONADO = "Gestionado";
// Situación por defecto cuando el LEAD SÍ respondió pero DeepSeek no halla señal clara.
const FALLBACK_RESPONDIO = "Pide info, conversación inacabada";
// Situación cuando el bot/agente escribió pero el LEAD nunca respondió: sigue en campaña
// (chat IA activo, se reenvían plantillas 2ª/3ª/4ª). No se envía al webhook de expansión.
const SEGMENTO_SIN_RESPUESTA = "Sigue en campaña";

function conversacionATexto(conv: unknown): string {
  if (typeof conv === "string") return conv.trim();
  if (Array.isArray(conv)) {
    return conv
      .map((turno) => {
        const t = turno as Record<string, unknown>;
        const rol = (t.rol ?? t.role ?? t.autor ?? "lead").toString();
        const texto = (t.texto ?? t.text ?? t.content ?? t.mensaje ?? "").toString();
        if (!texto.trim()) return "";
        return `${rol === "agente" || rol === "assistant" ? "Agente" : "Lead"}: ${texto.trim()}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

// ¿El lead respondió alguna vez? Con array distinguimos por rol; con string plano no se
// puede separar roles → asumimos true (que decida DeepSeek).
function leadHaRespondido(conv: unknown): boolean {
  if (!Array.isArray(conv)) return true;
  return conv.some((turno) => {
    const t = turno as Record<string, unknown>;
    const rol = (t.rol ?? t.role ?? t.autor ?? "lead").toString();
    const texto = (t.texto ?? t.text ?? t.content ?? t.mensaje ?? "").toString();
    const esAgente = rol === "agente" || rol === "assistant" || rol === "agent";
    return !esAgente && texto.trim().length > 0;
  });
}

function parseJsonRespuesta(raw: string): Record<string, unknown> {
  let s = (raw ?? "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// Resuelve el nombre que devolvió DeepSeek a una situación EXACTA (tildes/mayúsculas),
// comparando normalizado dentro de la lista permitida. Devuelve null si no casa.
function resolverSegmento(nombre: unknown, permitidos: string[] = SEGMENTOS): string | null {
  const n = norm(nombre);
  if (!n) return null;
  return permitidos.find((s) => norm(s) === n) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!DEEPSEEK_API_KEY) return json({ error: "DEEPSEEK_API_KEY missing" }, 500);

    const body = await req.json().catch(() => ({}));
    const telefono = (body?.telefono ?? "").toString().replace(/\D/g, "");
    const nombre = (body?.nombre ?? "").toString().trim();
    const crearSiNoExiste = body?.crear_si_no_existe === true; // default false
    const aplicar = body?.aplicar !== false; // default true; false = dry-run
    const conversacion = conversacionATexto(body?.conversacion);
    const respondio = leadHaRespondido(body?.conversacion);

    if (!telefono) return json({ error: "telefono requerido" }, 400);
    if (!conversacion) return json({ error: "conversacion requerida" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let segmento: string;
    let resumen = "";
    let decision: Record<string, unknown> = {};

    // Atajo: si el LEAD nunca respondió → "Sigue en campaña" (situación 6) sin DeepSeek.
    if (!respondio) {
      segmento = SEGMENTO_SIN_RESPUESTA;
      resumen = "El bot/agente escribió pero el lead aún no ha respondido; sigue en campaña.";
      decision = { segmento, razon: "no hay turnos del lead en la conversación" };
    } else {
      // Pedir a DeepSeek la situación (JSON estructurado). Solo entre las 5 del lead que
      // SÍ respondió (la 6 "Sigue en campaña" es exclusiva del atajo de arriba).
      const systemPrompt =
        `Eres un clasificador experto de leads inmobiliarios (agencia en Chile/España). ` +
        `El lead YA respondió al menos una vez. Asigna EXACTAMENTE UNA situación de esta lista ` +
        `(respeta tildes y mayúsculas):\n` +
        SEGMENTOS_RESPONDIO.map((s) => `   - ${s}`).join("\n") + `\n\n` +
        `CRITERIOS (protocolo de tratamiento de leads). Mira el ESTADO ACTUAL y el ÚLTIMO turno del LEAD:\n` +
        `   - "Quiere info, no concreta cita": el lead está ACTIVO y receptivo (pregunta, muestra interés) y recibe información, pero aún NO agenda cita ni pone freno. La conversación sigue viva.\n` +
        `   - "Cita agendada": cerró una reunión/visita/videollamada con día y hora concretos Y la cita SIGUE EN PIE. Si después la cancela o dice que "no podrá asistir" (sin rechazar la franquicia), NO es esta: pasa a "Pide info, no es el momento" para reprogramar.\n` +
        `   - "Pide info, conversación inacabada": pidió información pero la charla quedó COLGADA o inconclusa: el lead dejó de responder, contestó vago ('.', 'ok', un enlace, algo fuera de tema) o se despidió, SIN cerrar cita ni rechazar. Simplemente se apagó.\n` +
        `   - "Pide info, no es el momento": pospone dejando la puerta ABIERTA. Dice "ahora no", "más adelante", "no es el momento", "no tengo capital por ahora", "cuando cambie te aviso". Hay interés latente, pero no ahora.\n` +
        `   - "No interesa": rechazo que CIERRA la puerta: "no me interesa", "no gracias", pide no ser contactado/darse de baja, o dice que ya está en otro rubro. Sin intención de retomar.\n\n` +
        `DESEMPATES:\n` +
        `   - 1 vs 3: ¿el lead sigue enganchado (1) o dejó la charla colgada / respondió sin sustancia (3)?\n` +
        `   - 4 vs 5: ¿deja la puerta abierta para más adelante (4) o rechaza cerrándola (5)?\n\n` +
        `REGLAS:\n` +
        `1. Elige UNA SOLA situación, la que mejor describa el estado ACTUAL de la conversación.\n` +
        `2. No inventes: usa solo las de la lista, idénticas.\n` +
        `3. Si el hilo trae por error texto de OTRO bot o empresa, ignóralo y clasifica por la intención REAL del lead.\n` +
        `4. "resumen": 1-2 frases (máx 240 caracteres) en español con el estado e intención del lead.\n\n` +
        `Responde SOLO con un objeto JSON con esta forma exacta:\n` +
        `{"segmento": string, "resumen": string, "razon": string}`;

      const dsRes = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Conversación con el lead:\n${conversacion}` },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!dsRes.ok) {
        const errTxt = await dsRes.text();
        console.error("DeepSeek error:", dsRes.status, errTxt);
        return json({ error: "DeepSeek error", status: dsRes.status, detail: errTxt }, 502);
      }

      const dsJson = await dsRes.json();
      const content = dsJson?.choices?.[0]?.message?.content ?? "";
      try {
        decision = parseJsonRespuesta(content);
      } catch (_e) {
        console.error("Respuesta de DeepSeek no es JSON válido:", content);
        return json({ error: "Respuesta de DeepSeek no es JSON válido", raw: content }, 502);
      }

      resumen = typeof decision.resumen === "string" ? decision.resumen : "";
      // Resuelve entre las 5 situaciones del lead que respondió; si no casa → fallback.
      segmento = resolverSegmento(decision.segmento, SEGMENTOS_RESPONDIO) ?? FALLBACK_RESPONDIO;
      decision.segmento = segmento;
    }

    // Modo dry-run: devolver la decisión SIN aplicar la etiqueta (no escribe en BD).
    if (!aplicar) {
      return json({ success: true, dry_run: true, telefono, segmento, respondio, resumen, decision });
    }

    // Aplicar la situación vía tag-lead (grupo exclusivo situacion_lead → limpia las
    // otras 5). Las situaciones 1–5 llevan además "Gestionado"; la 6 (Sigue en campaña)
    // conserva su estado y se le quita "Gestionado".
    const esCampana = norm(segmento) === norm(SEGMENTO_SIN_RESPUESTA);
    const tagRes = await fetch(`${SUPABASE_URL}/functions/v1/tag-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify({
        telefono,
        tag_nombres: esCampana ? [segmento] : [segmento, GESTIONADO],
        remove_tag_nombres: esCampana ? [GESTIONADO] : [],
        mode: "add",
        grupo_exclusivo: "situacion_lead",
        crear_si_no_existe: crearSiNoExiste,
        nombre,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const tagResult = await tagRes.json().catch(() => ({}));
    if (!tagRes.ok) {
      return json({ error: "tag-lead falló", status: tagRes.status, detail: tagResult, segmento, decision }, 502);
    }

    return json({ success: true, ...tagResult, segmento, respondio, resumen, decision });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("clasificar-whatsapp-ia error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

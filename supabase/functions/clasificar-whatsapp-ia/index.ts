// Clasificación inteligente de leads con DeepSeek para el flujo n8n
// "Clasificacion IA - WhatsApp Segmentado" (webhook /etiquetas-leads-nuevos).
//
// A diferencia de `etiquetar-ia` (que decide el ESTADO de ciclo de vida del lead,
// grupo estado_lead), esta función decide UN SEGMENTO de la conversación de entre 9
// opciones, para enrutar un WhatsApp distinto por segmento. Reusa `tag-lead` para
// aplicar la etiqueta (resuelve nombres, grupos exclusivos y creación).
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

// Los 9 segmentos de clasificación. El modelo elige EXACTAMENTE UNO. Cada uno enruta
// a un mensaje de WhatsApp distinto en el flujo n8n (nodo Switch Etiqueta).
const SEGMENTOS = [
  "Lead Caliente",
  "Cita agendada",
  "Interesado en Financiamiento",
  "Listo para Cerrar",
  "Solo Consultando",
  "Requiere Seguimiento IA",
  "Conversación Activa",
  "Sin Respuesta al Bot",
  "No interesa",
];

// "Cita agendada" y "No interesa" son el MISMO concepto que en estado_lead (misma fila
// en lead_tags). Se enrutan por el grupo estado_lead para no descoordinar el ciclo de
// vida; el resto va por segmento_clasificacion. Debe casar con tag-lead.
const norm = (s: unknown) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const COMPARTIDAS_ESTADO = new Set(["cita agendada", "no interesa"].map(norm));

// Segmento por defecto cuando el LEAD SÍ respondió pero DeepSeek no halla señal clara.
const FALLBACK_RESPONDIO = "Requiere Seguimiento IA";
// Segmento cuando el bot/agente escribió pero el LEAD nunca respondió (no se envía al
// webhook; sigue en campaña a la espera de que el lead conteste).
const SEGMENTO_SIN_RESPUESTA = "Sin Respuesta al Bot";

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

// Resuelve el nombre del segmento que devolvió DeepSeek a uno de los 9 EXACTOS (tildes
// y mayúsculas), comparando normalizado. Devuelve null si no casa con ninguno.
function resolverSegmento(nombre: unknown): string | null {
  const n = norm(nombre);
  if (!n) return null;
  return SEGMENTOS.find((s) => norm(s) === n) ?? null;
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

    // Atajo: si el LEAD nunca respondió, es "Sin Respuesta al Bot" sin gastar DeepSeek.
    if (!respondio) {
      segmento = SEGMENTO_SIN_RESPUESTA;
      resumen = "El bot/agente escribió pero el lead aún no ha respondido.";
      decision = { segmento, razon: "no hay turnos del lead en la conversación" };
    } else {
      // Pedir a DeepSeek el segmento (JSON estructurado).
      const systemPrompt =
        `Eres un clasificador experto de leads inmobiliarios (agencia en Chile/España). ` +
        `Analizas una conversación de WhatsApp y asignas EXACTAMENTE UN segmento de esta lista ` +
        `(respeta tildes y mayúsculas):\n` +
        SEGMENTOS.map((s) => `   - ${s}`).join("\n") + `\n\n` +
        `CRITERIOS:\n` +
        `   - "Lead Caliente": interés alto y urgencia real de comprar/arrendar pronto.\n` +
        `   - "Cita agendada": acordó una reunión, visita o llamada con fecha/hora.\n` +
        `   - "Interesado en Financiamiento": pregunta por crédito hipotecario, pie, dividendos, financiamiento.\n` +
        `   - "Listo para Cerrar": quiere avanzar YA al cierre, reserva, firma o pago.\n` +
        `   - "Solo Consultando": pide info general, curiosea, sin intención clara de avanzar.\n` +
        `   - "Requiere Seguimiento IA": respondió pero la intención no es clara; necesita más nurturing.\n` +
        `   - "Conversación Activa": intercambio en curso que no encaja en un segmento más específico.\n` +
        `   - "Sin Respuesta al Bot": el bot/agente escribió pero el lead nunca respondió.\n` +
        `   - "No interesa": el lead rechaza explícitamente, pide no ser contactado o darse de baja.\n\n` +
        `REGLAS:\n` +
        `1. Elige UN SOLO segmento, el que mejor describa el estado ACTUAL de la conversación.\n` +
        `2. No inventes segmentos: usa solo los de la lista, idénticos.\n` +
        `3. "resumen": 1-2 frases (máx 240 caracteres) en español con el estado e intención del lead.\n\n` +
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
      // Resuelve el segmento; si no casa con ninguno de los 9 → fallback de seguimiento.
      segmento = resolverSegmento(decision.segmento) ?? FALLBACK_RESPONDIO;
      decision.segmento = segmento;
    }

    // Modo dry-run: devolver la decisión SIN aplicar la etiqueta (no escribe en BD).
    if (!aplicar) {
      return json({ success: true, dry_run: true, telefono, segmento, respondio, resumen, decision });
    }

    // Aplicar el segmento como etiqueta vía tag-lead. "Cita agendada" / "No interesa" se
    // enrutan por estado_lead (concepto compartido); el resto por segmento_clasificacion.
    const grupo_exclusivo = COMPARTIDAS_ESTADO.has(norm(segmento)) ? "estado_lead" : "segmento_clasificacion";
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
        tag_nombres: [segmento],
        mode: "add",
        grupo_exclusivo,
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

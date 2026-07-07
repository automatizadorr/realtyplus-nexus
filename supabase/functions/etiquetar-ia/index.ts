// Etiquetado inteligente de leads con DeepSeek.
// n8n envía una conversación; DeepSeek la analiza y decide qué etiquetas aplicar,
// usando SOLO las etiquetas reales de la tabla `lead_tags`. Luego delega en la
// Edge Function `tag-lead` (que ya resuelve nombres, grupos exclusivos y creación).
//
// Auth: header X-Webhook-Secret (mismo secreto que N8N_WEBHOOK_SECRET en n8n).
//
// Body (desde n8n):
//   telefono: string                         (requerido)
//   conversacion: string | {rol,texto}[]     (requerido) la conversación a analizar
//       - string: texto plano de la conversación
//       - array:  [{ rol: "lead"|"agente", texto: "..." }, ...]
//   nombre?: string                          nombre del lead (para crearlo si no existe)
//   crear_si_no_existe?: boolean             (default true)
//
// Respuesta: { success, lead_id, tag_ids, decision } o { error }
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

// Grupos de etiquetas mutuamente excluyentes — debe coincidir con tag-lead.
// Un lead tiene UN solo estado de ciclo de vida a la vez.
// Consolidado a las 6 situaciones (2026-07-06): se borraron los estados de handoff
// (Agente asignado / Pendiente asignar agente / Solo quiere propiedades / Sin respuesta
// clara). Este clasificador queda reducido a los estados que sobreviven y que comparten
// concepto con las 6 situaciones, para no fallar al asignar etiquetas inexistentes.
const GRUPOS_EXCLUSIVOS: Record<string, string[]> = {
  estado_lead: [
    "Sigue en campaña",
    "No interesa",
    "Cita agendada",
  ],
};

// Etiqueta de respaldo cuando DeepSeek no encuentra señal suficiente: en vez de dejar el
// lead sin etiqueta, se le asigna este estado. Antes era "Sin respuesta clara" (borrada);
// ahora "Sigue en campaña" (el lead queda pendiente en campaña hasta dar señal real).
const FALLBACK_TAG = "Sigue en campaña";

// Convierte la conversación (string o array de turnos) a texto plano para el prompt.
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

// ¿El lead respondió alguna vez? true si la conversación trae al menos un turno del
// LEAD con texto real (no solo mensajes del agente). Con array distinguimos por rol;
// con string plano no se puede separar roles → asumimos true (que decida DeepSeek).
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

// Extrae el primer objeto JSON de la respuesta del modelo (tolera fences ```json).
function parseJsonRespuesta(raw: string): Record<string, unknown> {
  let s = (raw ?? "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    // 1. Auth — mismo secreto que usa n8n para el resto de funciones.
    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!DEEPSEEK_API_KEY) return json({ error: "DEEPSEEK_API_KEY missing" }, 500);

    const body = await req.json().catch(() => ({}));
    const telefono = (body?.telefono ?? "").toString().replace(/\D/g, "");
    const nombre = (body?.nombre ?? "").toString().trim();
    const crearSiNoExiste = body?.crear_si_no_existe !== false; // default true
    const aplicar = body?.aplicar !== false; // default true; false = dry-run (no escribe en BD)
    const conversacion = conversacionATexto(body?.conversacion);

    if (!telefono) return json({ error: "telefono requerido" }, 400);
    if (!conversacion) return json({ error: "conversacion requerida" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 2. Cargar las etiquetas REALES — el modelo solo puede elegir de esta lista.
    const { data: tags, error: tagsErr } = await supabase.from("lead_tags").select("nombre");
    if (tagsErr) throw tagsErr;
    const nombresEtiquetas = (tags ?? []).map((t) => t.nombre).filter(Boolean);
    if (nombresEtiquetas.length === 0) {
      return json({ error: "No hay etiquetas en lead_tags" }, 500);
    }

    // 3. Pedir a DeepSeek la decisión de etiquetado (JSON estructurado).
    const estados = GRUPOS_EXCLUSIVOS.estado_lead;
    const systemPrompt =
      `Eres un clasificador experto de leads inmobiliarios para una agencia en Chile/España. ` +
      `Analizas la conversación de WhatsApp con un lead y decides qué etiquetas aplicarle.\n\n` +
      `REGLAS:\n` +
      `1. Usa ÚNICAMENTE etiquetas de esta lista exacta (respeta tildes y mayúsculas):\n` +
      nombresEtiquetas.map((n) => `   - ${n}`).join("\n") + `\n` +
      `2. Las siguientes son estados de ciclo de vida MUTUAMENTE EXCLUYENTES (elige máximo UNO): ` +
      estados.join(", ") + `. ` +
      `Si asignas uno de estos, pon "grupo_exclusivo": "estado_lead" para que reemplace al estado anterior.\n` +
      `3. Criterios de estado (el lead tiene EXACTAMENTE UNO):\n` +
      `   - "Sigue en campaña": el lead AÚN NO HA RESPONDIDO. La conversación solo tiene ` +
      `mensajes del agente (o no hay ninguna respuesta real del lead). Es el estado por ` +
      `defecto mientras no conteste; sigue en campaña hasta que responda. ` +
      `NO lo confundas con "No interesa".\n` +
      `   - "No interesa": el lead SÍ respondió y RECHAZA explícitamente: dice que no le ` +
      `interesa, pide no ser contactado o darse de baja. Requiere un rechazo claro del lead, ` +
      `no el simple hecho de no haber contestado.\n` +
      `   - "Cita agendada": acordó una reunión, visita o llamada con fecha/hora.\n` +
      `4. Puedes añadir además etiquetas temáticas de la lista (zona, tipo de propiedad, etc.) si la conversación lo justifica con claridad.\n` +
      `5. No inventes etiquetas. Si no hay señal suficiente, deja "tag_nombres" vacío.\n` +
      `6. "resumen": un resumen BREVE (1-2 frases, máximo 240 caracteres) en español del estado ` +
      `de la conversación y la intención del lead. Aunque no haya etiquetas, SIEMPRE rellena el resumen.\n\n` +
      `Responde SOLO con un objeto JSON con esta forma exacta:\n` +
      `{"tag_nombres": string[], "remove_tag_nombres": string[], "grupo_exclusivo": "estado_lead" | null, "resumen": string, "razon": string}`;

    const dsRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
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

    let decision: Record<string, unknown>;
    try {
      decision = parseJsonRespuesta(content);
    } catch (_e) {
      console.error("No se pudo parsear la respuesta de DeepSeek:", content);
      return json({ error: "Respuesta de DeepSeek no es JSON válido", raw: content }, 502);
    }

    const tag_nombres: string[] = Array.isArray(decision.tag_nombres)
      ? (decision.tag_nombres as unknown[]).map(String)
      : [];
    const remove_tag_nombres: string[] = Array.isArray(decision.remove_tag_nombres)
      ? (decision.remove_tag_nombres as unknown[]).map(String)
      : [];
    let grupo_exclusivo = decision.grupo_exclusivo === "estado_lead" ? "estado_lead" : null;
    let solo_si_grupo_vacio = false;
    const resumen = typeof decision.resumen === "string" ? decision.resumen : "";

    // Sin señal suficiente: en vez de dejar el lead SIN etiqueta, le asignamos el estado
    // de respaldo FALLBACK_TAG ("Sin respuesta clara") para que TODOS queden etiquetados.
    // Va como estado (grupo estado_lead) y solo si el lead aún no tiene estado asignado
    // (solo_si_grupo_vacio) → nunca pisa "Cita agendada", etc. En cuanto el lead dé una
    // señal real, etiquetar-ia/tag-lead lo reemplazan.
    let fallback = false;
    if (tag_nombres.length === 0) {
      // Si el lead NUNCA respondió (solo mensajes del agente) es el caso "Sigue en
      // campaña" → NO se envía a expansión. Si respondió pero sin intención clasificable,
      // va al respaldo "Sin respuesta clara" (sí se envía, para revisión manual).
      tag_nombres.push(leadHaRespondido(body?.conversacion) ? FALLBACK_TAG : "Sigue en campaña");
      grupo_exclusivo = "estado_lead";
      solo_si_grupo_vacio = true;
      fallback = true;
      decision.tag_nombres = tag_nombres; // que el cron lo vea en decision.tag_nombres
    }

    // Modo dry-run: devolver la decisión SIN aplicar etiquetas (no escribe en BD).
    if (!aplicar) {
      return json({
        success: true,
        dry_run: true,
        telefono,
        resumen,
        decision,
        ...(fallback ? { fallback: true } : {}),
      });
    }

    // 4. Delegar en tag-lead (reusa resolución de nombres, grupos exclusivos y creación).
    const tagRes = await fetch(`${SUPABASE_URL}/functions/v1/tag-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
        // El gateway de Supabase exige Authorization aunque tag-lead use su propio secreto.
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify({
        telefono,
        tag_nombres,
        remove_tag_nombres,
        mode: "add",
        grupo_exclusivo,
        solo_si_grupo_vacio,
        crear_si_no_existe: crearSiNoExiste,
        nombre,
        // Persiste el resumen IA en el lead (columna resumen_ia) para que el Excel
        // de expansión lo lea después. tag-lead lo guarda en la misma escritura.
        resumen,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const tagResult = await tagRes.json().catch(() => ({}));
    if (!tagRes.ok) {
      return json({ error: "tag-lead falló", status: tagRes.status, detail: tagResult, decision }, 502);
    }

    return json({ success: true, ...tagResult, resumen, decision });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("etiquetar-ia error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});

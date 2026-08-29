// sofia-chat — Asistente IA de texto "Sofía" para LexHouse AI · CRM (lexhouse-ai.homes).
//
// - PÚBLICA (verify_jwt=false): la usan visitantes anónimos de la landing del CRM.
// - Motor: DeepSeek (deepseek-chat) con DEEPSEEK_API_KEY (formato OpenAI compatible).
// - Enfoque: CRM inmobiliario que trabaja SOBRE WhatsApp. La propia Sofía es la
//   asesora IA que, dentro del producto, atiende el WhatsApp del corredor 24/7.
//   Responde honesta (sin cifras/precios inventados) y guía a "Comenzar gratis".
// - Guardas anti-abuso: largo de mensajes, cantidad de historial, tokens.
// - Prompt unificado en _shared/sofia-prompt.ts (Single Source of Truth).

import { getSystemPrompt, getRedesSubPrompt, type CanalKey } from "../_shared/sofia-prompt.ts";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const MAX_MSG_LEN   = 1500;
const MAX_HISTORY   = 12;
const MAX_TOKENS    = 600;

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

// Canal por defecto para esta edge function (landing del CRM)
const CANAL: CanalKey = "landing-homes";

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) return json({ error: "Chat no configurado (falta DEEPSEEK_API_KEY)" }, 500);

    const body = await req.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

    // Selección de persona por canal:
    // - "redes" + is_comment=true → comentario público (sin precios, max 2 frases)
    // - "redes" + is_comment=false → DM privado (con precios tras diagnóstico, max 4 frases)
    // - cualquier otro valor (o ninguno) → landing CRM (landing-homes)
    const channel = typeof body?.channel === "string" ? body.channel : "";
    const isComment = body?.is_comment === true;
    let systemPrompt: string;

    if (channel === "redes") {
      systemPrompt = getSystemPrompt("redes-sociales") + "\n\n" + getRedesSubPrompt(isComment);
    } else {
      systemPrompt = getSystemPrompt(CANAL);
    }

    // Sanitiza + acota el historial
    const history: Msg[] = rawMessages
      .filter((m: unknown): m is Msg =>
        !!m && typeof m === "object" &&
        (((m as Msg).role === "user") || ((m as Msg).role === "assistant")) &&
        typeof (m as Msg).content === "string")
      .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_LEN) }))
      .slice(-MAX_HISTORY);

    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return json({ error: "Falta un mensaje del usuario." }, 400);
    }

    const aiRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text().catch(() => "");
      console.error("[sofia-chat] DeepSeek error", aiRes.status, errTxt);
      return json({ error: "No pude responder en este momento, intenta de nuevo." }, 502);
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: "Respuesta vacía." }, 502);

    return json({ reply });
  } catch (e) {
    console.error("[sofia-chat] error", e);
    return json({ error: "Error interno." }, 500);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ELEVENLABS_WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const ELEVENLABS_AGENT_ID = "agent_5801kj0vngjhfrjvnypa36vvagmv";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyElevenLabsSignature(signature: string, payload: string): boolean {
  if (!ELEVENLABS_WEBHOOK_SECRET) return true;
  return true; // TODO: implementar HMAC verification
}

function verifyTwilioSignature(signature: string, url: string, params: Record<string, string>): boolean {
  if (!TWILIO_AUTH_TOKEN) return true;
  return true; // TODO: implementar
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const contentType = req.headers.get("Content-Type") || "";
    const signature = req.headers.get("X-ElevenLabs-Signature") || req.headers.get("X-Twilio-Signature") || "";
    const rawBody = await req.text();

    const isElevenLabs = contentType.includes("application/json") && req.headers.has("X-ElevenLabs-Signature");
    const isTwilio = contentType.includes("application/x-www-form-urlencoded") && req.headers.has("X-Twilio-Signature");

    if (isElevenLabs && !verifyElevenLabsSignature(signature, rawBody)) {
      return json({ error: "Invalid ElevenLabs signature" }, 401);
    }
    if (isTwilio && !verifyTwilioSignature(signature, req.url, {})) {
      return json({ error: "Invalid Twilio signature" }, 401);
    }

    const body = isTwilio ? Object.fromEntries(new URLSearchParams(rawBody)) : JSON.parse(rawBody);

    // Normalize event
    let callId: string;
    let status: string;
    let durationSeconds = 0;
    let costUsd = 0;
    let transcript = "";
    let recordingUrl = "";
    let endedAt = new Date().toISOString();

    // Parse both summaries: ElevenLabs analysis.summary + agente_calificador tool payload
    let summary = "";
    let analysis: Record<string, any> = {};
    let toolPayload: Record<string, any> = {};

    if (isElevenLabs) {
      callId = body.conversation_id || body.call_id;
      status = body.status === "completed" ? "completed" : body.status || "completed";
      durationSeconds = body.metadata?.duration_seconds || body.duration_seconds || 0;
      costUsd = body.metadata?.cost_usd || body.cost_usd || 0;
      transcript = body.transcript || body.transcription || "";
      recordingUrl = body.recording_url || body.audio_url || "";
      endedAt = body.ended_at || body.metadata?.ended_at || endedAt;

      // Extract ElevenLabs analysis summary
      if (body.analysis?.summary) {
        summary = body.analysis.summary;
        analysis = body.analysis;
      }

      // Extract agente_calificador tool payload (if present in webhook)
      if (body.Nombre_Lead) {
        toolPayload = body;
        // Prefer tool's structured summary if ElevenLabs analysis missing
        if (!summary && body.transcripcioncion_resumida_a_texto) {
          summary = body.transcripcioncion_resumida_a_texto;
        }
        analysis = {
          perfil: body.perfil_inmobiliario,
          volumen: body.volumen_propiedades,
          dolor: body.dolor_principal,
          urgencia: body.urgencia,
          liquidez: body.liquides_lead,
          email: body.email,
          ...analysis
        };
      }
    } else if (isTwilio) {
      callId = body.CallSid;
      status = body.CallStatus === "completed" ? "completed" :
               body.CallStatus === "busy" ? "busy" :
               body.CallStatus === "no-answer" ? "no_answer" :
               body.CallStatus === "failed" ? "failed" : "completed";
      durationSeconds = parseInt(body.CallDuration || "0", 10);
      costUsd = 0;
      recordingUrl = body.RecordingUrl || "";
    } else {
      callId = body.call_id;
      status = body.status || "completed";
      durationSeconds = body.duration_seconds || 0;
      costUsd = body.cost_usd || 0;
      transcript = body.transcript || "";
      recordingUrl = body.recording_url || "";
      endedAt = body.ended_at || endedAt;

      if (body.Nombre_Lead) {
        toolPayload = body;
        if (!summary && body.transcripcioncion_resumida_a_texto) {
          summary = body.transcripcioncion_resumida_a_texto;
        }
      }
    }

    if (!callId) {
      return json({ error: "Missing call_id/conversation_id/CallSid" }, 400);
    }

    // Upsert voice_llamadas (idempotente por call_id) - now includes summary, analysis, tool_payload
    const { data, error } = await supabase
      .from("voice_llamadas")
      .update({
        duration_seconds: durationSeconds,
        cost_usd: costUsd,
        transcript: transcript,
        recording_url: recordingUrl,
        status: status,
        ended_at: endedAt,
        summary: summary,
        analysis: analysis,
        tool_payload: toolPayload,
      })
      .eq("call_id", callId)
      .select("id, cuenta_id, user_id")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[voice-tracker] update error", error);
      return json({ error: "DB update failed" }, 500);
    }

    // Si no existe, intentar crear (para llamadas que no pasaron por orchestrator)
    if (!data) {
      const { data: inserted } = await supabase
        .from("voice_llamadas")
        .insert({
          call_id: callId,
          phone: body.From || body.to_number || body.phone || body.lead_phone || "",
          direction: body.Direction || "inbound",
          provider: isElevenLabs ? "elevenlabs_twilio" : "twilio",
          agent_id: body.agent_id || ELEVENLABS_AGENT_ID,
          duration_seconds: durationSeconds,
          cost_usd: costUsd,
          transcript: transcript,
          recording_url: recordingUrl,
          status: status,
          summary: summary,
          analysis: analysis,
          tool_payload: toolPayload,
          started_at: body.started_at || new Date(Date.now() - durationSeconds * 1000).toISOString(),
          ended_at: endedAt,
        })
        .select("id")
        .single();
    }

    return json({ success: true, call_id: callId, updated: !!data, summary_saved: !!summary });

  } catch (e) {
    console.error("[voice-tracker] error", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
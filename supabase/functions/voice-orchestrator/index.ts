// voice-orchestrator — Orquestador único de llamadas salientes ElevenLabs + Twilio
// - Recibe lead_id / datos normalizados
// - Valida límites de voz por plan (1h/2h/5h)
// - Llama ElevenLabs /convai/twilio/outbound-call con dynamic_variables sincronizadas
// - Registra en voice_llamadas (append-only) para tracking y facturación

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ELEVENLABS_API_URL,
  ELEVENLABS_AGENT_ID,
  ELEVENLABS_PHONE_NUMBER_ID,
  buildDynamicVariables,
  normalizeSheetRow,
} from "../_shared/voice-variables.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkVoiceLimits(supabase: any, userId: string): Promise<{ ok: boolean; remainingMin: number; includedMin: number }> {
  const { data } = await supabase.rpc("voice_minutos_disponibles", { _user: userId });
  if (!data?.ok) return { ok: false, remainingMin: 0, includedMin: 0 };
  return { ok: true, remainingMin: data.restantes_min ?? 0, includedMin: data.incluidos ?? 0 };
}

async function logCallStart(supabase: any, payload: {
  cuenta_id: string; user_id: string; phone: string; direction: "outbound";
  provider: "elevenlabs_twilio"; call_id: string; agent_id: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("voice_llamadas")
    .insert({
      cuenta_id: payload.cuenta_id,
      user_id: payload.user_id,
      phone: payload.phone,
      direction: payload.direction,
      provider: payload.provider,
      call_id: payload.call_id,
      agent_id: payload.agent_id,
      status: "initiated",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function updateCallEnd(supabase: any, callId: string, payload: {
  duration_seconds: number; cost_usd: number; transcript?: string; recording_url?: string; status: string;
}) {
  await supabase
    .from("voice_llamadas")
    .update({
      duration_seconds: payload.duration_seconds,
      cost_usd: payload.cost_usd,
      transcript: payload.transcript,
      recording_url: payload.recording_url,
      status: payload.status,
      ended_at: new Date().toISOString(),
    })
    .eq("call_id", callId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const { lead_id, lead_data, to_number, call_objective } = body;

    if (!to_number && !lead_data?.telefono) {
      return json({ error: "to_number or lead_data.telefono required" }, 400);
    }

    // Resolve cuenta_id via cuenta_de_usuario
    const { data: cuentaId } = await supabase.rpc("cuenta_de_usuario", { _user: user.id });
    if (!cuentaId) return json({ error: "No cuenta asociada" }, 403);

    // Check voice limits
    const limits = await checkVoiceLimits(supabase, user.id);
    if (!limits.ok || limits.remainingMin <= 0) {
      return json({
        error: "VOZ_LIMITE_ALCANZADO",
        code: "VOZ_LIMITE",
        remaining_min: limits.remainingMin,
        included_min: limits.includedMin,
        upgrade_url: "/settings?tab=plan",
      }, 429);
    }

    // Normalize lead data
    const crmData = lead_data ? normalizeSheetRow(lead_data) : {};
    crmData.telefono = to_number || crmData.telefono;
    if (call_objective) crmData.call_objective = call_objective;

    // Build ElevenLabs dynamic_variables
    const dynamicVariables = buildDynamicVariables(crmData);

    // Generate unique call_id
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Log call initiation
    const vozLogId = await logCallStart(supabase, {
      cuenta_id: cuentaId,
      user_id: user.id,
      phone: crmData.telefono,
      direction: "outbound",
      provider: "elevenlabs_twilio",
      call_id: callId,
      agent_id: ELEVENLABS_AGENT_ID,
    });

    // Call ElevenLabs outbound
    const elevenRes = await fetch(ELEVENLABS_API_URL, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: ELEVENLABS_AGENT_ID,
        agent_phone_number_id: ELEVENLABS_PHONE_NUMBER_ID,
        to_number: crmData.telefono,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      }),
    });

    const elevenData = await elevenRes.json().catch(() => ({}));

    if (!elevenRes.ok) {
      await updateCallEnd(supabase, callId, {
        duration_seconds: 0,
        cost_usd: 0,
        status: "failed",
        transcript: `ElevenLabs error: ${elevenRes.status} ${JSON.stringify(elevenData)}`,
      });
      return json({ error: "ElevenLabs call failed", details: elevenData }, 502);
    }

    // Success - call initiated
    return json({
      success: true,
      call_id: callId,
      elevenlabs_conversation_id: elevenData.conversation_id,
      voz_log_id: vozLogId,
      dynamic_variables_sent: dynamicVariables,
      remaining_minutes: limits.remainingMin - 1, // estimado
    });

  } catch (e) {
    console.error("[voice-orchestrator] error", e);
    return json({ error: "Internal error", details: String(e) }, 500);
  }
});
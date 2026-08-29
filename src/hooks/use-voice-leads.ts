import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceLead = {
  // Sheet fields (existing)
  row: number;
  nombre: string;
  telefono: string;
  email: string;
  tipo_interes: string;
  modelo_franquicia: string;
  ubicacion: string;
  presupuesto: string;
  proposito: string;
  horario: string;
  resumen: string;
  informe: string;
  status: string;
  source: string;
  created_at: string;
  tags: string;

  // voice_llamadas fields (new)
  summary?: string;
  transcript?: string;
  recording_url?: string;
  duration_seconds?: number;
  cost_usd?: number;
  analysis?: {
    perfil?: string;
    volumen?: string;
    dolor?: string;
    urgencia?: string;
    liquidez?: string;
    email?: string;
  };
  tool_payload?: {
    Nombre_Lead?: string;
    email?: string;
    perfil_inmobiliario?: string;
    volumen_propiedades?: string;
    dolor_principal?: string;
    urgencia?: string;
    transcripcioncion_resumida_a_texto?: string;
    liquides_lead?: string;
    fecha_reunion?: string;
    hora_reunion?: string;
  };
  started_at?: string;
  ended_at?: string;
};

function normPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("569") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("9") && digits.length === 9) return `+56${digits}`;
  if (digits.startsWith("56") && digits.length >= 11) return `+${digits}`;
  return `+56${digits}`;
}

export function useVoiceLeads() {
  const [leads, setLeads] = useState<VoiceLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First try to get data from voice_llamadas (new structured data)
      let voiceCalls: VoiceLead[] = [];
      try {
        const { data: callsRaw, error: callsError } = await (supabase as any)
          .from("voice_llamadas")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(200);
        const calls = callsRaw as any[] | null;

        if (!callsError && calls) {
          voiceCalls = calls.map((c, idx) => ({
            row: idx + 1,
            nombre: c.tool_payload?.Nombre_Lead || c.analysis?.perfil || "Sin nombre",
            telefono: c.phone || "",
            email: c.tool_payload?.email || c.analysis?.email || "",
            tipo_interes: c.tool_payload?.perfil_inmobiliario || c.analysis?.perfil || "",
            modelo_franquicia: "",
            ubicacion: c.tool_payload?.direccion || "",
            presupuesto: c.tool_payload?.precio || "",
            proposito: c.tool_payload?.tipo_interes || "",
            horario: c.tool_payload?.fecha_reunion ? `${c.tool_payload.fecha_reunion} ${c.tool_payload.hora_reunion || ""}` : "",
            resumen: c.summary || c.tool_payload?.transcripcioncion_resumida_a_texto || c.transcript || "",
            informe: c.transcript || "",
            status: c.status || "nuevo",
            source: "voice_llamadas",
            created_at: c.started_at || "",
            tags: "",
            // new fields
            summary: c.summary,
            transcript: c.transcript,
            recording_url: c.recording_url,
            duration_seconds: c.duration_seconds,
            cost_usd: c.cost_usd,
            analysis: c.analysis,
            tool_payload: c.tool_payload,
            started_at: c.started_at,
            ended_at: c.ended_at,
          }));
        }
      } catch (e) {
        console.warn("[useVoiceLeads] voice_llamadas query failed, will try Sheet fallback", e);
      }

      // Then get Sheet data as fallback/merge
      let sheetLeads: VoiceLead[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("voice-leads", {
          method: "GET",
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Error desconocido");
        setIsFallback(Boolean(data.fallback));
        if (data.fallback) {
          setError("Google Sheets alcanzó su límite de lectura. Mostrando datos disponibles; intenta actualizar en unos minutos.");
        }
        sheetLeads = (data.leads || []) as VoiceLead[];
      } catch (e) {
        console.warn("[useVoiceLeads] Sheet fallback failed", e);
      }

      // Merge: prioritize voice_llamadas (more recent/structured), fallback to Sheet
      // Use normalized phone as key for deduplication
      const merged = new Map<string, VoiceLead>();

      // Add voice_llamadas first (primary source)
      for (const lead of voiceCalls) {
        const key = normPhoneE164(lead.telefono);
        if (!merged.has(key)) merged.set(key, lead);
      }

      // Add Sheet leads for any not in voice_llamadas
      for (const lead of sheetLeads) {
        const key = normPhoneE164(lead.telefono);
        if (!merged.has(key)) merged.set(key, lead);
      }

      const allLeads = Array.from(merged.values());
      setLeads(allLeads);

    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsFallback(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateStatus = useCallback(
    async (phone: string, status: string) => {
      // Optimistic
      setLeads((prev) =>
        prev.map((l) => (normPhoneE164(l.telefono) === normPhoneE164(phone) ? { ...l, status } : l)),
      );
      const { data, error } = await supabase.functions.invoke("voice-leads", {
        method: "POST",
        body: { action: "update_status", phone, status },
      });
      if (error || !data?.success) {
        await fetchLeads();
        throw new Error(
          data?.fallback
            ? "Google Sheets alcanzó su límite. Intenta mover el lead en unos minutos."
            : error?.message || data?.error || "Error actualizando",
        );
      }
    },
    [fetchLeads],
  );

  const deleteLead = useCallback(
    async (phone: string) => {
      const prev = leads;
      setLeads((p) => p.filter((l) => normPhoneE164(l.telefono) !== normPhoneE164(phone)));
      const { data, error } = await supabase.functions.invoke("voice-leads", {
        method: "POST",
        body: { action: "delete", phone },
      });
      if (error || !data?.success) {
        setLeads(prev);
        throw new Error(
          data?.fallback
            ? "Google Sheets alcanzó su límite. Intenta eliminar el lead en unos minutos."
            : error?.message || data?.error || "Error eliminando",
        );
      }
      await fetchLeads();
    },
    [leads, fetchLeads],
  );

  return { leads, loading, error, isFallback, refetch: fetchLeads, updateStatus, deleteLead };
}
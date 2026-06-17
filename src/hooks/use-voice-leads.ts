import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceLead = {
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
};

export function useVoiceLeads() {
  const [leads, setLeads] = useState<VoiceLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("voice-leads", {
        method: "GET",
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error desconocido");
      setLeads(data.leads as VoiceLead[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        prev.map((l) => (l.telefono === phone ? { ...l, status } : l)),
      );
      const { data, error } = await supabase.functions.invoke("voice-leads", {
        method: "POST",
        body: { action: "update_status", phone, status },
      });
      if (error || !data?.success) {
        // revert
        await fetchLeads();
        throw new Error(error?.message || data?.error || "Error actualizando");
      }
    },
    [fetchLeads],
  );

  const deleteLead = useCallback(
    async (phone: string) => {
      const prev = leads;
      setLeads((p) => p.filter((l) => l.telefono !== phone));
      const { data, error } = await supabase.functions.invoke("voice-leads", {
        method: "POST",
        body: { action: "delete", phone },
      });
      if (error || !data?.success) {
        setLeads(prev);
        throw new Error(error?.message || data?.error || "Error eliminando");
      }
      // Refetch to ensure the sheet state matches the UI (row physically removed)
      await fetchLeads();
    },
    [leads, fetchLeads],
  );


  return { leads, loading, error, refetch: fetchLeads, updateStatus, deleteLead };
}

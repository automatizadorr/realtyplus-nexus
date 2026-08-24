import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  REMITENTE_CUPO, REMITENTE_DOMINIO, type RemitenteConfig, type RemitenteModo,
} from "@/components/vendedor/types";

const POR_DEFECTO: RemitenteConfig = {
  remitente_modo: "auto",
  remitente_from_name: null,
  remitente_local: null,
  remitente_particular: null,
  remitente_reply_to: null,
};

/**
 * Remitente de correo del vendedor.
 *
 * Las dos cuentas Resend gratis dan 100 correos/día cada una (200 en total).
 * El vendedor elige si quiere repartir entre ambas ("auto"), fijar una sola
 * — útil para que un dominio no se queme mientras el otro descansa — o no
 * usar Resend y mandar desde su propio correo ("particular"), que no gasta
 * cupo pero se abre en su cliente de correo.
 */
export function useRemitente() {
  const [config, setConfig] = useState<RemitenteConfig>(POR_DEFECTO);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) { setCargando(false); return; }
    const { data } = await supabase
      .from("vendedores")
      .select("remitente_modo, remitente_from_name, remitente_local, remitente_particular, remitente_reply_to")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) setConfig({ ...POR_DEFECTO, ...(data as Partial<RemitenteConfig>) });
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (next: RemitenteConfig) => {
    const { error } = await supabase.rpc("vendedor_set_remitente", {
      _modo: next.remitente_modo,
      _from_name: next.remitente_from_name,
      _local: next.remitente_local,
      _particular: next.remitente_particular,
      _reply_to: next.remitente_reply_to,
    });
    if (error) throw error;
    await cargar();
  }, [cargar]);

  return { config, cargando, recargar: cargar, guardar };
}

/** Etiqueta legible del remitente tal como lo verá el destinatario. */
export function describirRemitente(c: RemitenteConfig): string {
  const nombre = c.remitente_from_name?.trim() || "Tu nombre";
  if (c.remitente_modo === "particular") {
    return `${nombre} <${c.remitente_particular || "tu-correo@ejemplo.com"}>`;
  }
  const local = c.remitente_local?.trim() || "no-reply";
  const dominio = REMITENTE_DOMINIO[c.remitente_modo];
  return `${nombre} <${local}@${c.remitente_modo === "auto" ? "send.lexhouse-ai.com" : dominio}>`;
}

/** Cupo diario del modo elegido (null = sin límite de Resend). */
export function cupoDe(modo: RemitenteModo): number | null {
  return REMITENTE_CUPO[modo];
}

/**
 * Cuerpo que se manda a la edge function `send-personalized-campaign` para
 * que respete el remitente elegido. Con modo "particular" no se llama a la
 * función: el envío se abre en el cliente de correo del vendedor.
 */
export function bodyRemitente(c: RemitenteConfig): { fromName?: string; fromEmail?: string; replyTo?: string; remitente?: RemitenteModo } {
  if (c.remitente_modo === "particular") return {};
  return {
    fromName: c.remitente_from_name?.trim() || undefined,
    fromEmail: c.remitente_local?.trim() ? `${c.remitente_local.trim()}@send.lexhouse-ai.com` : undefined,
    replyTo: c.remitente_reply_to?.trim() || c.remitente_particular?.trim() || undefined,
    remitente: c.remitente_modo,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/icebreakers";

// RPC nueva (telefonos_contactados_wa) todavía no está en los tipos generados.
const sb = supabase as any;

/**
 * Clave anti-spam de un teléfono: el número tal como se marcaría en WhatsApp,
 * recortado a sus últimos 9 dígitos. Así "34600778118" y "600778118" — la misma
 * persona cargada dos veces con y sin prefijo de país — dan la MISMA clave.
 */
export function claveTelefono(telefono?: string | null, pais?: string | null): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return "";
  const wa = normalizePhone(digitos, pais ?? undefined);
  return wa.length >= 9 ? wa.slice(-9) : wa;
}

type Contactable = { id: string; telefono?: string | null; pais?: string | null };

/**
 * Evita que un vendedor le mande WhatsApp DOS VECES al mismo número cuando el
 * número está cargado en más de un lead (a veces con otro nombre escrito).
 *
 * Volver a escribirle al MISMO lead sigue permitido: eso es seguimiento, no spam.
 * Solo se bloquea el número que ya recibió un mensaje desde OTRO lead.
 */
export function useGuardiaWhatsapp() {
  const [listo, setListo] = useState(false);
  // clave de teléfono → ids de leads desde los que ya se envió.
  const mapa = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await sb.rpc("telefonos_contactados_wa");
      if (!vivo) return;
      if (!error && Array.isArray(data)) {
        const m = new Map<string, Set<string>>();
        for (const r of data as { tel_norm: string; lead_id: string }[]) {
          if (!r?.tel_norm) continue;
          const set = m.get(r.tel_norm) ?? new Set<string>();
          set.add(r.lead_id);
          m.set(r.tel_norm, set);
        }
        mapa.current = m;
      }
      setListo(true);
    })();
    return () => { vivo = false; };
  }, []);

  /** true si a ese número ya se le mandó WhatsApp desde un lead distinto. */
  const esDuplicadoYaContactado = useCallback((lead: Contactable): boolean => {
    const clave = claveTelefono(lead.telefono, lead.pais);
    if (!clave) return false;
    const previos = mapa.current.get(clave);
    if (!previos) return false;
    for (const id of previos) if (id !== lead.id) return true;
    return false;
  }, []);

  /** Registra en memoria un envío recién hecho, para que la misma sesión no repita. */
  const registrarEnvio = useCallback((lead: Contactable) => {
    const clave = claveTelefono(lead.telefono, lead.pais);
    if (!clave) return;
    const set = mapa.current.get(clave) ?? new Set<string>();
    set.add(lead.id);
    mapa.current.set(clave, set);
  }, []);

  /**
   * Deja una sola entrada por número dentro de la misma tanda y saca los que ya
   * fueron contactados desde otro lead. Devuelve la lista limpia y cuántos se
   * saltaron, para poder avisarlo.
   */
  const filtrarTanda = useCallback(<T extends Contactable>(leads: T[]): { enviar: T[]; saltados: number } => {
    const vistos = new Set<string>();
    const enviar: T[] = [];
    let saltados = 0;
    for (const l of leads) {
      const clave = claveTelefono(l.telefono, l.pais);
      if (clave && (vistos.has(clave) || esDuplicadoYaContactado(l))) { saltados++; continue; }
      if (clave) vistos.add(clave);
      enviar.push(l);
    }
    return { enviar, saltados };
  }, [esDuplicadoYaContactado]);

  return { listo, esDuplicadoYaContactado, registrarEnvio, filtrarTanda };
}

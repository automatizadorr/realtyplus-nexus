import { supabase } from "@/integrations/supabase/client";
import { bodyRemitente } from "@/hooks/use-remitente";
import type { RemitenteConfig } from "@/components/vendedor/types";

// ---------------------------------------------------------------------
// Enviar un correo a un solo lead, sin depender del PC del vendedor.
//
// `mailto:` solo funciona si el sistema operativo tiene un programa de
// correo asociado. En una máquina donde el correo se usa por la web, el
// mailto abre el navegador en su página de inicio y el mensaje nunca se
// escribe. Por eso el camino por defecto es el envío por Resend (misma
// edge function que Correos Personalizados, que acota al vendedor a sus
// propios leads) y las alternativas son compositores WEB.
// ---------------------------------------------------------------------

/** Texto plano a HTML simple: respeta los saltos de línea y escapa el resto. */
export function textoAHtml(texto: string): string {
  const escapado = texto
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escapado
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function urlGmail(para: string, asunto: string, cuerpo: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export function urlOutlook(para: string, asunto: string, cuerpo: string): string {
  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(para)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

export function urlMailto(para: string, asunto: string, cuerpo: string): string {
  return `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/**
 * Manda el correo por Resend. Lanza si el servidor no confirma el envío:
 * quien llama tiene que poder distinguir "salió" de "no salió" para no
 * anotar en el historial un contacto que nunca ocurrió.
 */
export async function enviarCorreoLead(opts: {
  remitente: RemitenteConfig;
  para: string;
  nombre?: string | null;
  pais?: string | null;
  // Datos extra para las variables de la plantilla (la edge los reemplaza por
  // destinatario: {{empresa}}, {{ciudad}}, {{gancho}}). Buscar Leads los tiene
  // (los genera la IA); los demás flujos los pueden omitir.
  empresa?: string | null;
  ciudad?: string | null;
  gancho?: string | null;
  asunto: string;
  html: string;
  text?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-personalized-campaign", {
    body: {
      ...bodyRemitente(opts.remitente),
      subject: opts.asunto,
      html: opts.html,
      text: opts.text || undefined,
      recipients: [{
        email: opts.para,
        nombre: opts.nombre || undefined,
        pais: opts.pais || undefined,
        empresa: opts.empresa || undefined,
        ciudad: opts.ciudad || undefined,
        gancho: opts.gancho || undefined,
      }],
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.sent) throw new Error(data?.aviso || "El servidor no confirmó el envío");
}

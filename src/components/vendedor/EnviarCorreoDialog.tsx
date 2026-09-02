import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, ExternalLink, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fillTemplate } from "@/lib/fillTemplate";
import { describirRemitente, useRemitente } from "@/hooks/use-remitente";
import { enviarCorreoLead, textoAHtml, urlGmail, urlMailto, urlOutlook } from "@/lib/correoLead";
import type { PlantillaEmail } from "@/components/vendedor/types";

// ---------------------------------------------------------------------
// Enviar un correo a UN lead, desde la app.
//
// Antes esto era un `mailto:`, y un mailto solo funciona si la máquina tiene
// un programa de correo asociado. En un PC donde el correo se usa por la web
// (Gmail en Brave, por ejemplo) el sistema no sabe a quién dárselo: abre el
// navegador en su página de inicio y el correo nunca se escribe. Eso es lo
// que le pasaba al vendedor.
//
// Ahora el camino por defecto es el envío real por Resend (la misma edge
// function que usa Correos Personalizados, que ya acota al vendedor a sus
// propios leads). El mailto queda como último recurso, y para quien manda
// desde su cuenta personal está el compositor web de Gmail o de Outlook,
// que no dependen de ningún programa instalado.
// ---------------------------------------------------------------------

export default function EnviarCorreoDialog({ open, onOpenChange, lead, plantillasEmail, onEnviado, asuntoInicial, cuerpoInicial }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: {
    id?: string; nombre: string | null; email: string | null; pais: string | null;
    // Extras que enriquecen las variables de las plantillas (Buscar Leads los
    // trae de la IA: {{ciudad}}, {{empresa}} y {{gancho}} se rellenan también).
    ciudad?: string | null; propuesta_valor?: string | null; problemas?: string[];
  } | null;
  plantillasEmail: PlantillaEmail[];
  /** El correo salió: la pantalla marca el canal usado para cerrar el paso. */
  onEnviado?: () => void;
  /** Borrador ya redactado (mensaje que la IA escribió para este lead). Si
      viene, no se preselecciona plantilla: el vendedor la puede elegir encima
      y al cambiarla el texto se reemplaza por el de la plantilla. */
  asuntoInicial?: string;
  cuerpoInicial?: string;
}) {
  const { toast } = useToast();
  const { config: remitente } = useRemitente();
  const [plantillaId, setPlantillaId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const plantilla = plantillasEmail.find((p) => p.id === plantillaId);
  const esParticular = remitente.remitente_modo === "particular";

  const vars = useMemo(
    () => ({
      nombre: lead?.nombre || undefined, pais: lead?.pais || undefined,
      ciudad: lead?.ciudad || undefined, propuesta_valor: lead?.propuesta_valor || undefined,
      problemas: lead?.problemas,
    }),
    [lead?.nombre, lead?.pais, lead?.ciudad, lead?.propuesta_valor, lead?.problemas],
  );

  const rellenarDesdePlantilla = useCallback((id: string, list: PlantillaEmail[] = plantillasEmail) => {
    const p = list.find((x) => x.id === id);
    setAsunto(fillTemplate(p?.asunto ?? "", vars));
    setCuerpo(fillTemplate(p?.cuerpo_text ?? "", vars));
  }, [plantillasEmail, vars]);

  // Al abrir se arma el borrador: con texto inicial (mensaje de la IA) se usa
  // tal cual y sin plantilla elegida; sin él, la primera plantilla como antes.
  // El cambio de plantilla lo maneja el onValueChange del select, que rellena.
  useEffect(() => {
    if (!open) return;
    setTocado(false);
    if (cuerpoInicial || asuntoInicial) {
      setPlantillaId("");
      setAsunto(asuntoInicial ?? "");
      setCuerpo(cuerpoInicial ?? "");
    } else {
      const p = plantillasEmail[0];
      setPlantillaId(p?.id ?? "");
      rellenarDesdePlantilla(p?.id ?? "", plantillasEmail);
    }
  }, [open, asuntoInicial, cuerpoInicial, plantillasEmail, rellenarDesdePlantilla]);

  if (!lead) return null;

  const para = lead.email ?? "";

  const enviarPorResend = async () => {
    if (!para) return;
    if (!asunto.trim()) {
      toast({ title: "Falta el asunto", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      // Si el vendedor editó el texto, manda lo que escribió; si no tocó nada
      // y la plantilla tiene diseño, se manda el diseño tal cual.
      const html = tocado || !plantilla?.cuerpo_html
        ? textoAHtml(cuerpo)
        : fillTemplate(plantilla.cuerpo_html, vars);
      await enviarCorreoLead({
        remitente, para, nombre: lead.nombre, pais: lead.pais,
        empresa: lead.nombre, ciudad: lead.ciudad ?? undefined,
        gancho: Array.isArray(lead.problemas) && lead.problemas.length ? lead.problemas[0] : undefined,
        asunto, html, text: cuerpo || undefined,
      });
      toast({ title: "Correo enviado", description: `A ${para}. Marcá abajo qué pasó para cerrar el paso.` });
      onEnviado?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "No se pudo enviar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  const abrirEnWeb = (url: string) => {
    window.open(url, "_blank", "noreferrer");
    onEnviado?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Escribir a {lead.nombre || "el lead"}</DialogTitle>
        </DialogHeader>

        {!para ? (
          <p className="text-sm text-muted-foreground">Este lead no tiene correo cargado.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Para <span className="font-medium text-foreground">{para}</span>
              {!esParticular && <> · sale como <span className="font-medium text-foreground">{describirRemitente(remitente)}</span></>}
            </p>

            {plantillasEmail.length > 0 && (
              <Select value={plantillaId} onValueChange={(v) => { setPlantillaId(v); rellenarDesdePlantilla(v); setTocado(false); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Elegí una plantilla" /></SelectTrigger>
                <SelectContent>
                  {plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Input
              value={asunto} onChange={(e) => { setAsunto(e.target.value); setTocado(true); }}
              placeholder="Asunto" className="h-9 text-sm"
            />
            <Textarea
              value={cuerpo} onChange={(e) => { setCuerpo(e.target.value); setTocado(true); }}
              placeholder="Escribí el mensaje…" rows={9} className="text-sm"
            />

            {esParticular ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p>
                  Tenés configurado mandar desde tu correo personal, así que el envío no sale desde la
                  plataforma: abrilo en Gmail o en Outlook y mandalo desde tu cuenta. Si preferís que salga
                  solo desde acá, cambiá el remitente en <span className="font-medium">Más → Diseño de Correo</span>.
                </p>
              </div>
            ) : (
              <Button
                type="button" onClick={enviarPorResend} disabled={enviando}
                className="w-full gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar ahora
              </Button>
            )}

            {/* Alternativas que NO dependen de tener un programa de correo
                instalado: son páginas web. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => abrirEnWeb(urlGmail(para, asunto, cuerpo))}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir en Gmail
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => abrirEnWeb(urlOutlook(para, asunto, cuerpo))}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir en Outlook
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
                onClick={() => abrirEnWeb(urlMailto(para, asunto, cuerpo))}>
                Mi programa de correo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

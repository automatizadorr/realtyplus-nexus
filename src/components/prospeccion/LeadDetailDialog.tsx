import { Copy, MessageCircle, Mail as MailIcon, Globe, MapPin, Instagram, Check, Users } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { pickIcebreaker, normalizePhone } from "@/lib/icebreakers";
import { PAISES_PROSPECCION } from "@/lib/paises";

export type Lead = {
  id?: string;
  nombre?: string; ciudad?: string; region?: string; pais?: string; web?: string;
  telefono?: string; whatsapp?: string; email?: string; instagram?: string;
  direccion?: string; google_maps?: string; fuente?: string;
  score?: number; nivel?: string; tipo_lead?: string; problemas?: string[];
  propuesta_valor?: string; mensaje_whatsapp?: string; mensaje_email?: string;
  estado_gestion?: string; notas?: string; repetido?: boolean;
  en_campana?: boolean;
  // Puente con el Pipeline del vendedor: si tiene lead_campana_id, este
  // prospecto ya vive en su Bandeja/Pipeline (leads_campana).
  lead_campana_id?: string | null;
  mensaje_instagram?: string;
  facebook?: string;
  rating?: number;
};

export const ESTADOS = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};

// Construye el link de WhatsApp con código de país normalizado.
export function waLink(l: Lead): string | null {
  const w = (l.whatsapp || "").trim();
  if (w.startsWith("http")) return w;
  const raw = (w || l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  const digits = normalizePhone(raw, l.pais || l.region || l.ciudad);
  return `https://wa.me/${digits}`;
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button" size="sm" variant="outline" className="gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true); setTimeout(() => setOk(false), 1500);
          toast({ title: "Copiado", description: label });
        } catch { toast({ title: "No se pudo copiar", variant: "destructive" }); }
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar
    </Button>
  );
}

type Props = {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  // Solo en Historial (leads persistidos): permiten editar estado/notas en BD.
  onEstadoChange?: (lead: Lead, estado: string) => void;
  onNotasChange?: (lead: Lead, notas: string) => void;
  // Solo admin: publicar/despublicar el lead para el equipo de vendedores.
  onCampanaChange?: (lead: Lead, pais: string, enCampana: boolean) => void;
  canPublicar?: boolean;
};

export default function LeadDetailDialog({
  lead, open, onOpenChange, onEstadoChange, onNotasChange, onCampanaChange, canPublicar,
}: Props) {
  const [notasDraft, setNotasDraft] = useState("");
  const initialWaText = lead
    ? (lead.mensaje_whatsapp || pickIcebreaker(
        lead.id || lead.telefono || lead.nombre || "x",
        { nombre: lead.nombre, ciudad: lead.ciudad, empresa: lead.nombre, pais: lead.pais || lead.region },
      ))
    : "";
  const [waDraft, setWaDraft] = useState(initialWaText);
  const [paisDraft, setPaisDraft] = useState(lead?.pais || "");
  // Reset del borrador cuando cambia el lead visible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setWaDraft(initialWaText); }, [lead?.id, lead?.mensaje_whatsapp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPaisDraft(lead?.pais || ""); }, [lead?.id]);
  if (!lead) return null;
  const wa = waLink(lead);
  const persisted = Boolean(lead.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.nombre || "Prospecto"}
            {typeof lead.score === "number" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="cursor-help font-mono">score {lead.score}</Badge>
                </TooltipTrigger>
                <TooltipContent>0–100: qué tan probable es que este negocio necesite tu servicio.</TooltipContent>
              </Tooltip>
            )}
            {lead.tipo_lead && <Badge variant="outline">{lead.tipo_lead}</Badge>}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.ciudad || "—"}{lead.region ? `, ${lead.region}` : ""}</span>
            {lead.web && <a href={lead.web} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#003DA5] hover:underline"><Globe className="h-3 w-3" /> web</a>}
            {lead.instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" /> {lead.instagram}</span>}
            {lead.fuente && <span className="text-muted-foreground">· fuente: {lead.fuente}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contacto */}
          <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
            {lead.email && <div className="flex items-center gap-1.5"><MailIcon className="h-3.5 w-3.5 text-muted-foreground" /> {lead.email}</div>}
            {(lead.telefono || lead.whatsapp) && <div className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> {lead.telefono || lead.whatsapp}</div>}
            {lead.direccion && <div className="flex items-center gap-1.5 sm:col-span-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {lead.direccion}</div>}
            {lead.google_maps && <a href={lead.google_maps} target="_blank" rel="noreferrer" className="text-[#003DA5] hover:underline">Ver en Google Maps</a>}
          </div>

          {/* Problemas + propuesta */}
          {Array.isArray(lead.problemas) && lead.problemas.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Problemas detectados</Label>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {lead.problemas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {lead.propuesta_valor && (
            <div className="rounded-lg border border-[#003DA5]/20 bg-[#003DA5]/5 p-3 text-sm">
              <span className="font-medium">Propuesta de valor: </span>{lead.propuesta_valor}
            </div>
          )}

          {/* Mensajes listos */}
          {waDraft && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mensaje de WhatsApp</Label>
                <div className="flex gap-2">
                  <CopyBtn text={waDraft} label="Mensaje WhatsApp copiado" />
                  {wa && (
                    <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <a href={`${wa}?text=${encodeURIComponent(waDraft)}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" /> Abrir
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={waDraft} onChange={(e) => setWaDraft(e.target.value)} className="min-h-[90px] text-sm" />
            </div>
          )}
          {lead.mensaje_email && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mensaje de email</Label>
                <div className="flex gap-2">
                  <CopyBtn text={lead.mensaje_email} label="Mensaje email copiado" />
                  {lead.email && (
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={`mailto:${lead.email}?subject=${encodeURIComponent("Sobre " + (lead.nombre || ""))}&body=${encodeURIComponent(lead.mensaje_email)}`}>
                        <MailIcon className="h-3.5 w-3.5" /> Abrir
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <Textarea readOnly value={lead.mensaje_email} className="min-h-[110px] text-sm" />
            </div>
          )}

          {/* Mini-CRM: estado + notas (solo prospectos guardados) */}
          {persisted && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">Estado de gestión</Label>
                {ESTADOS.map((e) => (
                  <button
                    key={e} type="button"
                    onClick={() => onEstadoChange?.(lead, e)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                      (lead.estado_gestion || "nuevo") === e
                        ? "border-[#003DA5] bg-[#003DA5] text-white"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {ESTADO_LABEL[e]}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notas</Label>
                <Textarea
                  defaultValue={lead.notas || ""}
                  onChange={(e) => setNotasDraft(e.target.value)}
                  onBlur={() => { if (notasDraft && notasDraft !== (lead.notas || "")) onNotasChange?.(lead, notasDraft); }}
                  placeholder="Anota resultado de la llamada, próximos pasos…"
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          )}

          {/* Vendedores: publicar el lead con país para que el equipo de ventas lo vea */}
          {persisted && canPublicar && (
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Vendedores
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={paisDraft} onValueChange={setPaisDraft}>
                  <SelectTrigger className="h-9 w-[180px] text-sm">
                    <SelectValue placeholder="País del lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES_PROSPECCION.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={Boolean(lead.en_campana)}
                    disabled={!paisDraft}
                    onCheckedChange={(checked) => onCampanaChange?.(lead, paisDraft, checked)}
                  />
                  {lead.en_campana ? "Publicado a vendedores" : "Publicar a vendedores"}
                </label>
              </div>
              {!paisDraft && (
                <p className="text-[11px] text-muted-foreground">Elige el país antes de publicar.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

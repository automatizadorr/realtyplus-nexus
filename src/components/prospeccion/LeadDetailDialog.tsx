import { Copy, MessageCircle, Mail as MailIcon, Globe, MapPin, Instagram, Check } from "lucide-react";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type Lead = {
  id?: string;
  nombre?: string; ciudad?: string; region?: string; web?: string;
  telefono?: string; whatsapp?: string; email?: string; instagram?: string;
  direccion?: string; google_maps?: string; fuente?: string;
  score?: number; nivel?: string; tipo_lead?: string; problemas?: string[];
  propuesta_valor?: string; mensaje_whatsapp?: string; mensaje_email?: string;
  estado_gestion?: string; notas?: string; repetido?: boolean;
};

export const ESTADOS = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};

// Construye el link de WhatsApp: usa el campo whatsapp si ya es URL, si no arma wa.me con el teléfono.
export function waLink(l: Lead): string | null {
  const w = (l.whatsapp || "").trim();
  if (w.startsWith("http")) return w;
  const digits = (w || l.telefono || "").replace(/[^\d]/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
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
};

export default function LeadDetailDialog({ lead, open, onOpenChange, onEstadoChange, onNotasChange }: Props) {
  const [notasDraft, setNotasDraft] = useState("");
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
              <Badge variant="secondary" className="font-mono">score {lead.score}</Badge>
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
          {lead.mensaje_whatsapp && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Mensaje de WhatsApp</Label>
                <div className="flex gap-2">
                  <CopyBtn text={lead.mensaje_whatsapp} label="Mensaje WhatsApp copiado" />
                  {wa && (
                    <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <a href={`${wa}?text=${encodeURIComponent(lead.mensaje_whatsapp)}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" /> Abrir
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <Textarea readOnly value={lead.mensaje_whatsapp} className="min-h-[90px] text-sm" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

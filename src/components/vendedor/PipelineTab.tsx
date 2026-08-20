import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { Loader2, MapPin, Mail as MailIcon, MessageCircle, RefreshCw, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/lib/icebreakers";
import { fillTemplate } from "@/lib/fillTemplate";
import { ETAPAS, ETAPA_LABEL, type Etapa, type LeadCampana, type PlantillaEmail, type PlantillaWa } from "@/components/vendedor/types";

// leads_campana con las columnas nuevas aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function waLinkCampana(l: LeadCampana): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function Contactar({
  lead, plantillasWa, plantillasEmail, onEnviado,
}: {
  lead: LeadCampana;
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  onEnviado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [waPlantilla, setWaPlantilla] = useState("");
  const [emailPlantilla, setEmailPlantilla] = useState("");
  const [waPreview, setWaPreview] = useState("");
  const [emailPreview, setEmailPreview] = useState("");
  const wa = waLinkCampana(lead);

  const registrar = async (canal: "whatsapp" | "email", plantillaId: string, mensaje: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    await sb.from("contactos_log").insert({
      lead_id: lead.id, user_id: uid, canal, plantilla_id: plantillaId, mensaje_final: mensaje, origen: "leads_campana",
    });
    onEnviado();
  };

  const enviarWa = () => {
    const p = plantillasWa.find((x) => x.id === waPlantilla);
    if (!p || !wa) return;
    const msg = waPreview || fillTemplate(p.contenido, { nombre: lead.nombre || undefined, pais: lead.pais || undefined });
    window.open(`${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    registrar("whatsapp", p.id, msg);
  };

  const enviarEmail = () => {
    const p = plantillasEmail.find((x) => x.id === emailPlantilla);
    if (!p || !lead.email) return;
    const asunto = fillTemplate(p.asunto, { nombre: lead.nombre || undefined, pais: lead.pais || undefined });
    const cuerpo = emailPreview || fillTemplate(p.cuerpo_text || p.cuerpo_html, { nombre: lead.nombre || undefined, pais: lead.pais || undefined });
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    registrar("email", p.id, `${asunto}\n\n${cuerpo}`);
  };

  if (!abierto) {
    return (
      <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setAbierto(true)}>
        <MessageCircle className="h-3 w-3" /> Contactar
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={waPlantilla} onValueChange={(v) => { setWaPlantilla(v); const p = plantillasWa.find((x) => x.id === v); setWaPreview(p ? fillTemplate(p.contenido, { nombre: lead.nombre || undefined, pais: lead.pais || undefined }) : ""); }}>
          <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Plantilla WA" /></SelectTrigger>
          <SelectContent>{plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
        {!wa && <span className="text-[10px] text-muted-foreground">sin WhatsApp</span>}
      </div>
      {waPlantilla && (
        <div className="space-y-1">
          <Textarea value={waPreview} onChange={(e) => setWaPreview(e.target.value)} className="min-h-[60px] bg-background text-xs" />
          <Button type="button" size="sm" disabled={!wa || !waPreview.trim()} onClick={enviarWa} className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700">
            <MessageCircle className="h-3 w-3" /> Enviar WA
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={emailPlantilla} onValueChange={(v) => { setEmailPlantilla(v); const p = plantillasEmail.find((x) => x.id === v); setEmailPreview(p ? fillTemplate(p.cuerpo_text || p.cuerpo_html, { nombre: lead.nombre || undefined, pais: lead.pais || undefined }) : ""); }}>
          <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Plantilla email" /></SelectTrigger>
          <SelectContent>{plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
        {!lead.email && <span className="text-[10px] text-muted-foreground">sin email</span>}
      </div>
      {emailPlantilla && (
        <div className="space-y-1">
          <Textarea value={emailPreview} onChange={(e) => setEmailPreview(e.target.value)} className="min-h-[60px] bg-background text-xs" />
          <Button type="button" size="sm" variant="outline" disabled={!lead.email || !emailPreview.trim()} onClick={enviarEmail} className="h-7 gap-1 px-2 text-[11px]">
            <MailIcon className="h-3 w-3" /> Enviar email
          </Button>
        </div>
      )}
      <Button type="button" size="sm" variant="ghost" className="h-6 px-1 text-[10px] text-muted-foreground" onClick={() => setAbierto(false)}>Cerrar</Button>
    </div>
  );
}

function LeadCard({ lead, plantillasWa, plantillasEmail, onEnviado }: {
  lead: LeadCampana; plantillasWa: PlantillaWa[]; plantillasEmail: PlantillaEmail[]; onEnviado: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const dias = diasDesde(lead.fecha_asignacion);

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "z-50 opacity-60" : undefined}>
      <Card className="mb-2">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start gap-1.5">
            <button type="button" {...listeners} {...attributes} className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing">
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{lead.nombre || "—"}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                {lead.pais && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {lead.pais}</span>}
                {dias !== null && <span>· {dias}d</span>}
              </div>
            </div>
            {lead.ha_respondido && <Badge variant="secondary" className="shrink-0 text-[10px] text-emerald-600">respondió</Badge>}
          </div>
          {(lead.telefono || lead.email) && (
            <div className="space-y-0.5 text-[11px] text-muted-foreground">
              {lead.telefono && <div className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5 text-emerald-600" /> {lead.telefono}</div>}
              {lead.email && <div className="flex items-center gap-1"><MailIcon className="h-2.5 w-2.5" /> {lead.email}</div>}
            </div>
          )}
          <Contactar lead={lead} plantillasWa={plantillasWa} plantillasEmail={plantillasEmail} onEnviado={onEnviado} />
        </CardContent>
      </Card>
    </div>
  );
}

function Column({ etapa, leads, children }: { etapa: Etapa; leads: LeadCampana[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/20 p-2 transition-colors ${isOver ? "border-[#003DA5] bg-[#003DA5]/5" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{ETAPA_LABEL[etapa]}</span>
        <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
      </div>
      <div className="min-h-[60px] flex-1">{children}</div>
    </div>
  );
}

export default function PipelineTab({ plantillasWa, plantillasEmail }: { plantillasWa: PlantillaWa[]; plantillasEmail: PlantillaEmail[] }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadCampana[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [perdidoDialog, setPerdidoDialog] = useState<{ leadId: string } | null>(null);
  const [motivo, setMotivo] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("leads_campana")
      .select("id, nombre, telefono, email, pais, etapa_venta, ha_respondido, resumen_ia, fecha_asignacion, fecha_cierre, motivo_cierre")
      .order("fecha_asignacion", { ascending: false });
    if (error) toast({ title: "Error al cargar el pipeline", description: error.message, variant: "destructive" });
    else setLeads((data ?? []) as LeadCampana[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const porEtapa = useMemo(() => {
    const m = new Map<Etapa, LeadCampana[]>();
    for (const e of ETAPAS) m.set(e, []);
    for (const l of leads) {
      const e = (l.etapa_venta as Etapa) || "nuevo";
      (m.get(e) ?? m.get("nuevo")!).push(l);
    }
    return m;
  }, [leads]);

  const moverEtapa = async (leadId: string, etapa: Etapa, motivoCierre?: string) => {
    const { error } = await sb.rpc("vendedor_mover_etapa", { _lead_id: leadId, _etapa: etapa, _motivo_cierre: motivoCierre ?? null });
    if (error) { toast({ title: "No se pudo mover", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, etapa_venta: etapa, motivo_cierre: motivoCierre ?? l.motivo_cierre } : l)));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const leadId = String(e.active.id);
    const etapa = e.over?.id as Etapa | undefined;
    if (!etapa) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa_venta === etapa) return;
    if (etapa === "perdido") { setPerdidoDialog({ leadId }); setMotivo(""); return; }
    moverEtapa(leadId, etapa);
  };

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Arrastra un lead entre columnas para mover su etapa.</p>
        <Button type="button" variant="outline" size="sm" onClick={cargar} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Todavía no tienes leads de campaña asignados.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {ETAPAS.map((etapa) => (
              <Column key={etapa} etapa={etapa} leads={porEtapa.get(etapa) ?? []}>
                {(porEtapa.get(etapa) ?? []).map((l) => (
                  <LeadCard key={l.id} lead={l} plantillasWa={plantillasWa} plantillasEmail={plantillasEmail} onEnviado={() => {}} />
                ))}
              </Column>
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <Card className="w-72 opacity-90 shadow-lg">
                <CardContent className="p-3 text-sm font-medium">{activeLead.nombre || "—"}</CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={!!perdidoDialog} onOpenChange={(o) => !o && setPerdidoDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motivo de cierre</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">¿Por qué se perdió este lead?</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[80px] text-sm" placeholder="Ej: no le interesó, precio, ya tiene proveedor…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPerdidoDialog(null)}>Cancelar</Button>
            <Button
              type="button"
              disabled={!motivo.trim()}
              onClick={() => { if (perdidoDialog) moverEtapa(perdidoDialog.leadId, "perdido", motivo.trim()); setPerdidoDialog(null); }}
              className="bg-red-600 hover:bg-red-700"
            >
              Marcar perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

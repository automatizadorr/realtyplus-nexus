import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { Loader2, MapPin, Mail as MailIcon, MessageCircle, RefreshCw, GripVertical, CalendarClock, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  ETAPAS_PIPELINE, ETAPA_LABEL, ETAPAS_PERMITIDAS, type Etapa, type LeadCampana, type PlantillaEmail, type PlantillaWa, type RolVenta,
} from "@/components/vendedor/types";

// leads_campana con las columnas nuevas aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const COLUMNAS = "id, nombre, telefono, email, pais, etapa_venta, ha_respondido, resumen_ia, fecha_asignacion, fecha_cierre, motivo_cierre, fecha_proximo_contacto, vendedor_id";

// Cada columna se carga de a 25 (no todo el pipeline de una), para no volver
// lenta la plataforma cuando un vendedor tiene cientos o miles de leads.
const PAGE_SIZE = 25;

type ColState = { leads: LeadCampana[]; total: number; pagina: number; cargandoMas: boolean };
const columnaVacia = (): ColState => ({ leads: [], total: 0, pagina: 0, cargandoMas: false });

function waLinkCampana(l: LeadCampana): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Un lead pide atención "hoy" si tiene un seguimiento programado para hoy o
// antes. El SLA de primer contacto (antes ligado a la etapa "nuevo") ahora lo
// cubre la Bandeja: un lead solo entra al Pipeline cuando ya fue contactado.
function requiereHoy(l: LeadCampana): boolean {
  if (l.fecha_proximo_contacto) {
    const finDeHoy = new Date(); finDeHoy.setHours(23, 59, 59, 999);
    if (new Date(l.fecha_proximo_contacto).getTime() <= finDeHoy.getTime()) return true;
  }
  return false;
}

function finDeHoyISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
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
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
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

function Seguimiento({ lead, onProgramado }: { lead: LeadCampana; onProgramado: (fecha: string) => void }) {
  const { toast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(lead.fecha_proximo_contacto ? lead.fecha_proximo_contacto.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!fecha) return;
    setSaving(true);
    const iso = new Date(`${fecha}T09:00:00`).toISOString();
    const { error } = await sb.rpc("vendedor_set_proximo_contacto", { _lead_id: lead.id, _fecha: iso });
    setSaving(false);
    if (error) { toast({ title: "No se pudo programar", description: error.message, variant: "destructive" }); return; }
    onProgramado(iso);
    setAbierto(false);
  };

  if (!abierto) {
    return (
      <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground" onClick={() => setAbierto(true)}>
        <CalendarClock className="h-3 w-3" /> {lead.fecha_proximo_contacto ? "Cambiar seguimiento" : "Programar seguimiento"}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-6 rounded border px-1.5 text-[10px]" />
      <Button type="button" size="sm" disabled={!fecha || saving} onClick={guardar} className="h-6 px-2 text-[10px]">Guardar</Button>
      <Button type="button" size="sm" variant="ghost" className="h-6 px-1 text-[10px] text-muted-foreground" onClick={() => setAbierto(false)}>x</Button>
    </div>
  );
}

function LeadCard({ lead, plantillasWa, plantillasEmail, onEnviado, onProgramado, onArchivar }: {
  lead: LeadCampana; plantillasWa: PlantillaWa[]; plantillasEmail: PlantillaEmail[]; onEnviado: () => void;
  onProgramado: (leadId: string, fecha: string) => void;
  onArchivar: (leadId: string) => void;
}) {
  // Se puede agarrar la tarjeta desde cualquier parte (no solo el ícono):
  // los listeners van en el wrapper completo. Los controles interactivos
  // (Contactar/Seguimiento) cortan la propagación para que un clic ahí
  // nunca se confunda con un intento de arrastre.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const dias = diasDesde(lead.fecha_asignacion);
  const seguimientoVencido = lead.fecha_proximo_contacto && new Date(lead.fecha_proximo_contacto).getTime() <= Date.now();

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? "z-50 opacity-60" : ""}`}
    >
      <Card className="mb-2">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start gap-1.5">
            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{lead.nombre || "—"}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                {lead.pais && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {lead.pais}</span>}
                {dias !== null && <span>· {dias}d</span>}
              </div>
            </div>
            {lead.ha_respondido && <Badge variant="secondary" className="shrink-0 text-[10px] text-emerald-600">respondió</Badge>}
          </div>

          {lead.fecha_proximo_contacto && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
              seguimientoVencido ? "border-amber-400/40 bg-amber-500/10 text-amber-700" : "border-input text-muted-foreground"
            }`}>
              <CalendarClock className="h-2.5 w-2.5" /> Seguimiento {new Date(lead.fecha_proximo_contacto).toLocaleDateString("es-CL")}
            </span>
          )}

          {(lead.telefono || lead.email) && (
            <div className="space-y-0.5 text-[11px] text-muted-foreground">
              {lead.telefono && <div className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5 text-emerald-600" /> {lead.telefono}</div>}
              {lead.email && <div className="flex items-center gap-1"><MailIcon className="h-2.5 w-2.5" /> {lead.email}</div>}
            </div>
          )}
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Contactar lead={lead} plantillasWa={plantillasWa} plantillasEmail={plantillasEmail} onEnviado={onEnviado} />
          </div>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Seguimiento lead={lead} onProgramado={(fecha) => onProgramado(lead.id, fecha)} />
          </div>
          <div onPointerDown={(e) => e.stopPropagation()}>
            <Button
              type="button" size="sm" variant="ghost"
              className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-red-600"
              onClick={() => onArchivar(lead.id)}
              title="Archivar (ej: número no existe)"
            >
              <Archive className="h-3 w-3" /> Archivar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Column({
  etapa, leads, total, hasMore, cargandoMas, onCargarMas, children,
}: {
  etapa: Etapa; leads: LeadCampana[]; total: number; hasMore: boolean; cargandoMas: boolean;
  onCargarMas: () => void; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/20 p-2 transition-colors ${isOver ? "border-[#003DA5] bg-[#003DA5]/5" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold">{ETAPA_LABEL[etapa]}</span>
        <Badge variant="secondary" className="text-[10px]">{leads.length}/{total}</Badge>
      </div>
      <div className="min-h-[60px] flex-1">
        {children}
        {hasMore && (
          <Button
            type="button" variant="ghost" size="sm" onClick={onCargarMas} disabled={cargandoMas}
            className="w-full gap-1.5 text-xs text-muted-foreground"
          >
            {cargandoMas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Cargar 25 más
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PipelineTab({ plantillasWa, plantillasEmail }: { plantillasWa: PlantillaWa[]; plantillasEmail: PlantillaEmail[] }) {
  const { toast } = useToast();
  const [cols, setCols] = useState<Record<Etapa, ColState>>(() =>
    Object.fromEntries(ETAPAS_PIPELINE.map((e) => [e, columnaVacia()])) as Record<Etapa, ColState>);
  const [hoyLeads, setHoyLeads] = useState<LeadCampana[] | null>(null); // null = modo normal (paginado); array = "Solo hoy"
  const [hoyCount, setHoyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [perdidoDialog, setPerdidoDialog] = useState<{ leadId: string; etapaOrigen: Etapa } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [soloHoy, setSoloHoy] = useState(false);
  const [miRol, setMiRol] = useState<RolVenta | undefined>(undefined);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cargarColumna = async (etapa: Etapa, pagina: number, append: boolean) => {
    setCols((prev) => ({ ...prev, [etapa]: { ...prev[etapa], cargandoMas: true } }));
    const { data, count, error } = await sb
      .from("leads_campana")
      .select(COLUMNAS, { count: "exact" })
      .not("primer_contacto_at", "is", null)
      .not("archivado", "is", true)
      .eq("etapa_venta", etapa)
      .order("fecha_asignacion", { ascending: false })
      .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) {
      toast({ title: "Error al cargar el pipeline", description: error.message, variant: "destructive" });
      setCols((prev) => ({ ...prev, [etapa]: { ...prev[etapa], cargandoMas: false } }));
      return;
    }
    const nuevos = (data ?? []) as LeadCampana[];
    setCols((prev) => {
      const actual = prev[etapa];
      const yaIds = new Set(actual.leads.map((l) => l.id));
      const filtrados = append ? nuevos.filter((l) => !yaIds.has(l.id)) : nuevos;
      return {
        ...prev,
        [etapa]: { leads: append ? [...actual.leads, ...filtrados] : filtrados, total: count ?? 0, pagina, cargandoMas: false },
      };
    });
  };

  const cargarHoyCount = async () => {
    const { count } = await sb
      .from("leads_campana")
      .select("id", { count: "exact", head: true })
      .not("primer_contacto_at", "is", null)
      .not("archivado", "is", true)
      .lte("fecha_proximo_contacto", finDeHoyISO());
    setHoyCount(count ?? 0);
  };

  const cargarHoy = async () => {
    const { data, error } = await sb
      .from("leads_campana")
      .select(COLUMNAS)
      .not("primer_contacto_at", "is", null)
      .not("archivado", "is", true)
      .lte("fecha_proximo_contacto", finDeHoyISO())
      .order("fecha_proximo_contacto", { ascending: true });
    if (error) { toast({ title: "Error al cargar lo de hoy", description: error.message, variant: "destructive" }); return; }
    setHoyLeads((data ?? []) as LeadCampana[]);
  };

  const cargarTodo = async () => {
    setLoading(true);
    const [, { data: perfil }] = await Promise.all([
      Promise.all(ETAPAS_PIPELINE.map((etapa) => cargarColumna(etapa, 0, false))),
      supabase.auth.getUser().then(({ data: u }) =>
        u?.user ? sb.from("vendedores").select("rol_venta").eq("user_id", u.user.id).maybeSingle() : { data: null },
      ),
      cargarHoyCount(),
    ]);
    setMiRol((perfil?.rol_venta as RolVenta | undefined) ?? undefined);
    if (soloHoy) await cargarHoy();
    setLoading(false);
  };

  useEffect(() => { cargarTodo(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (soloHoy) cargarHoy(); else setHoyLeads(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloHoy]);

  const vista = (etapa: Etapa): LeadCampana[] => {
    if (hoyLeads) {
      return hoyLeads.filter((l) => ((l.etapa_venta as Etapa) || "contactado") === etapa && requiereHoy(l));
    }
    return cols[etapa].leads;
  };
  const totalVista = (etapa: Etapa): number => (hoyLeads ? vista(etapa).length : cols[etapa].total);
  const hasMoreVista = (etapa: Etapa): boolean => (hoyLeads ? false : cols[etapa].leads.length < cols[etapa].total);

  const totalGeneral = ETAPAS_PIPELINE.reduce((acc, e) => acc + cols[e].total, 0);

  const buscarLead = (id: string): { lead: LeadCampana; etapa: Etapa } | null => {
    for (const etapa of ETAPAS_PIPELINE) {
      const encontrado = vista(etapa).find((l) => l.id === id);
      if (encontrado) return { lead: encontrado, etapa };
    }
    return null;
  };

  const onProgramado = (leadId: string, fecha: string) => {
    const actualizar = (l: LeadCampana) => (l.id === leadId ? { ...l, fecha_proximo_contacto: fecha } : l);
    setCols((prev) => {
      const next = { ...prev };
      for (const etapa of ETAPAS_PIPELINE) next[etapa] = { ...prev[etapa], leads: prev[etapa].leads.map(actualizar) };
      return next;
    });
    setHoyLeads((prev) => prev && prev.map(actualizar));
    cargarHoyCount();
  };

  const moverLocal = (leadId: string, etapaOrigen: Etapa, etapaDestino: Etapa, motivoCierre?: string) => {
    const parche = (l: LeadCampana): LeadCampana => ({ ...l, etapa_venta: etapaDestino, motivo_cierre: motivoCierre ?? l.motivo_cierre });
    if (hoyLeads) {
      setHoyLeads((prev) => prev && prev.map((l) => (l.id === leadId ? parche(l) : l)));
      return;
    }
    setCols((prev) => {
      const origen = prev[etapaOrigen];
      const destino = prev[etapaDestino];
      const lead = origen.leads.find((l) => l.id === leadId);
      if (!lead) return prev;
      return {
        ...prev,
        [etapaOrigen]: { ...origen, leads: origen.leads.filter((l) => l.id !== leadId), total: Math.max(origen.total - 1, 0) },
        [etapaDestino]: { ...destino, leads: [parche(lead), ...destino.leads], total: destino.total + 1 },
      };
    });
  };

  const moverEtapa = async (leadId: string, etapaOrigen: Etapa, etapaDestino: Etapa, motivoCierre?: string) => {
    const { error } = await sb.rpc("vendedor_mover_etapa", { _lead_id: leadId, _etapa: etapaDestino, _motivo_cierre: motivoCierre ?? null });
    if (error) { toast({ title: "No se pudo mover", description: error.message, variant: "destructive" }); return; }
    moverLocal(leadId, etapaOrigen, etapaDestino, motivoCierre);
  };

  // Archivar: para leads con número inexistente/imposible de contactar.
  // Desaparece del Pipeline (las consultas ya filtran archivado=true).
  const archivarLead = async (leadId: string) => {
    const encontrado = buscarLead(leadId);
    if (!encontrado) return;
    const { error } = await sb.rpc("vendedor_archivar_lead", { _lead_id: leadId, _archivado: true });
    if (error) { toast({ title: "No se pudo archivar", description: error.message, variant: "destructive" }); return; }
    const { etapa } = encontrado;
    if (hoyLeads) {
      setHoyLeads((prev) => prev && prev.filter((l) => l.id !== leadId));
    } else {
      setCols((prev) => ({
        ...prev,
        [etapa]: { ...prev[etapa], leads: prev[etapa].leads.filter((l) => l.id !== leadId), total: Math.max(prev[etapa].total - 1, 0) },
      }));
    }
    toast({ title: "Lead archivado" });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const leadId = String(e.active.id);
    const etapaDestino = e.over?.id as Etapa | undefined;
    if (!etapaDestino) return;
    const encontrado = buscarLead(leadId);
    if (!encontrado || encontrado.etapa === etapaDestino) return;
    const { etapa: etapaOrigen } = encontrado;

    if (!miRol || !ETAPAS_PERMITIDAS[miRol].includes(etapaDestino)) {
      toast({
        title: "No permitido",
        description: miRol
          ? `Como ${miRol} no puedes mover un lead a "${ETAPA_LABEL[etapaDestino]}".`
          : "No tenés un rol de venta asignado.",
        variant: "destructive",
      });
      return;
    }

    if (etapaDestino === "perdido") { setPerdidoDialog({ leadId, etapaOrigen }); setMotivo(""); return; }
    moverEtapa(leadId, etapaOrigen, etapaDestino);
  };

  const activeLead = activeId ? buscarLead(activeId)?.lead : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Arrastra una tarjeta desde cualquier parte para mover su etapa. Cada columna carga de a 25 leads.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <Switch checked={soloHoy} onCheckedChange={setSoloHoy} />
            Solo hoy {hoyCount > 0 && <Badge variant="secondary" className="text-[10px]">{hoyCount}</Badge>}
          </label>
          <Button type="button" variant="outline" size="sm" onClick={cargarTodo} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : !soloHoy && totalGeneral === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Todavía no tienes leads de campaña asignados.
        </div>
      ) : soloHoy && hoyCount === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nada pendiente para hoy. 🎉
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {ETAPAS_PIPELINE.map((etapa) => (
              <Column
                key={etapa} etapa={etapa} leads={vista(etapa)} total={totalVista(etapa)}
                hasMore={hasMoreVista(etapa)} cargandoMas={cols[etapa].cargandoMas}
                onCargarMas={() => cargarColumna(etapa, cols[etapa].pagina + 1, true)}
              >
                {vista(etapa).map((l) => (
                  <LeadCard
                    key={l.id} lead={l} plantillasWa={plantillasWa} plantillasEmail={plantillasEmail}
                    onEnviado={() => {}} onProgramado={onProgramado} onArchivar={archivarLead}
                  />
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
              onClick={() => { if (perdidoDialog) moverEtapa(perdidoDialog.leadId, perdidoDialog.etapaOrigen, "perdido", motivo.trim()); setPerdidoDialog(null); }}
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

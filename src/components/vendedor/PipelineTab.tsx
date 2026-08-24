import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  Loader2, MapPin, Mail as MailIcon, MessageCircle, RefreshCw, GripVertical, CalendarClock,
  ListOrdered, ArrowRight, X, Search, SlidersHorizontal, Instagram, PhoneCall, Radar, UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PAISES_PROSPECCION } from "@/lib/paises";
import EtapaProgreso from "@/components/vendedor/EtapaProgreso";
import LeadDetalleDialog from "@/components/vendedor/LeadDetalleDialog";
import {
  ETAPA_COLOR, ETAPAS_PIPELINE, ETAPA_LABEL, ETAPAS_PERMITIDAS,
  type Etapa, type LeadCampana, type PlantillaEmail, type PlantillaWa, type RolVenta,
} from "@/components/vendedor/types";
import { useGuardiaWhatsapp } from "@/hooks/use-guardia-whatsapp";

// leads_campana con las columnas nuevas aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const COLUMNAS = "id, nombre, telefono, email, pais, etapa_venta, ha_respondido, resumen_ia, fecha_asignacion, fecha_cierre, motivo_cierre, fecha_proximo_contacto, vendedor_id, instagram, facebook, mensaje_instagram, notas_vendedor, origen, ultimo_contacto_at";

// Cada columna trae de a 10 tarjetas y el resto se carga bajo demanda: con
// filtros activos el vendedor casi nunca necesita más, y la primera pintada
// del kanban es mucho más liviana.
const PAGE_SIZE = 10;

type ColState = { leads: LeadCampana[]; total: number; pagina: number; cargandoMas: boolean };
const columnaVacia = (): ColState => ({ leads: [], total: 0, pagina: 0, cargandoMas: false });

// Filtros del kanban. Se aplican del lado del servidor (no sobre la página ya
// cargada), así "buscar" encuentra leads que están más allá de las 10 visibles.
type Filtros = {
  q: string;
  pais: string;      // "all" | nombre del país
  origen: string;    // "all" | campana | buscar_leads | manual_vendedor
  respondio: boolean;
  vencidos: boolean;
};
const filtrosVacios = (): Filtros => ({ q: "", pais: "all", origen: "all", respondio: false, vencidos: false });
const hayFiltros = (f: Filtros) =>
  Boolean(f.q.trim()) || f.pais !== "all" || f.origen !== "all" || f.respondio || f.vencidos;

const ORIGENES: { valor: string; label: string }[] = [
  { valor: "all", label: "Todos los orígenes" },
  { valor: "buscar_leads", label: "Buscar Leads" },
  { valor: "manual_vendedor", label: "Alta manual" },
  // Todo lo que no cargó el vendedor: importaciones, campañas y el bot.
  { valor: "campana", label: "Campaña / importados" },
];

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

// PostgREST separa las condiciones de `or(...)` por comas: una coma dentro del
// texto buscado rompería la consulta entera.
function sanearBusqueda(q: string): string {
  return q.trim().replace(/[,()*]/g, " ").replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------
// Tarjeta compacta. Todo el detalle (contactar, guion de llamada, redes,
// historial) vive en LeadDetalleDialog: la tarjeta solo tiene que decir de
// un vistazo quién es, cuánto avanzó y si pide atención.
// ---------------------------------------------------------------------
function LeadCard({ lead, selected, onToggleSelect, onAbrir }: {
  lead: LeadCampana;
  selected: boolean;
  onToggleSelect: (leadId: string) => void;
  onAbrir: (leadId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const dias = diasDesde(lead.fecha_asignacion);
  const etapa = ((lead.etapa_venta as Etapa) || "contactado") as Etapa;
  const color = ETAPA_COLOR[etapa];
  const seguimientoVencido = Boolean(lead.fecha_proximo_contacto && new Date(lead.fecha_proximo_contacto).getTime() <= Date.now());
  const sinTelefono = !lead.telefono || lead.telefono.startsWith("sin-tel-");

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? "z-50 opacity-60" : ""}`}
    >
      <Card
        className={`mb-1.5 border-l-[3px] transition-shadow hover:shadow-md ${color.card}`}
        onClick={() => onAbrir(lead.id)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onAbrir(lead.id); }}
      >
        <CardContent className="space-y-1.5 p-2">
          <div className="flex items-start gap-1.5">
            <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="mt-0.5 shrink-0">
              <input
                type="checkbox" aria-label={`Seleccionar ${lead.nombre || "lead"}`}
                className="h-3 w-3 accent-[#003DA5]"
                checked={selected} onChange={() => onToggleSelect(lead.id)}
              />
            </div>
            <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight">{lead.nombre || "—"}</div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] leading-tight text-muted-foreground">
                {lead.pais && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {lead.pais}</span>}
                {dias !== null && <span>· {dias}d</span>}
                {lead.origen === "buscar_leads" && <Radar className="h-2.5 w-2.5 text-[#003DA5]" aria-label="vino de Buscar Leads" />}
                {lead.origen === "manual_vendedor" && <UserPlus className="h-2.5 w-2.5 text-[#003DA5]" aria-label="alta manual" />}
              </div>
            </div>
          </div>

          <EtapaProgreso etapa={etapa} compacto />

          <div className="flex flex-wrap items-center gap-1">
            {lead.ha_respondido && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] font-medium text-emerald-700">respondió</span>
            )}
            {seguimientoVencido && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-medium text-amber-700">
                <CalendarClock className="h-2.5 w-2.5" /> {new Date(lead.fecha_proximo_contacto!).toLocaleDateString("es-CL")}
              </span>
            )}
            {!sinTelefono && <PhoneCall className="h-2.5 w-2.5 text-muted-foreground" aria-label="con teléfono" />}
            {lead.email && <MailIcon className="h-2.5 w-2.5 text-muted-foreground" aria-label="con email" />}
            {lead.instagram && <Instagram className="h-2.5 w-2.5 text-muted-foreground" aria-label="con Instagram" />}
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
  const color = ETAPA_COLOR[etapa];
  return (
    <div
      ref={setNodeRef}
      className={`flex w-60 shrink-0 flex-col rounded-lg border bg-muted/20 p-1.5 transition-colors ${isOver ? "border-[#003DA5] bg-[#003DA5]/5" : ""}`}
    >
      <div className={`mb-1.5 flex items-center justify-between rounded-md px-2 py-1 ${color.head}`}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color.hex }} />
          {ETAPA_LABEL[etapa]}
        </span>
        <Badge variant="secondary" className="text-[10px]">{leads.length}/{total}</Badge>
      </div>
      <div className="min-h-[60px] flex-1">
        {children}
        {hasMore && (
          <Button
            type="button" variant="ghost" size="sm" onClick={onCargarMas} disabled={cargandoMas}
            className="w-full gap-1.5 text-[11px] text-muted-foreground"
          >
            {cargandoMas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Cargar {PAGE_SIZE} más
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
  const [miNombre, setMiNombre] = useState<string | null>(null);
  // Ficha completa del lead (item 4): se abre al hacer clic en la tarjeta.
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // Buscador + filtros (item 3). `filtros` es lo aplicado; `q` se escribe con
  // debounce para no disparar una consulta por tecla.
  const [filtros, setFiltros] = useState<Filtros>(filtrosVacios());
  const [qInput, setQInput] = useState("");
  const [panelFiltros, setPanelFiltros] = useState(false);
  // Envío de WhatsApp en cola: selección de tarjetas + una plantilla en
  // común, igual patrón que la Bandeja. Cada apertura de wa.me pide su
  // propio clic ("Siguiente") para no chocar con el bloqueo de pop-ups.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [waPlantillaId, setWaPlantillaId] = useState("");
  const [cola, setCola] = useState<{ ids: string[]; idx: number } | null>(null);
  // Un mismo número no puede recibir el mensaje dos veces aunque esté cargado en
  // dos leads distintos (a veces con el nombre escrito de otra forma).
  const guardiaWa = useGuardiaWhatsapp();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Debounce del buscador: 350 ms sin teclear y recién ahí se consulta.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.q === qInput ? f : { ...f, q: qInput })), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // Los filtros se leen dentro de callbacks que no se re-crean por dependencia,
  // así que se guarda la última versión en una ref.
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aplicarFiltros = (query: any) => {
    const f = filtrosRef.current;
    let q = query;
    const texto = sanearBusqueda(f.q);
    if (texto) q = q.or(`nombre.ilike.%${texto}%,email.ilike.%${texto}%,telefono.ilike.%${texto}%`);
    if (f.pais !== "all") q = q.eq("pais", f.pais);
    if (f.origen === "campana") q = q.or("origen.is.null,and(origen.neq.buscar_leads,origen.neq.manual_vendedor)");
    else if (f.origen !== "all") q = q.eq("origen", f.origen);
    if (f.respondio) q = q.is("ha_respondido", true);
    if (f.vencidos) q = q.lte("fecha_proximo_contacto", finDeHoyISO());
    return q;
  };

  const cargarColumna = async (etapa: Etapa, pagina: number, append: boolean) => {
    setCols((prev) => ({ ...prev, [etapa]: { ...prev[etapa], cargandoMas: true } }));
    const base = sb
      .from("leads_campana")
      .select(COLUMNAS, { count: "exact" })
      .not("primer_contacto_at", "is", null)
      .not("archivado", "is", true)
      .eq("etapa_venta", etapa);
    const { data, count, error } = await aplicarFiltros(base)
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
    const base = sb
      .from("leads_campana")
      .select(COLUMNAS)
      .not("primer_contacto_at", "is", null)
      .not("archivado", "is", true)
      .lte("fecha_proximo_contacto", finDeHoyISO());
    const { data, error } = await aplicarFiltros(base).order("fecha_proximo_contacto", { ascending: true });
    if (error) { toast({ title: "Error al cargar lo de hoy", description: error.message, variant: "destructive" }); return; }
    setHoyLeads((data ?? []) as LeadCampana[]);
  };

  const cargarTodo = async () => {
    setLoading(true);
    const [, { data: perfil }] = await Promise.all([
      Promise.all(ETAPAS_PIPELINE.map((etapa) => cargarColumna(etapa, 0, false))),
      supabase.auth.getUser().then(({ data: u }) =>
        u?.user ? sb.from("vendedores").select("rol_venta, nombre_display").eq("user_id", u.user.id).maybeSingle() : { data: null },
      ),
      cargarHoyCount(),
    ]);
    setMiRol((perfil?.rol_venta as RolVenta | undefined) ?? undefined);
    setMiNombre((perfil?.nombre_display as string | undefined) ?? null);
    if (soloHoy) await cargarHoy();
    setLoading(false);
  };

  useEffect(() => { cargarTodo(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (soloHoy) cargarHoy(); else setHoyLeads(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloHoy]);

  // Cualquier cambio de filtro recarga desde la página 0 (y limpia la
  // selección: seleccionar en una vista y enviar en otra sería un error caro).
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    setSelected(new Set());
    if (soloHoy) cargarHoy();
    else ETAPAS_PIPELINE.forEach((etapa) => cargarColumna(etapa, 0, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const vista = (etapa: Etapa): LeadCampana[] => {
    if (hoyLeads) {
      return hoyLeads.filter((l) => ((l.etapa_venta as Etapa) || "contactado") === etapa && requiereHoy(l));
    }
    return cols[etapa].leads;
  };
  const totalVista = (etapa: Etapa): number => (hoyLeads ? vista(etapa).length : cols[etapa].total);
  const hasMoreVista = (etapa: Etapa): boolean => (hoyLeads ? false : cols[etapa].leads.length < cols[etapa].total);

  const totalGeneral = ETAPAS_PIPELINE.reduce((acc, e) => acc + cols[e].total, 0);
  const paisesDisponibles = useMemo(() => PAISES_PROSPECCION, []);

  const buscarLead = (id: string): { lead: LeadCampana; etapa: Etapa } | null => {
    for (const etapa of ETAPAS_PIPELINE) {
      const encontrado = vista(etapa).find((l) => l.id === id);
      if (encontrado) return { lead: encontrado, etapa };
    }
    return null;
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

  const toggleSelect = (leadId: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(leadId)) n.delete(leadId); else n.add(leadId); return n; });
  };

  const registrarContactoWa = async (leadId: string, plantillaId: string, mensaje: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    await sb.from("contactos_log").insert({
      lead_id: leadId, user_id: uid, canal: "whatsapp", plantilla_id: plantillaId, mensaje_final: mensaje, origen: "leads_campana",
    });
  };

  const enviarWaLead = (lead: LeadCampana) => {
    const plantilla = plantillasWa.find((p) => p.id === waPlantillaId);
    const link = waLinkCampana(lead);
    if (!plantilla || !link) return;
    const msg = fillTemplate(plantilla.contenido, { nombre: lead.nombre || undefined, pais: lead.pais || undefined });
    window.open(`${link}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    registrarContactoWa(lead.id, plantilla.id, msg);
    guardiaWa.registrarEnvio(lead);
  };

  const iniciarCola = () => {
    if (!waPlantillaId) return;
    const elegidos = ETAPAS_PIPELINE.flatMap((etapa) => vista(etapa))
      .filter((l) => selected.has(l.id) && waLinkCampana(l));
    // Saca los números repetidos dentro de la tanda y los que ya recibieron el
    // mensaje desde otro lead: mandarlo de nuevo es spam para quien lo recibe.
    const { enviar, saltados } = guardiaWa.filtrarTanda(elegidos);
    if (saltados > 0) {
      toast({
        title: `${saltados} lead(s) saltado(s)`,
        description: "Ese número ya recibió el mensaje (estaba repetido o cargado con otro nombre).",
      });
    }
    const ids = enviar.map((l) => l.id);
    if (ids.length === 0) return;
    const primero = buscarLead(ids[0])?.lead;
    if (primero) enviarWaLead(primero);
    if (ids.length > 1) setCola({ ids, idx: 0 });
    else toast({ title: "WhatsApp enviado" });
  };

  const siguienteCola = () => {
    if (!cola) return;
    const nextIdx = cola.idx + 1;
    const siguienteLead = buscarLead(cola.ids[nextIdx])?.lead;
    if (siguienteLead) enviarWaLead(siguienteLead);
    if (nextIdx + 1 >= cola.ids.length) {
      setCola(null);
      toast({ title: `Cola completa (${cola.ids.length}/${cola.ids.length})` });
    } else {
      setCola({ ...cola, idx: nextIdx });
    }
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
  const filtrosActivos = hayFiltros(filtros);
  const limpiarFiltros = () => { setQInput(""); setFiltros(filtrosVacios()); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Haz clic en una tarjeta para ver su ficha completa; arrástrala para cambiar de etapa.
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

      {/* Buscador + filtros. Consultan la base entera, no solo lo ya cargado. */}
      <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput} onChange={(e) => setQInput(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono…"
              className="h-8 pl-8 text-xs"
            />
            {qInput && (
              <button
                type="button" onClick={() => setQInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            type="button" size="sm" variant={panelFiltros || filtrosActivos ? "secondary" : "outline"}
            onClick={() => setPanelFiltros((v) => !v)} className="h-8 gap-1.5 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            {filtrosActivos && <span className="rounded-full bg-[#003DA5] px-1.5 text-[10px] text-white">on</span>}
          </Button>
          {filtrosActivos && (
            <Button type="button" size="sm" variant="ghost" onClick={limpiarFiltros} className="h-8 gap-1 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
        </div>

        {panelFiltros && (
          <div className="flex flex-wrap items-center gap-3 border-t pt-2">
            <Select value={filtros.pais} onValueChange={(v) => setFiltros((f) => ({ ...f, pais: v }))}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los países</SelectItem>
                {paisesDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtros.origen} onValueChange={(v) => setFiltros((f) => ({ ...f, origen: v }))}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGENES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={filtros.respondio} onCheckedChange={(v) => setFiltros((f) => ({ ...f, respondio: v }))} />
              Solo los que respondieron
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={filtros.vencidos} onCheckedChange={(v) => setFiltros((f) => ({ ...f, vencidos: v }))} />
              Seguimiento vencido
            </label>
          </div>
        )}
      </div>

      {/* Cola de WhatsApp sobre la selección actual. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <Select value={waPlantillaId} onValueChange={setWaPlantillaId}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Plantilla WhatsApp" /></SelectTrigger>
          <SelectContent>{plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="secondary">{selected.size} seleccionados</Badge>
        <Button
          type="button" size="sm" variant="outline" disabled={!waPlantillaId || selected.size === 0 || !!cola}
          onClick={iniciarCola} className="gap-1.5 text-emerald-700"
        >
          <ListOrdered className="h-3.5 w-3.5" /> Enviar WhatsApp en cola ({selected.size})
        </Button>
        {selected.size > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="gap-1 text-xs text-muted-foreground">
            Limpiar selección
          </Button>
        )}
        {cola && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              <span className="font-semibold text-foreground">{cola.idx + 1}/{cola.ids.length}</span> enviado(s) ·
              {" "}Siguiente: <span className="font-medium text-foreground">{buscarLead(cola.ids[cola.idx + 1])?.lead.nombre || "—"}</span>
            </span>
            <Button type="button" size="sm" onClick={siguienteCola} className="ml-auto h-7 gap-1 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700">
              Siguiente <ArrowRight className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCola(null)} className="h-7 w-7 px-0 text-muted-foreground" aria-label="Cancelar cola">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : !soloHoy && totalGeneral === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <p>{filtrosActivos ? "Ningún lead coincide con estos filtros." : "Todavía no tienes leads de campaña en el Pipeline."}</p>
          {filtrosActivos && <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>}
        </div>
      ) : soloHoy && hoyCount === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nada pendiente para hoy. 🎉
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {ETAPAS_PIPELINE.map((etapa) => (
              <Column
                key={etapa} etapa={etapa} leads={vista(etapa)} total={totalVista(etapa)}
                hasMore={hasMoreVista(etapa)} cargandoMas={cols[etapa].cargandoMas}
                onCargarMas={() => cargarColumna(etapa, cols[etapa].pagina + 1, true)}
              >
                {vista(etapa).map((l) => (
                  <LeadCard
                    key={l.id} lead={l}
                    selected={selected.has(l.id)} onToggleSelect={toggleSelect}
                    onAbrir={setDetalleId}
                  />
                ))}
              </Column>
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <Card className="w-60 opacity-90 shadow-lg">
                <CardContent className="p-2 text-[13px] font-medium">{activeLead.nombre || "—"}</CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <LeadDetalleDialog
        leadId={detalleId} open={!!detalleId} onOpenChange={(o) => !o && setDetalleId(null)}
        plantillasWa={plantillasWa} plantillasEmail={plantillasEmail}
        miRol={miRol} vendedorNombre={miNombre}
        onCambio={cargarTodo}
      />

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

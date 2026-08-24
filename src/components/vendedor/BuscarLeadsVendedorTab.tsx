import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Radar, Search, Loader2, MapPin, Globe, MessageCircle, History, Trash2,
  Sparkles, CheckCircle2, Copy, X, XCircle, Star, Instagram, Facebook, Kanban,
  Inbox, ArrowRightCircle, Map as MapIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LeadDetailDialog, { type Lead, waLink } from "@/components/prospeccion/LeadDetailDialog";
import { instagramPerfil, facebookPerfil } from "@/lib/redes";

// Saca el mensaje real del cuerpo de la respuesta cuando la edge function
// devuelve un no-2xx (supabase-js solo entrega un texto genérico).
async function mensajeDeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const txt = await ctx.clone().text();
      try {
        const j = JSON.parse(txt);
        if (j?.error) return typeof j.error === "string" ? j.error : JSON.stringify(j.error);
      } catch { /* no era JSON */ }
      if (txt.trim()) return txt.trim().slice(0, 400);
    } catch { /* cuerpo ya consumido */ }
  }
  return error instanceof Error ? error.message : String(error);
}


// leads_campana con las columnas nuevas aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Stats = {
  total?: number; con_whatsapp?: number; sin_web_pct?: number;
  score_promedio?: number; distribucion_tipo?: Record<string, number>;
};
type Busqueda = {
  id: string; nicho: string; ciudad: string; servicio?: string;
  cantidad_encontrada: number; nuevos: number; repetidos: number;
  estadisticas: Stats; created_at: string;
  total_leads: number; contactados: number; clientes: number;
};

const TIPOS = ["Oportunidad caliente", "Reactivar", "Nuevo", "Descartar"] as const;
const TIPO_SHORT: Record<string, string> = {
  "Oportunidad caliente": "Calientes", "Reactivar": "Reactivar", "Nuevo": "Nuevos", "Descartar": "Descartar",
};
const TIPO_DOT: Record<string, string> = {
  "Oportunidad caliente": "#ef4444", "Reactivar": "#f59e0b", "Nuevo": "#3b82f6", "Descartar": "#6b7280",
};
const ESTADOS_ORDER = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};
const SCORE_HINT = "0–100: qué tan probable es que este negocio necesite tu servicio.";

// De dónde salen los prospectos. Google Maps trae datos de contacto duros
// (teléfono, dirección); Instagram y Facebook traen perfiles con los que se
// puede abrir conversación por DM aunque no publiquen teléfono.
const FUENTES = [
  { valor: "maps", label: "Google Maps", icon: MapIcon, detalle: "Teléfono, dirección y reseñas reales." },
  { valor: "instagram", label: "Instagram", icon: Instagram, detalle: "Perfiles del rubro para escribir por DM." },
  { valor: "facebook", label: "Facebook", icon: Facebook, detalle: "Páginas de negocio para Messenger." },
] as const;
type Fuente = (typeof FUENTES)[number]["valor"];

function tipoBadge(tipo?: string) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("caliente")) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (t.includes("reactiv")) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (t.includes("descart")) return "bg-muted text-muted-foreground border-border";
  return "bg-blue-500/15 text-blue-600 border-blue-500/30";
}
function estadoBadge(estado?: string) {
  switch (estado) {
    case "contactado": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    case "respondio": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "cliente": return "bg-green-600/15 text-green-700 border-green-600/30";
    case "descartado": return "bg-muted text-muted-foreground border-border";
    default: return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  }
}

// Buscador de prospectos con motor gratuito: SerpApi (Google Maps, datos
// reales estructurados) + NVIDIA NIM (scoring + mensajes de contacto sobre
// esos datos ya verificados). Mismo historial/mini-CRM que "Buscar Leads"
// del admin, pero acotado a lo que el vendedor mismo busca.
export default function BuscarLeadsVendedorTab() {
  const { toast } = useToast();

  const [nicho, setNicho] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [servicio, setServicio] = useState("un servicio para hacer crecer su negocio con tecnología e inteligencia artificial");
  const [cantidad, setCantidad] = useState(15);
  const [fuentes, setFuentes] = useState<Fuente[]>(["maps"]);
  const [excluirRepetidos, setExcluirRepetidos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [repetidos, setRepetidos] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [detail, setDetail] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [tab, setTab] = useState("buscar");
  const [historial, setHistorial] = useState<Busqueda[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [expandedBusquedaId, setExpandedBusquedaId] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<Lead[] | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [tipoFilter, setTipoFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [ocultarDescartar, setOcultarDescartar] = useState(false);
  const [ordenScore, setOrdenScore] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Puente con la Bandeja/Pipeline (item 1).
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  const nombresFuentes = FUENTES.filter((f) => fuentes.includes(f.valor)).map((f) => f.label).join(" + ") || "Google Maps";
  const faseProgreso =
    elapsed < 8 ? `Buscando negocios reales en ${nombresFuentes}…` : "Puntuando oportunidades y redactando mensajes…";

  const toggleFuente = (f: Fuente) => setFuentes((prev) => {
    // Nunca se quedan las tres apagadas: sin fuente no hay búsqueda posible.
    if (prev.includes(f)) return prev.length === 1 ? prev : prev.filter((x) => x !== f);
    return [...prev, f];
  });

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (tipoFilter !== "all") list = list.filter((l) => (l.tipo_lead || "Nuevo").trim() === tipoFilter);
    if (estadoFilter !== "all") list = list.filter((l) => (l.estado_gestion || "nuevo") === estadoFilter);
    if (ocultarDescartar) list = list.filter((l) => !(l.tipo_lead || "").trim().toLowerCase().includes("descart"));
    return [...list].sort((a, b) => (ordenScore === "desc" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0)));
  }, [leads, tipoFilter, estadoFilter, ocultarDescartar, ordenScore]);

  const leadKey = (l: Lead) => l.id ?? `${(l.nombre || "").trim().toLowerCase()}|${(l.ciudad || "").trim().toLowerCase()}`;
  const selectedLeads = useMemo(() => filtered.filter((l) => selected.has(leadKey(l))), [filtered, selected]);

  const toggleSel = (l: Lead) => setSelected((s) => { const n = new Set(s); const k = leadKey(l); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(leadKey(l)));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (filtered.length && filtered.every((l) => n.has(leadKey(l)))) filtered.forEach((l) => n.delete(leadKey(l)));
    else filtered.forEach((l) => n.add(leadKey(l)));
    return n;
  });
  const limpiarFiltros = () => { setTipoFilter("all"); setEstadoFilter("all"); setOcultarDescartar(false); setOrdenScore("desc"); setSelected(new Set()); };
  const abrirDetalle = (l: Lead) => { setDetail(l); setDetailOpen(true); };

  const buscar = async () => {
    if (!nicho.trim() || !ciudad.trim()) {
      toast({ title: "Faltan datos", description: "Indica el rubro y la ciudad.", variant: "destructive" });
      return;
    }
    setLoading(true); setLeads(null); setStats(null); setRepetidos(0); setSearchError(null); setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("buscar-leads-vendedor", {
        body: { nicho, ciudad, servicio, cantidad, excluir_repetidos: excluirRepetidos, fuentes },
      });
      // supabase-js resume cualquier no-2xx como "Edge Function returned a non-2xx
      // status code" y esconde el motivo real; el cuerpo viene en error.context.
      if (error) throw new Error(await mensajeDeError(error));
      if (data?.error && !data?.leads?.length) throw new Error(data.error);
      const found: Lead[] = data?.leads ?? [];
      setLeads(found); setStats(data?.stats ?? null); setRepetidos(data?.repetidos ?? 0);
      toast({
        title: `${found.length} leads`,
        description: found.length ? `${data?.nuevos ?? found.length} nuevos${data?.repetidos ? ` · ${data.repetidos} ya en tu historial` : ""}. Guardados en tu historial.` : "Prueba con otra ciudad o rubro más amplio.",
        variant: found.length ? "default" : "destructive",
      });
      if (data?.aviso) toast({ title: "Aviso", description: data.aviso });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
      toast({ title: "Error en la búsqueda", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copiarWa = (source: Lead[]) => {
    const links = source.map((l) => waLink(l)).filter((x): x is string => Boolean(x));
    if (!links.length) { toast({ title: "Sin WhatsApp", description: "Ninguno tiene teléfono válido.", variant: "destructive" }); return; }
    navigator.clipboard.writeText(links.join("\n"));
    toast({ title: `${links.length} links de WhatsApp copiados` });
  };

  // ---------------------------------------------------------------------
  // Puente Buscar Leads -> Bandeja / Pipeline.
  //
  // Antes esto era un callejón sin salida: el prospecto se marcaba
  // "contactado" en la tabla de prospección y ahí moría — no aparecía en la
  // Bandeja ni en el Pipeline, así que el vendedor perdía el seguimiento.
  // Ahora un solo RPC crea (o reutiliza) el lead en leads_campana:
  //   yaContactados = false -> entra a la Bandeja, etapa "nuevo"
  //   yaContactados = true  -> entra al Pipeline, etapa "contactado"
  // ---------------------------------------------------------------------
  const sincronizar = async (yaContactados: boolean) => {
    const ids = selectedLeads.map((l) => l.id).filter(Boolean) as string[];
    if (!ids.length) {
      toast({ title: "Sin leads guardados", description: "Selecciona prospectos ya guardados en tu historial.", variant: "destructive" });
      return;
    }
    setSincronizando(true);
    try {
      const { data, error } = await sb.rpc("vendedor_prospectos_a_pipeline", {
        _prospecto_ids: ids, _ya_contactados: yaContactados,
      });
      if (error) throw error;
      const r = (data ?? [])[0] ?? { creados: 0, vinculados: 0, omitidos: 0 };
      const total = Number(r.creados) + Number(r.vinculados);
      const destino = yaContactados ? "Pipeline" : "Bandeja";

      // Refleja el resultado en la tabla sin volver a consultar.
      const idSet = new Set(ids);
      const parche = (l: Lead): Lead => (l.id && idSet.has(l.id)
        ? { ...l, lead_campana_id: l.lead_campana_id ?? "pendiente", estado_gestion: yaContactados && (l.estado_gestion ?? "nuevo") === "nuevo" ? "contactado" : l.estado_gestion }
        : l);
      setLeads((ls) => (ls ?? []).map(parche));
      setExpandedLeads((ls) => (ls ?? []).map(parche));

      toast({
        title: total > 0 ? `${total} lead(s) en tu ${destino}` : `Nada nuevo para tu ${destino}`,
        description: [
          Number(r.creados) ? `${r.creados} creado(s)` : null,
          Number(r.vinculados) ? `${r.vinculados} ya existía(n) y se actualizaron` : null,
          Number(r.omitidos) ? `${r.omitidos} omitido(s): ese teléfono ya es de otro vendedor` : null,
        ].filter(Boolean).join(" · ") || undefined,
        variant: total === 0 && Number(r.omitidos) > 0 ? "destructive" : "default",
      });
      setSelected(new Set());
    } catch (e) {
      toast({ title: "No se pudo sincronizar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSincronizando(false);
    }
  };

  const cargarHistorial = async () => {
    setHistLoading(true);
    try {
      const { data, error } = await sb.rpc("prospeccion_historial");
      if (error) throw error;
      setHistorial((data ?? []) as Busqueda[]);
    } catch (e) {
      toast({ title: "No se pudo cargar el historial", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setHistLoading(false);
    }
  };

  const toggleExpandBusqueda = async (b: Busqueda) => {
    if (expandedBusquedaId === b.id) { setExpandedBusquedaId(null); setExpandedLeads(null); return; }
    setExpandedBusquedaId(b.id); setExpandedLoading(true);
    try {
      const { data, error: err } = await sb.from("prospeccion_leads").select("*").eq("busqueda_id", b.id).order("score", { ascending: false });
      if (err) throw err;
      setExpandedLeads((data ?? []) as Lead[]);
    } catch (e) {
      toast({ title: "Error al cargar leads", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setExpandedBusquedaId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  const borrarBusqueda = async (id: string) => {
    const { error } = await sb.from("prospeccion_busquedas").delete().eq("id", id);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    setHistorial((h) => (h ?? []).filter((b) => b.id !== id));
    toast({ title: "Búsqueda borrada" });
  };

  const cambiarEstado = async (lead: Lead, estado: string) => {
    if (!lead.id) return;
    const { error } = await sb.from("prospeccion_leads").update({ estado_gestion: estado }).eq("id", lead.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? { ...l, estado_gestion: estado } : l)));
    setDetail((d) => (d && d.id === lead.id ? { ...d, estado_gestion: estado } : d));
    setExpandedLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? { ...l, estado_gestion: estado } : l)));
  };

  const guardarNotas = async (lead: Lead, notas: string) => {
    if (!lead.id) return;
    const { error } = await sb.from("prospeccion_leads").update({ notas }).eq("id", lead.id);
    if (error) { toast({ title: "No se pudieron guardar las notas", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? { ...l, notas } : l)));
    setExpandedLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? { ...l, notas } : l)));
    toast({ title: "Notas guardadas" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Radar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight">Buscar Leads</h2>
          <p className="text-sm text-muted-foreground">
            Busca negocios reales en Google Maps, Instagram y Facebook, y genera mensajes de contacto listos.
            Lo que marques pasa a tu Bandeja o a tu Pipeline. Motor gratuito (SerpApi + NVIDIA).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/mis-leads/bandeja"><Inbox className="h-3.5 w-3.5" /> Bandeja</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/mis-leads/pipeline"><Kanban className="h-3.5 w-3.5" /> Pipeline</Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="buscar" className="gap-1.5"><Search className="h-4 w-4" /> Buscar</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5" onClick={cargarHistorial}><History className="h-4 w-4" /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="buscar" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Parámetros de búsqueda</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Rubro / nicho</Label>
                  <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="p. ej. inmobiliarias" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ciudad o zona</Label>
                  <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="p. ej. Santa Cruz, Bolivia" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Qué le ofreces (afecta el scoring)</Label>
                  <Input value={servicio} onChange={(e) => setServicio(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cantidad</Label>
                  <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} leads</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dónde buscar</Label>
                <div className="flex flex-wrap gap-2">
                  {FUENTES.map((f) => {
                    const activa = fuentes.includes(f.valor);
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.valor} type="button" onClick={() => toggleFuente(f.valor)}
                        title={f.detalle} aria-pressed={activa}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          activa ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {f.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {FUENTES.find((f) => fuentes.includes(f.valor))?.detalle}
                  {fuentes.length > 1 && " Los resultados de redes vienen con perfil para escribir por DM, no siempre con teléfono."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={excluirRepetidos} onCheckedChange={setExcluirRepetidos} />
                Excluir negocios que ya están en mi historial
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={buscar} disabled={loading} className="gap-2 bg-[#003DA5] hover:bg-[#003DA5]/90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar leads
                </Button>
                {loading && (
                  <div className="flex flex-1 flex-wrap items-center gap-3 rounded-lg border border-[#003DA5]/20 bg-[#003DA5]/5 px-3 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-[#003DA5]" /> <span>{faseProgreso}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{elapsed}s</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {searchError && (
            <Card className="border-destructive/40">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">Error en la búsqueda</span>
                  <span className="text-muted-foreground">{searchError}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={buscar} disabled={loading}>Reintentar</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSearchError(null)}>Descartar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Encontrados", v: stats.total ?? 0 },
                { k: "Con WhatsApp", v: stats.con_whatsapp ?? 0 },
                { k: "Score prom.", v: stats.score_promedio ?? 0 },
                { k: "Sin web", v: `${stats.sin_web_pct ?? 0}%` },
              ].map((c) => (
                <Card key={c.k}><CardContent className="p-4">
                  <div className="text-2xl font-semibold">{c.v}</div>
                  <div className="text-xs text-muted-foreground">{c.k}</div>
                </CardContent></Card>
              ))}
            </div>
          )}

          {leads && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    Resultados <Badge variant="secondary">{filtered.length}</Badge>
                    {repetidos > 0 && <Badge variant="outline">{repetidos} repetidos ocultos</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.distribucion_tipo && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setTipoFilter("all")}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${tipoFilter === "all" ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"}`}>
                      Todos · {filtered.length}
                    </button>
                    {TIPOS.map((t) => {
                      const n = stats.distribucion_tipo?.[t] ?? 0;
                      if (!n) return null;
                      const activo = tipoFilter === t;
                      return (
                        <button key={t} type="button" onClick={() => setTipoFilter(activo ? "all" : t)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${activo ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"}`}>
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: activo ? "#fff" : TIPO_DOT[t] }} />
                          {TIPO_SHORT[t]} · {n}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Switch checked={ocultarDescartar} onCheckedChange={setOcultarDescartar} /> Ocultar descartados
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Estado
                    <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="all">Todos</option>
                      {ESTADOS_ORDER.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Orden
                    <select value={ordenScore} onChange={(e) => setOrdenScore(e.target.value as "desc" | "asc")} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="desc">Score ↓</option>
                      <option value="asc">Score ↑</option>
                    </select>
                  </label>
                  {(tipoFilter !== "all" || estadoFilter !== "all" || ocultarDescartar) && (
                    <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" /> Limpiar
                    </Button>
                  )}
                </div>

                {selectedLeads.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#003DA5]/30 bg-[#003DA5]/5 p-2">
                    <Badge variant="secondary">{selectedLeads.length} seleccionados</Badge>
                    <Button
                      type="button" size="sm" disabled={sincronizando}
                      onClick={() => sincronizar(false)} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90"
                    >
                      {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Inbox className="h-3.5 w-3.5" />}
                      Pasar a mi Bandeja
                    </Button>
                    <Button
                      type="button" size="sm" variant="outline" disabled={sincronizando}
                      onClick={() => sincronizar(true)} className="gap-1.5"
                    >
                      {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Ya los contacté · al Pipeline
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => copiarWa(selectedLeads)} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copiar WhatsApp
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" /> Limpiar
                    </Button>
                  </div>
                )}

                {leads.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    No se encontraron leads nuevos. Prueba otra ciudad o un rubro más amplio.
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="space-y-3 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    <p>Ningún resultado con los filtros actuales.</p>
                    <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input type="checkbox" aria-label="Seleccionar todos" className="h-4 w-4 accent-[#003DA5]" checked={allChecked} onChange={toggleAll} />
                          </TableHead>
                          <TableHead>Negocio</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead className="w-16">
                            <Tooltip><TooltipTrigger asChild><span className="cursor-help underline decoration-dotted">Score</span></TooltipTrigger><TooltipContent>{SCORE_HINT}</TooltipContent></Tooltip>
                          </TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="min-w-[220px]">Gancho</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((l, i) => (
                          <TableRow key={l.id ?? `r-${i}`} className="cursor-pointer" onClick={() => abrirDetalle(l)}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" aria-label={`Seleccionar ${l.nombre || "lead"}`} className="h-4 w-4 accent-[#003DA5]" checked={selected.has(leadKey(l))} onChange={() => toggleSel(l)} />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{l.nombre || "—"}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {l.ciudad || "—"}</span>
                                {typeof (l as { rating?: number }).rating === "number" && (
                                  <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {(l as { rating?: number }).rating}</span>
                                )}
                                {l.web && <a href={l.web} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[#003DA5] hover:underline"><Globe className="h-3 w-3" /> web</a>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.telefono && <div className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" /> {l.telefono}</div>}
                              {instagramPerfil(l.instagram) && (
                                <a href={instagramPerfil(l.instagram)!} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-fuchsia-600 hover:underline">
                                  <Instagram className="h-3 w-3" /> {l.instagram}
                                </a>
                              )}
                              {facebookPerfil(l.facebook) && (
                                <a href={facebookPerfil(l.facebook)!} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#1877F2] hover:underline">
                                  <Facebook className="h-3 w-3" /> {l.facebook}
                                </a>
                              )}
                              {!l.telefono && !l.instagram && !l.facebook && "—"}
                            </TableCell>
                            <TableCell>
                              <Tooltip><TooltipTrigger asChild><span className="cursor-help font-mono text-sm font-semibold">{typeof l.score === "number" ? l.score : "—"}</span></TooltipTrigger><TooltipContent>{SCORE_HINT}</TooltipContent></Tooltip>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${tipoBadge(l.tipo_lead)}`}>{l.tipo_lead || "Nuevo"}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-0.5">
                                <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoBadge(l.estado_gestion)}`}>{ESTADO_LABEL[l.estado_gestion || "nuevo"] ?? l.estado_gestion}</span>
                                {l.lead_campana_id && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#003DA5]">
                                    <ArrowRightCircle className="h-2.5 w-2.5" /> en tu CRM
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{Array.isArray(l.problemas) && l.problemas.length ? l.problemas[0] : "—"}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" className="gap-1 text-[#003DA5]" onClick={(e) => { e.stopPropagation(); abrirDetalle(l); }}>
                                <Sparkles className="h-3.5 w-3.5" /> Mensaje
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Búsquedas anteriores</CardTitle></CardHeader>
            <CardContent>
              {histLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
              ) : !historial || historial.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  Aún no hay búsquedas guardadas. Haz tu primera búsqueda en la pestaña "Buscar".
                </div>
              ) : (
                <div className="space-y-2">
                  {historial.map((b) => {
                    const isExpanded = expandedBusquedaId === b.id;
                    return (
                      <div key={b.id} className="rounded-lg border">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <button type="button" onClick={() => toggleExpandBusqueda(b)} className="min-w-0 flex-1 text-left">
                            <div className="truncate font-medium">{b.nicho} · {b.ciudad}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(b.created_at).toLocaleString("es-CL")} · {b.total_leads} guardados
                              {b.contactados ? ` · ${b.contactados} contactados` : ""}
                              {b.clientes ? ` · ${b.clientes} clientes` : ""}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">score {b.estadisticas?.score_promedio ?? "—"}</Badge>
                            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); borrarBusqueda(b.id); }} className="text-muted-foreground hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t">
                            {expandedLoading ? (
                              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando leads…</div>
                            ) : !expandedLeads?.length ? (
                              <div className="px-3 py-6 text-center text-sm text-muted-foreground">Sin leads en esta búsqueda.</div>
                            ) : (
                              <div className="max-h-[60vh] overflow-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Negocio</TableHead>
                                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                      <TableHead className="hidden md:table-cell">Contacto</TableHead>
                                      <TableHead className="hidden lg:table-cell w-16">Score</TableHead>
                                      <TableHead className="w-20"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {expandedLeads.map((l, i) => (
                                      <TableRow key={l.id ?? `ex-${i}`} className="cursor-pointer" onClick={() => abrirDetalle(l)}>
                                        <TableCell>
                                          <div className="truncate font-medium text-sm max-w-[220px]">{l.nombre || "—"}</div>
                                          <div className="text-[11px] text-muted-foreground">{l.ciudad || "—"}</div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                          {l.tipo_lead ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tipoBadge(l.tipo_lead)}`}>{TIPO_SHORT[l.tipo_lead] || l.tipo_lead}</span> : <span className="text-[11px] text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                                          {l.telefono ? <span className="inline-flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5 text-emerald-600" /> {l.telefono}</span> : "—"}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell"><span className="font-mono text-xs">{l.score ?? "—"}</span></TableCell>
                                        <TableCell>
                                          <Button type="button" variant="ghost" size="sm" className="gap-1 text-[#003DA5]" onClick={(e) => { e.stopPropagation(); abrirDetalle(l); }}>
                                            <Sparkles className="h-3.5 w-3.5" /> Mensaje
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LeadDetailDialog
        lead={detail} open={detailOpen} onOpenChange={setDetailOpen}
        onEstadoChange={cambiarEstado} onNotasChange={guardarNotas}
      />
    </div>
  );
}

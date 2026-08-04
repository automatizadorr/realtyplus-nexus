import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Radar, Search, Loader2, Send, MapPin, Globe, MessageCircle, Mail as MailIcon,
  Download, History, Trash2, Sparkles, Users, CheckCircle2, Copy, X, XCircle,
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
import ReactivacionTab from "@/components/prospeccion/ReactivacionTab";

type Stats = {
  total?: number; con_email?: number; con_whatsapp?: number;
  sin_web_pct?: number; sin_email_pct?: number; con_instagram_pct?: number;
  score_promedio?: number; distribucion_tipo?: Record<string, number>;
};
type Busqueda = {
  id: string; nicho: string; ciudad: string; servicio?: string;
  cantidad_encontrada: number; nuevos: number; repetidos: number;
  estadisticas: Stats; created_at: string;
  total_leads: number; contactados: number; clientes: number;
};

const LEADS_IMPORT_KEY = "prospeccion_leads_import";
const DEFAULT_SERVICIO = "CRM inmobiliario con captación de leads y automatización de WhatsApp";

const TIPOS = ["Oportunidad caliente", "Reactivar", "Nuevo", "Descartar"] as const;
const TIPO_SHORT: Record<string, string> = {
  "Oportunidad caliente": "Calientes",
  "Reactivar": "Reactivar",
  "Nuevo": "Nuevos",
  "Descartar": "Descartar",
};
const TIPO_DOT: Record<string, string> = {
  "Oportunidad caliente": "#ef4444",
  "Reactivar": "#f59e0b",
  "Nuevo": "#3b82f6",
  "Descartar": "#6b7280",
};
const ESTADOS_ORDER = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};
const SCORE_HINT = "0–100: qué tan probable es que este negocio necesite tu servicio.";

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

function toCsv(rows: Lead[]): string {
  const cols = [
    "nombre", "ciudad", "region", "web", "telefono", "whatsapp", "email", "instagram",
    "direccion", "score", "nivel", "tipo_lead", "estado_gestion", "notas",
    "mensaje_whatsapp", "mensaje_email",
  ] as const;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function download(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function BuscarLeads() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [nicho, setNicho] = useState("Inmobiliarias / corredoras de propiedades");
  const [ciudad, setCiudad] = useState("");
  const [servicio, setServicio] = useState(DEFAULT_SERVICIO);
  const [cantidad, setCantidad] = useState(15);
  const [excluirRepetidos, setExcluirRepetidos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [repetidos, setRepetidos] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rawRespuesta, setRawRespuesta] = useState<string | null>(null);

  const [detail, setDetail] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [tab, setTab] = useState("buscar");
  const [historial, setHistorial] = useState<Busqueda[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [expandedBusquedaId, setExpandedBusquedaId] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<Lead[] | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  // Selección dentro de la búsqueda expandida
  const [expSelected, setExpSelected] = useState<Set<string>>(new Set());

  // Filtros + selección de la tabla de resultados
  const [tipoFilter, setTipoFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [soloEmail, setSoloEmail] = useState(false);
  const [ocultarDescartar, setOcultarDescartar] = useState(false);
  const [ordenScore, setOrdenScore] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Las tablas prospeccion_* aún no están en el types.ts generado (se regenera desde
  // Lovable). Accesor sin tipos solo para esas tablas/RPC nuevas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Temporizador mientras la búsqueda está en curso (1–2 min sin feedback = parece colgado).
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  const faseProgreso =
    elapsed < 20
      ? "Buscando negocios en internet…"
      : elapsed < 45
        ? "Analizando la presencia digital de cada negocio…"
        : "Puntuando oportunidades y redactando mensajes de contacto…";

  const filtered = useMemo(() => {
    let list = leads ?? [];
    if (tipoFilter !== "all") list = list.filter((l) => ((l.tipo_lead || "Nuevo").trim() === tipoFilter));
    if (estadoFilter !== "all") list = list.filter((l) => (l.estado_gestion || "nuevo") === estadoFilter);
    if (soloEmail) list = list.filter((l) => (l.email || "").trim());
    if (ocultarDescartar) list = list.filter((l) => !(l.tipo_lead || "").trim().toLowerCase().includes("descart"));
    return [...list].sort((a, b) =>
      ordenScore === "desc" ? (b.score ?? 0) - (a.score ?? 0) : (a.score ?? 0) - (b.score ?? 0)
    );
  }, [leads, tipoFilter, estadoFilter, soloEmail, ocultarDescartar, ordenScore]);

  const conEmailFiltrado = filtered.filter((l) => (l.email || "").trim()).length;

  const leadKey = (l: Lead) => l.id ?? `${(l.nombre || "").trim().toLowerCase()}|${(l.ciudad || "").trim().toLowerCase()}`;
  const selectedLeads = useMemo(() => filtered.filter((l) => selected.has(leadKey(l))), [filtered, selected]);

  const toggleSel = (l: Lead) => {
    const k = leadKey(l);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (filtered.length && filtered.every((l) => n.has(leadKey(l)))) {
        filtered.forEach((l) => n.delete(leadKey(l)));
      } else {
        filtered.forEach((l) => n.add(leadKey(l)));
      }
      return n;
    });
  };

  const limpiarFiltros = () => {
    setTipoFilter("all"); setEstadoFilter("all"); setSoloEmail(false);
    setOcultarDescartar(false); setOrdenScore("desc"); setSelected(new Set());
  };

  const abrirDetalle = (l: Lead) => { setDetail(l); setDetailOpen(true); };

  const buscar = async () => {
    if (!nicho.trim() || !ciudad.trim()) {
      toast({ title: "Faltan datos", description: "Indica el rubro y la ciudad.", variant: "destructive" });
      return;
    }
    setLoading(true); setLeads(null); setStats(null); setRepetidos(0);
    setSearchError(null); setRawRespuesta(null); setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("buscar-leads", {
        body: { nicho, ciudad, servicio, cantidad, excluir_repetidos: excluirRepetidos },
      });
      if (error) throw error;
      if (data?.error && !data?.leads?.length) {
        if (typeof data?.raw === "string" && data.raw) setRawRespuesta(data.raw.slice(0, 2500));
        throw new Error(data.error);
      }
      const found: Lead[] = data?.leads ?? [];
      setLeads(found);
      setStats(data?.stats ?? null);
      setRepetidos(data?.repetidos ?? 0);
      toast({
        title: `${found.length} leads`,
        description: found.length
          ? `${data?.nuevos ?? found.length} nuevos${data?.repetidos ? ` · ${data.repetidos} ya en tu historial` : ""}. Guardados en el historial.`
          : "Prueba con otra ciudad o rubro más amplio.",
        variant: found.length ? "default" : "destructive",
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
      toast({ title: "Error en la búsqueda", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Pasa los leads con email a Correos Personalizados (vía sessionStorage).
  const usarEnCorreos = (source: Lead[]) => {
    const conCorreo = source.filter((l) => (l.email || "").trim());
    if (conCorreo.length === 0) {
      toast({ title: "Sin correos", description: "Ninguno tiene email. Úsalos por WhatsApp.", variant: "destructive" });
      return;
    }
    const recips = conCorreo.map((l) => ({
      email: (l.email || "").trim().toLowerCase(),
      nombre: l.nombre || "",
      empresa: l.nombre || "",
      ciudad: l.ciudad || "",
      gancho: Array.isArray(l.problemas) && l.problemas.length ? l.problemas[0] : "",
      // Todas las columnas del lead para usar como {{variable}} en correos/plantillas.
      datos: {
        region: l.region || "",
        web: l.web || "",
        telefono: l.telefono || "",
        whatsapp: l.whatsapp || "",
        instagram: l.instagram || "",
        direccion: l.direccion || "",
        fuente: l.fuente || "",
        score: l.score != null ? String(l.score) : "",
        nivel: l.nivel || "",
        tipo_lead: l.tipo_lead || "",
        propuesta_valor: l.propuesta_valor || "",
        mensaje_email: l.mensaje_email || "",
      },
    }));
    sessionStorage.setItem(LEADS_IMPORT_KEY, JSON.stringify(recips));
    navigate("/correos-personalizados");
  };

  const copiarEmails = (source: Lead[]) => {
    const emails = source.map((l) => (l.email || "").trim()).filter(Boolean);
    if (!emails.length) { toast({ title: "Sin emails", variant: "destructive" }); return; }
    navigator.clipboard.writeText(emails.join(", "));
    toast({ title: `${emails.length} emails copiados` });
  };

  const copiarWa = (source: Lead[]) => {
    const links = source.map((l) => waLink(l)).filter((x): x is string => Boolean(x));
    if (!links.length) { toast({ title: "Sin WhatsApp", description: "Ninguno tiene teléfono/WhatsApp válido.", variant: "destructive" }); return; }
    navigator.clipboard.writeText(links.join("\n"));
    toast({ title: `${links.length} links de WhatsApp copiados` });
  };

  // Acción masiva: marca como "contactado" todos los seleccionados con id en BD.
  const marcarContactado = async () => {
    const ids = selectedLeads.map((l) => l.id).filter(Boolean) as string[];
    if (!ids.length) {
      toast({ title: "Sin leads guardados", description: "Los seleccionados aún no están en el historial.", variant: "destructive" });
      return;
    }
    const { error } = await sb.from("prospeccion_leads").update({ estado_gestion: "contactado" }).in("id", ids);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    const idSet = new Set(ids);
    setLeads((ls) => (ls ?? []).map((l) => (l.id && idSet.has(l.id) ? { ...l, estado_gestion: "contactado" } : l)));
    setDetail((d) => (d && d.id && idSet.has(d.id) ? { ...d, estado_gestion: "contactado" } : d));
    toast({ title: `${ids.length} marcados como contactados` });
    setSelected(new Set());
  };

  // --- Historial ---
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

  const abrirBusqueda = async (b: Busqueda) => {
    const { data, error } = await sb
      .from("prospeccion_leads")
      .select("*")
      .eq("busqueda_id", b.id)
      .order("score", { ascending: false });
    if (error) { toast({ title: "Error al abrir la búsqueda", description: error.message, variant: "destructive" }); return; }
    setNicho(b.nicho); setCiudad(b.ciudad); if (b.servicio) setServicio(b.servicio);
    setLeads((data ?? []) as Lead[]);
    setStats(b.estadisticas ?? null);
    setRepetidos(b.repetidos ?? 0);
    limpiarFiltros();
    setTab("buscar");
  };

  const toggleExpandBusqueda = async (b: Busqueda) => {
    if (expandedBusquedaId === b.id) {
      setExpandedBusquedaId(null);
      setExpandedLeads(null);
      setExpSelected(new Set());
      return;
    }
    setExpandedBusquedaId(b.id);
    setExpandedLoading(true);
    setExpSelected(new Set());
    try {
      const { data, error: err } = await sb
        .from("prospeccion_leads")
        .select("*")
        .eq("busqueda_id", b.id)
        .order("score", { ascending: false });
      if (err) throw err;
      setExpandedLeads((data ?? []) as Lead[]);
    } catch (e) {
      toast({ title: "Error al cargar leads", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setExpandedBusquedaId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  const expLeadKey = (l: Lead) => l.id ?? `${(l.nombre || "").trim().toLowerCase()}|${(l.ciudad || "").trim().toLowerCase()}`;
  const expSelectedLeads = useMemo(
    () => (expandedLeads ?? []).filter((l) => expSelected.has(expLeadKey(l))),
    [expandedLeads, expSelected],
  );
  const toggleExpSel = (l: Lead) => {
    const k = expLeadKey(l);
    setExpSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  const toggleExpAll = () => {
    const list = expandedLeads ?? [];
    setExpSelected((s) => {
      const n = new Set(s);
      if (list.length && list.every((l) => n.has(expLeadKey(l)))) {
        list.forEach((l) => n.delete(expLeadKey(l)));
      } else {
        list.forEach((l) => n.add(expLeadKey(l)));
      }
      return n;
    });
  };
  const expAllChecked = (expandedLeads ?? []).length > 0 && (expandedLeads ?? []).every((l) => expSelected.has(expLeadKey(l)));

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

  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(leadKey(l)));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Radar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Buscar Leads</h1>
          <p className="text-sm text-muted-foreground">
            La IA busca negocios reales, analiza su presencia digital, redacta el mensaje de contacto y guarda todo en tu historial.
          </p>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="buscar" className="gap-1.5"><Search className="h-4 w-4" /> Buscar</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5" onClick={cargarHistorial}><History className="h-4 w-4" /> Historial</TabsTrigger>
          <TabsTrigger value="reactivacion" className="gap-1.5"><Users className="h-4 w-4" /> Leads de campaña</TabsTrigger>
        </TabsList>

        {/* ===================== BUSCAR ===================== */}
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
                  <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="p. ej. La Serena, Coquimbo" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Servicio que ofreces (afecta el scoring)</Label>
                  <Input value={servicio} onChange={(e) => setServicio(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cantidad</Label>
                  <select
                    value={cantidad}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} leads</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={excluirRepetidos} onCheckedChange={setExcluirRepetidos} />
                Excluir negocios que ya están en mi historial (no volver a prospectar)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={buscar} disabled={loading} className="gap-2 bg-[#003DA5] hover:bg-[#003DA5]/90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar leads
                </Button>
                {loading && (
                  <div className="flex flex-1 flex-wrap items-center gap-3 rounded-lg border border-[#003DA5]/20 bg-[#003DA5]/5 px-3 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-[#003DA5]" />
                    <span>{faseProgreso}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{elapsed}s</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error de búsqueda con opción de reintentar y ver respuesta cruda */}
          {searchError && (
            <Card className="border-destructive/40">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">Error en la búsqueda</span>
                  <span className="text-muted-foreground">{searchError}</span>
                </div>
                {rawRespuesta && (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{rawRespuesta}</pre>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={buscar} disabled={loading}>Reintentar búsqueda</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchError(null); setRawRespuesta(null); }}>Descartar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estadísticas del nicho */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { k: "Encontrados", v: stats.total ?? 0 },
                { k: "Con email", v: stats.con_email ?? 0 },
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

          {/* Resultados */}
          {leads && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    Resultados <Badge variant="secondary">{filtered.length}</Badge>
                    {conEmailFiltrado > 0 && <Badge variant="secondary">{conEmailFiltrado} con email</Badge>}
                    {repetidos > 0 && <Badge variant="outline">{repetidos} repetidos ocultos</Badge>}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copiarEmails(filtered)} className="gap-1.5">
                      <MailIcon className="h-4 w-4" /> Copiar emails
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => download(`prospeccion-${ciudad || "leads"}.csv`, toCsv(filtered))} className="gap-1.5">
                      <Download className="h-4 w-4" /> CSV
                    </Button>
                    <Button type="button" size="sm" onClick={() => usarEnCorreos(filtered)} disabled={conEmailFiltrado === 0} className="gap-1.5">
                      <Send className="h-4 w-4" /> Correos
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Chips de distribución por tipo de lead (filtran la tabla) */}
                {stats?.distribucion_tipo && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoFilter("all")}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        tipoFilter === "all" ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
                      }`}
                    >
                      Todos · {filtered.length}
                    </button>
                    {TIPOS.map((t) => {
                      const n = stats.distribucion_tipo?.[t] ?? 0;
                      if (!n) return null;
                      const activo = tipoFilter === t;
                      return (
                        <button
                          key={t} type="button"
                          onClick={() => setTipoFilter(activo ? "all" : t)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                            activo ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
                          }`}
                        >
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: activo ? "#fff" : TIPO_DOT[t] }} />
                          {TIPO_SHORT[t]} · {n}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Filtros finos */}
                <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Switch checked={soloEmail} onCheckedChange={setSoloEmail} /> Solo con email
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={ocultarDescartar} onCheckedChange={setOcultarDescartar} /> Ocultar descartados
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Estado
                    <select
                      value={estadoFilter}
                      onChange={(e) => setEstadoFilter(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="all">Todos</option>
                      {ESTADOS_ORDER.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Orden
                    <select
                      value={ordenScore}
                      onChange={(e) => setOrdenScore(e.target.value as "desc" | "asc")}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="desc">Score ↓</option>
                      <option value="asc">Score ↑</option>
                    </select>
                  </label>
                  {(tipoFilter !== "all" || estadoFilter !== "all" || soloEmail || ocultarDescartar) && (
                    <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltros} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" /> Limpiar
                    </Button>
                  )}
                </div>

                {/* Barra de acciones masivas */}
                {selectedLeads.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#003DA5]/30 bg-[#003DA5]/5 p-2">
                    <Badge variant="secondary">{selectedLeads.length} seleccionados</Badge>
                    <Button type="button" size="sm" variant="outline" onClick={marcarContactado} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Marcar contactado
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => copiarEmails(selectedLeads)} className="gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copiar emails
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => copiarWa(selectedLeads)} className="gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" /> Copiar WhatsApp
                    </Button>
                    <Button type="button" size="sm" onClick={() => usarEnCorreos(selectedLeads)} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Enviar a Correos
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" /> Limpiar
                    </Button>
                  </div>
                )}

                {leads.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    No se encontraron leads nuevos. Prueba otra ciudad, un rubro más amplio, o desactiva el filtro de repetidos.
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
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todos"
                              className="h-4 w-4 accent-[#003DA5]"
                              checked={allChecked}
                              onChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead>Negocio</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead className="w-16">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">Score</span>
                              </TooltipTrigger>
                              <TooltipContent>{SCORE_HINT}</TooltipContent>
                            </Tooltip>
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
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${l.nombre || "lead"}`}
                                className="h-4 w-4 accent-[#003DA5]"
                                checked={selected.has(leadKey(l))}
                                onChange={() => toggleSel(l)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{l.nombre || "—"}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {l.ciudad || "—"}
                                {l.web && <a href={l.web} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[#003DA5] hover:underline"><Globe className="h-3 w-3" /> web</a>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.email && <div className="flex items-center gap-1"><MailIcon className="h-3 w-3 text-muted-foreground" /> {l.email}</div>}
                              {(l.whatsapp || l.telefono) && <div className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" /> {l.telefono || l.whatsapp}</div>}
                              {!l.email && !l.whatsapp && !l.telefono && (l.instagram ? `IG ${l.instagram}` : "—")}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help font-mono text-sm font-semibold">{typeof l.score === "number" ? l.score : "—"}</span>
                                </TooltipTrigger>
                                <TooltipContent>{SCORE_HINT}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${tipoBadge(l.tipo_lead)}`}>
                                {l.tipo_lead || "Nuevo"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoBadge(l.estado_gestion)}`}>
                                {ESTADO_LABEL[l.estado_gestion || "nuevo"] ?? l.estado_gestion}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {Array.isArray(l.problemas) && l.problemas.length ? l.problemas[0] : "—"}
                            </TableCell>
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

        {/* ===================== HISTORIAL ===================== */}
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
                        {/* Card header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => toggleExpandBusqueda(b)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="truncate font-medium">{b.nicho} · {b.ciudad}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(b.created_at).toLocaleString("es-CL")} · {b.total_leads} guardados
                              {b.contactados ? ` · ${b.contactados} contactados` : ""}
                              {b.clientes ? ` · ${b.clientes} clientes` : ""}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">score {b.estadisticas?.score_promedio ?? "—"}</Badge>
                            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirBusqueda(b); }} className="gap-1 text-[#003DA5]">
                              <Search className="h-3.5 w-3.5" /> Ver en Buscar
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); borrarBusqueda(b.id); }} className="text-muted-foreground hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded leads */}
                        {isExpanded && (
                          <div className="border-t">
                            {expandedLoading ? (
                              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Cargando leads…
                              </div>
                            ) : !expandedLeads?.length ? (
                              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                Sin leads en esta búsqueda.
                              </div>
                            ) : (
                              <>
                                {/* Acciones masivas */}
                                <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                                  <label className="flex items-center gap-1.5 text-xs">
                                    <input type="checkbox" checked={expAllChecked} onChange={toggleExpAll} className="h-3.5 w-3.5 rounded accent-[#003DA5]" />
                                    Todos
                                  </label>
                                  <span className="text-[11px] text-muted-foreground">
                                    {expSelected.size > 0 ? `${expSelected.size} seleccionados` : `${expandedLeads.length} leads`}
                                  </span>
                                  <div className="ml-auto flex flex-wrap gap-1.5">
                                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                                      onClick={() => copiarWa(expSelectedLeads)} disabled={expSelected.size === 0}>
                                      <MessageCircle className="h-3 w-3" /> Copiar WA
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                                      onClick={() => usarEnCorreos(expSelectedLeads.length ? expSelectedLeads : expandedLeads)}
                                      disabled={(expandedLeads ?? []).filter((l) => (l.email || "").trim()).length === 0}>
                                      <MailIcon className="h-3 w-3" /> Enviar correos
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]"
                                      onClick={async () => {
                                        const ids = expSelectedLeads.map((l) => l.id).filter(Boolean) as string[];
                                        if (!ids.length) { toast({ title: "Selecciona leads", variant: "destructive" }); return; }
                                        await sb.from("prospeccion_leads").update({ estado_gestion: "contactado" }).in("id", ids);
                                        setExpandedLeads((ls) => (ls ?? []).map((l) => l.id && ids.includes(l.id) ? { ...l, estado_gestion: "contactado" } : l));
                                        setExpSelected(new Set());
                                        toast({ title: `${ids.length} marcados como contactados` });
                                      }} disabled={expSelected.size === 0}>
                                      <CheckCircle2 className="h-3 w-3" /> Marcar contactado
                                    </Button>
                                  </div>
                                </div>

                                {/* Tabla de leads */}
                                <div className="max-h-[60vh] overflow-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Negocio</TableHead>
                                        <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                        <TableHead className="hidden md:table-cell">Contacto</TableHead>
                                        <TableHead className="hidden lg:table-cell w-16">Score</TableHead>
                                        <TableHead className="w-20"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {expandedLeads.map((l, i) => (
                                        <TableRow
                                          key={l.id ?? `ex-${i}`}
                                          className="cursor-pointer"
                                          onClick={() => abrirDetalle(l)}
                                        >
                                          <TableCell onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              checked={expSelected.has(expLeadKey(l))}
                                              onChange={() => toggleExpSel(l)}
                                              className="h-3.5 w-3.5 rounded accent-[#003DA5]"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <div className="truncate font-medium text-sm max-w-[180px]">
                                              {l.nombre || "—"}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">{l.ciudad || "—"}</div>
                                          </TableCell>
                                          <TableCell className="hidden sm:table-cell">
                                            {l.tipo_lead ? (
                                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tipoBadge(l.tipo_lead)}`}>
                                                {TIPO_SHORT[l.tipo_lead] || l.tipo_lead}
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="hidden md:table-cell">
                                            <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                                              {l.email && <span className="inline-flex items-center gap-0.5"><MailIcon className="h-2.5 w-2.5" /> {l.email}</span>}
                                              {(l.telefono || l.whatsapp) && (
                                                <span className="inline-flex items-center gap-0.5">
                                                  <MessageCircle className="h-2.5 w-2.5 text-emerald-600" /> {l.telefono || l.whatsapp}
                                                </span>
                                              )}
                                              {!l.email && !l.telefono && !l.whatsapp && "—"}
                                            </div>
                                          </TableCell>
                                          <TableCell className="hidden lg:table-cell">
                                            <span className="font-mono text-xs">{l.score ?? "—"}</span>
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="gap-1 text-[#003DA5]"
                                              onClick={(e) => { e.stopPropagation(); abrirDetalle(l); }}
                                            >
                                              <Sparkles className="h-3.5 w-3.5" /> Mensaje
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </>
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

        {/* ===================== LEADS DE CAMPAÑA (ex Reactivación) ===================== */}
        <TabsContent value="reactivacion">
          <ReactivacionTab />
        </TabsContent>
      </Tabs>

      <LeadDetailDialog
        lead={detail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEstadoChange={cambiarEstado}
        onNotasChange={guardarNotas}
      />
    </div>
  );
}

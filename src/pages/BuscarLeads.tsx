import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Radar, Search, Loader2, Send, MapPin, Globe, MessageCircle, Mail as MailIcon,
  Download, History, Trash2, Sparkles, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LeadDetailDialog, { type Lead } from "@/components/prospeccion/LeadDetailDialog";
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

function tipoBadge(tipo?: string) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("caliente")) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (t.includes("reactiv")) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (t.includes("descart")) return "bg-muted text-muted-foreground border-border";
  return "bg-blue-500/15 text-blue-600 border-blue-500/30";
}

function toCsv(rows: Lead[]): string {
  const cols = ["nombre", "ciudad", "region", "web", "telefono", "whatsapp", "email", "instagram", "direccion", "score", "nivel", "tipo_lead"] as const;
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
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [repetidos, setRepetidos] = useState(0);

  const [detail, setDetail] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [historial, setHistorial] = useState<Busqueda[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  // Las tablas prospeccion_* aún no están en el types.ts generado (se regenera desde
  // Lovable). Accesor sin tipos solo para esas tablas/RPC nuevas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const conEmail = (leads ?? []).filter((l) => (l.email || "").trim()).length;

  const abrirDetalle = (l: Lead) => { setDetail(l); setDetailOpen(true); };

  const buscar = async () => {
    if (!nicho.trim() || !ciudad.trim()) {
      toast({ title: "Faltan datos", description: "Indica el rubro y la ciudad.", variant: "destructive" });
      return;
    }
    setLoading(true); setLeads(null); setStats(null);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-leads", {
        body: { nicho, ciudad, servicio, cantidad, excluir_repetidos: excluirRepetidos },
      });
      if (error) throw error;
      if (data?.error && !data?.leads?.length) throw new Error(data.error);
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
      empresa: l.nombre || "",
      ciudad: l.ciudad || "",
      gancho: Array.isArray(l.problemas) && l.problemas.length ? l.problemas[0] : "",
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
    // vuelve a la pestaña Buscar mostrando estos resultados
    const el = document.getElementById("tab-buscar-trigger");
    el?.click();
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
  };

  const guardarNotas = async (lead: Lead, notas: string) => {
    if (!lead.id) return;
    const { error } = await sb.from("prospeccion_leads").update({ notas }).eq("id", lead.id);
    if (error) { toast({ title: "No se pudieron guardar las notas", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? { ...l, notas } : l)));
    toast({ title: "Notas guardadas" });
  };

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

      <Tabs defaultValue="buscar">
        <TabsList>
          <TabsTrigger id="tab-buscar-trigger" value="buscar" className="gap-1.5"><Search className="h-4 w-4" /> Buscar</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5" onClick={cargarHistorial}><History className="h-4 w-4" /> Historial</TabsTrigger>
          <TabsTrigger value="reactivacion" className="gap-1.5"><RefreshCw className="h-4 w-4" /> Reactivación</TabsTrigger>
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
                {loading && <span className="text-sm text-muted-foreground">Buscando en internet… ~1-2 min. No cierres la página.</span>}
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas del nicho */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Encontrados", v: stats.total ?? 0 },
                { k: "Con email", v: stats.con_email ?? 0 },
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
                    Resultados <Badge variant="secondary">{leads.length}</Badge>
                    {conEmail > 0 && <Badge variant="secondary">{conEmail} con email</Badge>}
                    {repetidos > 0 && <Badge variant="outline">{repetidos} repetidos ocultos</Badge>}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copiarEmails(leads)} className="gap-1.5">
                      <MailIcon className="h-4 w-4" /> Copiar emails
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => download(`prospeccion-${ciudad || "leads"}.csv`, toCsv(leads))} className="gap-1.5">
                      <Download className="h-4 w-4" /> CSV
                    </Button>
                    <Button type="button" size="sm" onClick={() => usarEnCorreos(leads)} disabled={conEmail === 0} className="gap-1.5">
                      <Send className="h-4 w-4" /> Correos
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                    No se encontraron leads nuevos. Prueba otra ciudad, un rubro más amplio, o desactiva el filtro de repetidos.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Negocio</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead className="w-16">Score</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="min-w-[220px]">Gancho</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((l, i) => (
                          <TableRow key={l.id ?? i} className="cursor-pointer" onClick={() => abrirDetalle(l)}>
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
                            <TableCell><span className="font-mono text-sm font-semibold">{typeof l.score === "number" ? l.score : "—"}</span></TableCell>
                            <TableCell>
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${tipoBadge(l.tipo_lead)}`}>
                                {l.tipo_lead || "Nuevo"}
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
                  Aún no hay búsquedas guardadas. Haz tu primera búsqueda en la pestaña “Buscar”.
                </div>
              ) : (
                <div className="space-y-2">
                  {historial.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <button type="button" onClick={() => abrirBusqueda(b)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium">{b.nicho} · {b.ciudad}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(b.created_at).toLocaleString("es-CL")} · {b.total_leads} guardados
                          {b.contactados ? ` · ${b.contactados} contactados` : ""}
                          {b.clientes ? ` · ${b.clientes} clientes` : ""}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">score {b.estadisticas?.score_promedio ?? "—"}</Badge>
                        <Button type="button" variant="ghost" size="sm" onClick={() => borrarBusqueda(b.id)} className="text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== REACTIVACIÓN ===================== */}
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

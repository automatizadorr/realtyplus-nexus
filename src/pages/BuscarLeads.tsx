import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radar, Search, Loader2, Send, MapPin, Globe, MessageCircle, Mail as MailIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Lead = {
  nombre?: string; ciudad?: string; region?: string; web?: string;
  telefono?: string; whatsapp?: string; email?: string; instagram?: string;
  score?: number; nivel?: string; problemas?: string[]; tipo_lead?: string;
};

const LEADS_IMPORT_KEY = "prospeccion_leads_import";
const DEFAULT_SERVICIO = "CRM inmobiliario con captación de leads y automatización de WhatsApp";

function tipoBadge(tipo?: string) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("caliente")) return "bg-red-500/15 text-red-600 border-red-500/30";
  if (t.includes("reactiv")) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-blue-500/15 text-blue-600 border-blue-500/30";
}

export default function BuscarLeads() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [nicho, setNicho] = useState("Inmobiliarias / corredoras de propiedades");
  const [ciudad, setCiudad] = useState("");
  const [servicio, setServicio] = useState(DEFAULT_SERVICIO);
  const [cantidad, setCantidad] = useState(15);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  const conEmail = (leads ?? []).filter((l) => (l.email || "").trim()).length;

  const buscar = async () => {
    if (!nicho.trim() || !ciudad.trim()) {
      toast({ title: "Faltan datos", description: "Indica el rubro y la ciudad.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setLeads(null);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-leads", {
        body: { nicho, ciudad, servicio, cantidad },
      });
      if (error) throw error;
      if (data?.error && !data?.leads?.length) throw new Error(data.error);
      const found: Lead[] = data?.leads ?? [];
      setLeads(found);
      toast({
        title: `${found.length} leads encontrados`,
        description: found.length ? "Revisa la tabla y cárgalos en Correos Personalizados." : "Prueba con otra ciudad o rubro más amplio.",
        variant: found.length ? "default" : "destructive",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Error en la búsqueda", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Pasa los leads con email a Correos Personalizados (vía sessionStorage).
  const usarEnCorreos = () => {
    const conCorreo = (leads ?? []).filter((l) => (l.email || "").trim());
    if (conCorreo.length === 0) {
      toast({ title: "Sin correos", description: "Ninguno de los leads tiene email. Úsalos por WhatsApp.", variant: "destructive" });
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
            La IA busca negocios reales en internet, analiza su presencia digital y arma la base para tu campaña.
          </p>
        </div>
      </motion.div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parámetros de búsqueda</CardTitle>
        </CardHeader>
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={buscar} disabled={loading} className="gap-2 bg-[#003DA5] hover:bg-[#003DA5]/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar leads
            </Button>
            {loading && <span className="text-sm text-muted-foreground">Buscando en internet… puede tardar ~1-2 min. No cierres la página.</span>}
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {leads && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span>Resultados <Badge variant="secondary" className="ml-1">{leads.length}</Badge>{conEmail > 0 && <Badge variant="secondary" className="ml-1">{conEmail} con email</Badge>}</span>
              <Button type="button" onClick={usarEnCorreos} disabled={conEmail === 0} className="gap-2">
                <Send className="h-4 w-4" /> Cargar en Correos Personalizados
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No se encontraron leads. Prueba otra ciudad o un rubro más amplio.
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
                      <TableHead className="min-w-[240px]">Problemas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{l.nombre || "—"}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {l.ciudad || "—"}
                            {l.web && <a href={l.web} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[#003DA5] hover:underline"><Globe className="h-3 w-3" /> web</a>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.email && <div className="flex items-center gap-1"><MailIcon className="h-3 w-3 text-muted-foreground" /> {l.email}</div>}
                          {l.whatsapp && <div className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" /> {l.telefono || l.whatsapp}</div>}
                          {!l.email && !l.whatsapp && (l.telefono || l.instagram || "—")}
                          {!l.email && l.instagram && <div className="text-muted-foreground">IG {l.instagram}</div>}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-semibold">{typeof l.score === "number" ? l.score : "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${tipoBadge(l.tipo_lead)}`}>
                            {l.tipo_lead || "Nuevo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Array.isArray(l.problemas) ? l.problemas.slice(0, 3).join(" · ") : "—"}
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
    </div>
  );
}

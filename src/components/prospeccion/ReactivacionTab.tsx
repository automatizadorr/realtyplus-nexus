import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Loader2, RotateCcw, MessageCircle, Mail as MailIcon, Send,
  ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { orderTags } from "@/lib/permanentTags";

type Tag = { id: string; nombre: string; color: string; es_permanente?: boolean | null };
type LeadRow = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; estado: string | null; puntuacion: number | null;
  dias_reales: number | null; ha_respondido: boolean | null; archivado: boolean | null;
  tag_ids: string[] | null; ultimo_contacto_at: string | null; resumen_ia: string | null;
};

const PAGE_SIZE = 25;
const LEADS_IMPORT_KEY = "prospeccion_leads_import";

const digits = (t?: string | null) => (t ?? "").split("@")[0].replace(/\D/g, "");
const waHref = (t?: string | null) => { const d = digits(t); return d.length >= 8 ? `https://wa.me/${d}` : null; };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

export default function ReactivacionTab() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // RPC de facets (país) no está en el types.ts generado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Catálogos
  const [tags, setTags] = useState<Tag[]>([]);
  const [paises, setPaises] = useState<{ pais: string; n: number }[]>([]);

  // Filtros
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 400);
  const [tagId, setTagId] = useState("all");
  const [pais, setPais] = useState("all");
  const [estado, setEstado] = useState("all");
  const [respondido, setRespondido] = useState("all"); // all | si | no
  const [incluirArchivados, setIncluirArchivados] = useState(false);
  const [soloConEmail, setSoloConEmail] = useState(false);

  // Datos + paginación
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Catálogos una sola vez
  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color, es_permanente").order("nombre")
      .then(({ data }) => { if (data) setTags(orderTags(data as Tag[])); });
    sb.rpc("leads_campana_paises").then(({ data }: { data: { pais: string; n: number }[] | null }) => {
      if (data) setPaises(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar cualquier filtro, volvemos a la página 0
  useEffect(() => { setPage(0); }, [qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail]);

  // Consulta paginada server-side (nunca trae las 8k filas de golpe)
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("leads_campana")
          .select(
            "id, nombre, telefono, email, pais, estado, puntuacion, dias_reales, ha_respondido, archivado, tag_ids, ultimo_contacto_at, resumen_ia",
            { count: "exact" }
          );

        if (!incluirArchivados) query = query.not("archivado", "is", true);
        if (tagId !== "all") query = query.contains("tag_ids", [tagId]);
        if (pais !== "all") query = query.eq("pais", pais);
        if (estado !== "all") query = query.eq("estado", estado);
        if (respondido === "si") query = query.eq("ha_respondido", true);
        if (respondido === "no") query = query.not("ha_respondido", "is", true);
        if (soloConEmail) query = query.not("email", "is", null).neq("email", "");
        const term = qDebounced.trim();
        if (term) query = query.or(`nombre.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%`);

        query = query
          .order("dias_reales", { ascending: false, nullsFirst: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        const { data, count, error } = await query;
        if (error) throw error;
        if (cancel) return;
        setRows((data ?? []) as LeadRow[]);
        setTotal(count ?? 0);
      } catch (e) {
        if (!cancel) toast({ title: "Error al filtrar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail, page]);

  const resetFiltros = () => {
    setQ(""); setTagId("all"); setPais("all"); setEstado("all");
    setRespondido("all"); setIncluirArchivados(false); setSoloConEmail(false);
  };

  const cargarEnCorreos = () => {
    const conCorreo = rows.filter((l) => (l.email || "").trim());
    if (!conCorreo.length) { toast({ title: "Sin correos en esta página", variant: "destructive" }); return; }
    const recips = conCorreo.map((l) => ({
      email: (l.email || "").trim().toLowerCase(),
      empresa: l.nombre || "",
      ciudad: l.pais || "",
      gancho: l.resumen_ia || "",
    }));
    sessionStorage.setItem(LEADS_IMPORT_KEY, JSON.stringify(recips));
    navigate("/correos-personalizados");
  };

  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const hasta = Math.min(total, page * PAGE_SIZE + rows.length);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-[#003DA5]" /> Filtro de reactivación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" className="pl-9" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Etiqueta</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las etiquetas</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">País</Label>
              <Select value={pais} onValueChange={setPais}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos los países</SelectItem>
                  {paises.map((p) => (
                    <SelectItem key={p.pais} value={p.pais}>{p.pais} ({p.n})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="en_campana">En campaña</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Respondió</Label>
              <Select value={respondido} onValueChange={setRespondido}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Indiferente</SelectItem>
                  <SelectItem value="no">No respondió</SelectItem>
                  <SelectItem value="si">Sí respondió</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloConEmail} onCheckedChange={setSoloConEmail} /> Solo con email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={incluirArchivados} onCheckedChange={setIncluirArchivados} /> Incluir archivados
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={resetFiltros} className="ml-auto gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              Leads de reactivación
              <Badge variant="secondary">{loading ? "…" : total.toLocaleString("es-CL")}</Badge>
            </span>
            <Button type="button" size="sm" onClick={cargarEnCorreos} disabled={loading || rows.length === 0} className="gap-1.5">
              <Send className="h-4 w-4" /> Cargar página en Correos
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="hidden sm:table-cell">País</TableHead>
                  <TableHead className="hidden md:table-cell">Etiquetas</TableHead>
                  <TableHead className="hidden lg:table-cell w-16">Días</TableHead>
                  <TableHead className="hidden lg:table-cell w-16">Punt.</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </div>
                  </TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>
                    <div className="py-10 text-center text-sm text-muted-foreground">Sin resultados con estos filtros.</div>
                  </TableCell></TableRow>
                ) : (
                  rows.map((l) => {
                    const wa = waHref(l.telefono);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.nombre || "—"}</div>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            {l.telefono && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" /> {l.telefono}</span>}
                            {l.email && <span className="inline-flex items-center gap-1"><MailIcon className="h-3 w-3" /> {l.email}</span>}
                          </div>
                          {l.ha_respondido && <span className="mt-0.5 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">respondió</span>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{l.pais || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(l.tag_ids ?? []).slice(0, 3).map((id) => {
                              const t = tagMap.get(id);
                              if (!t) return null;
                              return (
                                <span key={id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{ backgroundColor: `${t.color}22`, color: t.color, border: `1px solid ${t.color}55` }}>
                                  {t.nombre}
                                </span>
                              );
                            })}
                            {(l.tag_ids?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{l.dias_reales ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell"><span className="font-mono text-sm">{l.puntuacion ?? "—"}</span></TableCell>
                        <TableCell>
                          {wa && (
                            <Button asChild size="sm" variant="outline" className="h-8 gap-1 px-2 text-emerald-700">
                              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WA</a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {total === 0 ? "Sin registros" : `${desde.toLocaleString("es-CL")}–${hasta.toLocaleString("es-CL")} de ${total.toLocaleString("es-CL")}`}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={loading || page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

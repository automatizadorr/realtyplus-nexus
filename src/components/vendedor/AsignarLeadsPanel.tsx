import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, UserPlus, ChevronLeft, ChevronRight, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// RPC de facets (país) no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const PAGE_SIZE = 15;

type LeadRow = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; vendedor_id: string | null; fecha_asignacion: string | null;
};

type VendedorOpt = { user_id: string; nombre_display: string | null };

export default function AsignarLeadsPanel({ vendedores }: { vendedores: VendedorOpt[] }) {
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 400);
  const [pais, setPais] = useState("all");
  const [paises, setPaises] = useState<{ pais: string; n: number }[]>([]);
  const [soloSinAsignar, setSoloSinAsignar] = useState(true);
  const [page, setPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vendedorAsignar, setVendedorAsignar] = useState("");
  const [asignando, setAsignando] = useState(false);

  const vendedorMap = useMemo(() => new Map(vendedores.map((v) => [v.user_id, v.nombre_display])), [vendedores]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    sb.rpc("leads_campana_paises").then(({ data }: { data: { pais: string; n: number }[] | null }) => {
      if (data) setPaises(data);
    });
  }, []);

  useEffect(() => { setPage(0); }, [qDebounced, pais, soloSinAsignar]);
  useEffect(() => { setSelected(new Set()); }, [page, qDebounced, pais, soloSinAsignar]);

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("leads_campana")
          .select("id, nombre, telefono, email, pais, vendedor_id, fecha_asignacion", { count: "exact" });
        if (soloSinAsignar) query = query.is("vendedor_id", null);
        if (pais !== "all") query = query.eq("pais", pais);
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
        if (!cancel) toast({
          title: "Error al filtrar",
          description: e instanceof Error ? e.message : JSON.stringify(e),
          variant: "destructive",
        });
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, pais, soloSinAsignar, page, refreshTick]);

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });
  };

  const enviarAVendedor = async () => {
    if (!vendedorAsignar || selected.size === 0) return;
    setAsignando(true);
    try {
      const { error } = await supabase
        .from("leads_campana")
        .update({ vendedor_id: vendedorAsignar, fecha_asignacion: new Date().toISOString(), etapa_venta: "nuevo" })
        .in("id", [...selected]);
      if (error) throw error;
      toast({ title: `${selected.size} leads enviados` });
      setSelected(new Set());
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast({ title: "No se pudo enviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setAsignando(false);
    }
  };

  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const hasta = Math.min(total, page * PAGE_SIZE + rows.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users2 className="h-4 w-4 text-[#003DA5]" /> Asignar leads a un vendedor
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Único lugar del sistema donde se envían leads de campaña a un vendedor. Selecciona filas y elige a quién se las mandas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" className="pl-9" />
          </div>
          <Select value={pais} onValueChange={setPais}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos los países</SelectItem>
              {paises.map((p) => (
                <SelectItem key={p.pais} value={p.pais}>{p.pais} ({p.n})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={soloSinAsignar} onCheckedChange={setSoloSinAsignar} /> Solo sin asignar
          </label>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#003DA5]/30 bg-[#003DA5]/5 p-2">
            <Badge variant="secondary">{selected.size} seleccionados</Badge>
            <Select value={vendedorAsignar} onValueChange={setVendedorAsignar}>
              <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Elegir vendedor" /></SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>{v.nombre_display || v.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" disabled={!vendedorAsignar || asignando} onClick={enviarAVendedor} className="gap-1.5">
              {asignando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Enviar a vendedor
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-muted-foreground">Limpiar</Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" aria-label="Seleccionar todos" className="h-4 w-4 accent-[#003DA5]" checked={allChecked} onChange={toggleAll} />
                </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="hidden sm:table-cell">País</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4}>
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                  </div>
                </TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4}>
                  <div className="py-8 text-center text-sm text-muted-foreground">Sin resultados con estos filtros.</div>
                </TableCell></TableRow>
              ) : (
                rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <input
                        type="checkbox" aria-label={`Seleccionar ${l.nombre || "lead"}`}
                        className="h-4 w-4 accent-[#003DA5]"
                        checked={selected.has(l.id)} onChange={() => toggleSel(l.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.nombre || "—"}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {l.telefono && <span>{l.telefono}</span>}
                        {l.email && <span>{l.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{l.pais || "—"}</TableCell>
                    <TableCell>
                      {l.vendedor_id ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {vendedorMap.get(l.vendedor_id) || "Asignado"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin asignar</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3">
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
  );
}

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, UserPlus, ChevronLeft, ChevronRight, Users2, Layers, Bot } from "lucide-react";
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

const PAGE_SIZE = 15;
const LOTES = [100, 200, 300, 500, 600, 700, 800, 900];

type LeadRow = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; vendedor_id: string | null; fecha_asignacion: string | null;
  // Captado por Camil-AI: el bot ya converso con el lead (escalo a humano o
  // agendo reunion). Estos NO vuelven a la Bandeja al asignarlos.
  escalado_ia_at: string | null; escalado_ia_motivo: string | null;
};

type VendedorOpt = { user_id: string; nombre_display: string | null };

export default function AsignarLeadsPanel({ vendedores }: { vendedores: VendedorOpt[] }) {
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 400);
  const [pais, setPais] = useState("all");
  const [paises, setPaises] = useState<{ pais: string; n: number }[]>([]);
  const [soloSinAsignar, setSoloSinAsignar] = useState(true);
  const [soloCaptadosIa, setSoloCaptadosIa] = useState(false);
  const [captadosIaPendientes, setCaptadosIaPendientes] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vendedorAsignar, setVendedorAsignar] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [loteCantidad, setLoteCantidad] = useState("100");
  const [enviandoLote, setEnviandoLote] = useState(false);

  const vendedorMap = useMemo(() => new Map(vendedores.map((v) => [v.user_id, v.nombre_display])), [vendedores]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    supabase.rpc("leads_campana_paises").then(({ data }: { data: { pais: string; n: number }[] | null }) => {
      if (data) setPaises(data);
    });
  }, []);

  useEffect(() => { setPage(0); }, [qDebounced, pais, soloSinAsignar, soloCaptadosIa]);
  useEffect(() => { setSelected(new Set()); }, [page, qDebounced, pais, soloSinAsignar, soloCaptadosIa]);

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("leads_campana")
          .select("id, nombre, telefono, email, pais, vendedor_id, fecha_asignacion, escalado_ia_at, escalado_ia_motivo", { count: "exact" })
        // Nunca ofrecer para asignar un lead archivado: sería devolverle al
        // vendedor un duplicado o un número inmarcable que ya se sacó de circulación.
        .not("archivado", "is", true);
        if (soloSinAsignar) query = query.is("vendedor_id", null);
        if (soloCaptadosIa) query = query.not("escalado_ia_at", "is", null);
        if (pais !== "all") query = query.eq("pais", pais);
        const term = qDebounced.trim();
        if (term) query = query.or(`nombre.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%`);
        query = soloCaptadosIa
          ? query.order("escalado_ia_at", { ascending: false, nullsFirst: false })
          : query.order("dias_reales", { ascending: false, nullsFirst: false });
        query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

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
  }, [qDebounced, pais, soloSinAsignar, soloCaptadosIa, page, refreshTick]);

  // Contador propio: cuantos leads calientes de Camil-AI estan esperando
  // reparto, para que se vean sin tener que activar el filtro.
  useEffect(() => {
    supabase.rpc("admin_captados_ia_sin_asignar").then(({ data, error }) => {
      if (!error && typeof data === "number") setCaptadosIaPendientes(data);
    });
  }, [refreshTick]);

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
      const ahora = new Date().toISOString();
      const ids = [...selected];
      // Los captados por Camil-AI ya tuvieron su primer contacto, asi que van
      // directo al Pipeline en etapa "contactado"; el resto entra a la Bandeja
      // como siempre. Son dos updates porque los valores difieren por fila.
      const idsIa = rows.filter((r) => selected.has(r.id) && r.escalado_ia_at).map((r) => r.id);
      const idsFrios = ids.filter((id) => !idsIa.includes(id));

      if (idsFrios.length) {
        const { error } = await supabase
          .from("leads_campana")
          .update({ vendedor_id: vendedorAsignar, fecha_asignacion: ahora, etapa_venta: "nuevo", primer_contacto_at: null })
          .in("id", idsFrios);
        if (error) throw error;
      }
      if (idsIa.length) {
        const { error } = await supabase
          .from("leads_campana")
          .update({ vendedor_id: vendedorAsignar, fecha_asignacion: ahora, etapa_venta: "contactado" })
          .in("id", idsIa);
        if (error) throw error;
      }
      toast({
        title: `${selected.size} leads enviados`,
        description: idsIa.length
          ? `${idsIa.length} captado(s) por IA entran directo al Pipeline en "contactado".`
          : undefined,
      });
      setSelected(new Set());
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast({ title: "No se pudo enviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setAsignando(false);
    }
  };

  const enviarLote = async () => {
    if (!vendedorAsignar) return;
    setEnviandoLote(true);
    try {
      const { data, error } = await supabase.rpc("admin_asignar_leads", {
        _vendedor_id: vendedorAsignar,
        _cantidad: loteCantidad === "todos" ? null : Number(loteCantidad),
        _pais: pais,
        _solo_sin_asignar: soloSinAsignar,
        _busqueda: qDebounced.trim() || null,
        _solo_captados_ia: soloCaptadosIa,
      });
      if (error) throw error;
      const asignados = (data ?? [])[0]?.asignados ?? 0;
      toast({ title: `${asignados} leads enviados`, description: asignados === 0 ? "No había leads que calzaran con el filtro." : undefined });
      setSelected(new Set());
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast({ title: "No se pudo enviar el lote", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setEnviandoLote(false);
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
          Único lugar del sistema donde se envían leads de campaña a un vendedor. Selecciona filas para enviar puntual, o usa "Enviar por lote" para mandar 100, 200… hasta todos los que calcen con el filtro.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {captadosIaPendientes !== null && captadosIaPendientes > 0 && (
          <button
            type="button"
            onClick={() => { setSoloCaptadosIa(true); setSoloSinAsignar(true); }}
            className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-left text-xs hover:bg-emerald-500/10"
          >
            <Bot className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong className="font-semibold text-emerald-700">{captadosIaPendientes}</strong>{" "}
              lead(s) captado(s) por Camil-AI esperando reparto. Ya conversaron con el bot: al asignarlos entran
              directo al Pipeline en "contactado", sin pasar por la Bandeja.
            </span>
          </button>
        )}

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
          <div className="flex flex-col justify-center gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloSinAsignar} onCheckedChange={setSoloSinAsignar} /> Solo sin asignar
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloCaptadosIa} onCheckedChange={setSoloCaptadosIa} /> Solo captados por IA
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Vendedor a asignar:</span>
          <Select value={vendedorAsignar} onValueChange={setVendedorAsignar}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Elegir vendedor" /></SelectTrigger>
            <SelectContent>
              {vendedores.map((v) => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.nombre_display || v.user_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#003DA5]/30 bg-[#003DA5]/5 p-2">
            <Badge variant="secondary">{selected.size} seleccionados</Badge>
            <Button type="button" size="sm" disabled={!vendedorAsignar || asignando} onClick={enviarAVendedor} className="gap-1.5">
              {asignando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Enviar seleccionados
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-muted-foreground">Limpiar</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviar por lote (según el filtro actual):</span>
          <Select value={loteCantidad} onValueChange={setLoteCantidad}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOTES.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} leads</SelectItem>
              ))}
              <SelectItem value="todos">Todos los filtrados</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" disabled={!vendedorAsignar || enviandoLote} onClick={enviarLote} className="gap-1.5">
            {enviandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Enviar lote a vendedor
          </Button>
        </div>

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
                      <div className="flex items-center gap-1.5 font-medium">
                        {l.nombre || "—"}
                        {l.escalado_ia_at && (
                          <Bot
                            className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                            aria-label="Captado por el sistema IA"
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {l.telefono && <span>{l.telefono}</span>}
                        {l.email && <span>{l.email}</span>}
                      </div>
                      {l.escalado_ia_at && (
                        <div className="text-[11px] text-emerald-700">
                          Captado por el sistema IA{l.escalado_ia_motivo ? ` — ${l.escalado_ia_motivo}` : ""}
                        </div>
                      )}
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

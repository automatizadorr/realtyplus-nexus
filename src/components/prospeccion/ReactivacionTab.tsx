import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Loader2, RotateCcw, MessageCircle, Mail as MailIcon, Send,
  ChevronLeft, ChevronRight, Filter, UserPlus,
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
import { useRole } from "@/hooks/use-is-admin";
import { orderTags } from "@/lib/permanentTags";
import { waLinkWithIcebreaker } from "@/lib/icebreakers";

type Tag = { id: string; nombre: string; color: string; es_permanente?: boolean | null };
type LeadRow = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; estado: string | null; puntuacion: number | null;
  dias_reales: number | null; ha_respondido: boolean | null; archivado: boolean | null;
  tag_ids: string[] | null; ultimo_contacto_at: string | null; resumen_ia: string | null;
  vendedor_id: string | null; etapa_venta: string | null;
};

const PAGE_SIZE = 25;
const MAX_ENVIO = 200; // tope de destinatarios por campaña en send-personalized-campaign
const LOTES = [50, 100, 200, MAX_ENVIO]; // tandas de correos (Resend gratis: 200 correos/día — 2 cuentas)
const LEADS_IMPORT_KEY = "prospeccion_leads_import";

type Filters = {
  q: string; tagId: string; pais: string; estado: string;
  respondido: string; incluirArchivados: boolean; soloConEmail: boolean;
};

// Arma el link de WhatsApp con un icebreaker variado (determinístico por lead).
const waIcebreaker = (l: LeadRow): string | null =>
  waLinkWithIcebreaker(l.telefono || "", { nombre: l.nombre, ciudad: l.pais, empresa: l.nombre, pais: l.pais });

// Aplica los filtros a un query builder de leads_campana.
// Compartido por la tabla paginada y por la carga a Correos (una sola fuente de verdad).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, f: Filters): any {
  if (!f.incluirArchivados) query = query.not("archivado", "is", true);
  if (f.tagId !== "all") query = query.contains("tag_ids", [f.tagId]);
  if (f.pais !== "all") query = query.eq("pais", f.pais);
  if (f.estado !== "all") query = query.eq("estado", f.estado);
  if (f.respondido === "si") query = query.eq("ha_respondido", true);
  if (f.respondido === "no") query = query.not("ha_respondido", "is", true);
  if (f.soloConEmail) query = query.not("email", "is", null).neq("email", "");
  const term = f.q.trim();
  if (term) query = query.or(`nombre.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%`);
  return query;
}

const digits = (t?: string | null) => (t ?? "").split("@")[0].replace(/\D/g, "");
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

// Estados del log de correos (correo_envios) para la columna "Último correo".
const CORREO_UI: Record<string, { label: string; cls: string }> = {
  enviado:   { label: "Enviado", cls: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  entregado: { label: "Recibido", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  abierto:   { label: "Abierto", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  click:     { label: "Clic", cls: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  rebotado:  { label: "Rebotó", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  quejado:   { label: "Queja", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
};
const fmtFechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function ReactivacionTab() {
  const { toast } = useToast();
  const { canWrite } = useRole();
  const navigate = useNavigate();

  // RPC de facets (país) no está en el types.ts generado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Catálogos
  const [tags, setTags] = useState<Tag[]>([]);
  const [paises, setPaises] = useState<{ pais: string; n: number }[]>([]);
  const [vendedores, setVendedores] = useState<{ user_id: string; nombre_display: string | null }[]>([]);

  // Selección para "Enviar a vendedor"
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vendedorAsignar, setVendedorAsignar] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Filtros
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 400);
  const [tagId, setTagId] = useState("all");
  const [pais, setPais] = useState("all");
  const [estado, setEstado] = useState("all");
  const [respondido, setRespondido] = useState("all"); // all | si | no
  const [incluirArchivados, setIncluirArchivados] = useState(false);
  const [soloConEmail, setSoloConEmail] = useState(false);
  const [soloConCorreo, setSoloConCorreo] = useState(false);
  const [soloSinCorreo, setSoloSinCorreo] = useState(false);
  // email → último envío de correo conocido (estado, fecha, nº de envíos).
  const [correosMap, setCorreosMap] = useState<Record<string, { estado: string; enviado_at: string | null; count: number }>>({});

  // Datos + paginación
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoSin, setCargandoSin] = useState(false);

  // Tandas de envío a Correos: tamaño (50/100/200) y cuál se envía hoy.
  const [lote, setLote] = useState(100);
  const [tanda, setTanda] = useState(1);
  const totalTandas = Math.max(1, Math.ceil(total / lote));

  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Catálogos una sola vez
  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color, es_permanente").order("nombre")
      .then(({ data }) => { if (data) setTags(orderTags(data as Tag[])); });
    sb.rpc("leads_campana_paises").then(({ data }: { data: { pais: string; n: number }[] | null }) => {
      if (data) setPaises(data);
    });
    sb.from("vendedores").select("user_id, nombre_display").eq("activo", true).order("nombre_display")
      .then(({ data }: { data: { user_id: string; nombre_display: string | null }[] | null }) => {
        if (data) setVendedores(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de página o filtros, se limpia la selección (evita asignar filas que ya no se ven).
  useEffect(() => { setSelected(new Set()); }, [page, qDebounced, tagId, pais, estado, respondido]);

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

  // Al cambiar cualquier filtro, volvemos a la página 0
  useEffect(() => { setPage(0); }, [qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail, soloConCorreo, soloSinCorreo]);

  // Emails que ya recibieron correo (estado <> fallido). Tope 5000 para rendimiento.
  const emailsConCorreo = async (): Promise<Set<string>> => {
    const { data } = await sb.from("correo_envios").select("email").not("estado", "eq", "fallido").limit(5000);
    return new Set(
      (data ?? []).map((r: { email: string }) => (r.email || "").trim().toLowerCase()).filter(Boolean),
    );
  };
  const enriquecerCorreos = async (rows: LeadRow[]): Promise<Record<string, { estado: string; enviado_at: string | null; count: number }>> => {
    const emails = rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean);
    const map: Record<string, { estado: string; enviado_at: string | null; count: number }> = {};
    if (!emails.length) return map;
    const { data } = await sb
      .from("correo_envios")
      .select("email, estado, enviado_at")
      .in("email", emails)
      .order("enviado_at", { ascending: false });
    for (const e of (data ?? []) as { email: string; estado: string; enviado_at: string | null }[]) {
      const k = (e.email || "").trim().toLowerCase();
      const cur = map[k];
      if (cur) { cur.count++; continue; }
      map[k] = { estado: e.estado, enviado_at: e.enviado_at, count: 1 };
    }
    return map;
  };

  // Consulta paginada server-side (nunca trae las 8k filas de golpe)
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("leads_campana")
          .select(
            "id, nombre, telefono, email, pais, estado, puntuacion, dias_reales, ha_respondido, archivado, tag_ids, ultimo_contacto_at, resumen_ia, vendedor_id, etapa_venta",
            { count: "exact" }
          );
        query = applyFilters(query, { q: qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail });

        // Filtro por correo: se resuelve mayoritariamente en la URL (primeros
        // 300 emails, seguros contra el límite de URI de PostgREST). Si hay más
        // de 300 emails con correo, el resto se filtra client-side al recibir.
        let extraExcluir: Set<string> | null = null;
        if (soloSinCorreo || soloConCorreo) {
          const setE = await emailsConCorreo();
          if (cancel) return;
          if (soloConCorreo) {
            if (!setE.size) { setRows([]); setTotal(0); setCorreosMap({}); setLoading(false); return; }
            query = query.in("email", [...setE]);
          } else { // soloSinCorreo
            query = query.not("email", "is", null).neq("email", "");
            const arr = [...setE];
            const enUrl = arr.slice(0, 300);
            if (enUrl.length) query = query.not("email", "in", enUrl);
            if (arr.length > 300) extraExcluir = new Set(arr.slice(300));
          }
        }

        query = query
          .order("dias_reales", { ascending: false, nullsFirst: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        const { data, count, error } = await query;
        if (error) throw error;
        if (cancel) return;

        let filas = (data ?? []) as LeadRow[];
        if (extraExcluir) filas = filas.filter(r => !extraExcluir!.has((r.email || "").trim().toLowerCase()));
        setRows(filas);
        setTotal(count ?? filas.length);
        setCorreosMap(await enriquecerCorreos(filas));
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
  }, [qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail, soloConCorreo, soloSinCorreo, page, refreshTick]);

  const resetFiltros = () => {
    setQ(""); setTagId("all"); setPais("all"); setEstado("all");
    setRespondido("all"); setIncluirArchivados(false); setSoloConEmail(false); setSoloConCorreo(false); setSoloSinCorreo(false);
    setCorreosMap({});
  };

  // Al cambiar el tamaño de tanda volvemos a la tanda 1; si el total baja, la clampa.
  useEffect(() => { setTanda(1); }, [lote]);
  useEffect(() => { setTanda((t) => Math.min(t, totalTandas)); }, [totalTandas]);

  // Carga UNA tanda del filtro (con email, deduplicados) hacia Correos Personalizados.
  // Las tandas existen para respetar el límite de Resend gratis (200 correos/día — 2 cuentas).
  const cargarEnCorreos = async () => {
    setCargando(true);
    try {
      let query = supabase.from("leads_campana").select("nombre, email, pais, resumen_ia");
      query = applyFilters(query, { q: qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail });

      if (soloSinCorreo || soloConCorreo) {
        const setE = await emailsConCorreo();
        if (soloConCorreo) {
          if (!setE.size) {
            setCargando(false);
            toast({ title: "Sin correos en el filtro", description: "Ningún lead del filtro recibió correo aún.", variant: "destructive" });
            return;
          }
          query = query.in("email", [...setE]);
        }
        // soloSinCorreo: el filtro por correo se aplica client-side abajo, para
        // no reventar la URL con miles de emails en el GET de PostgREST.
      }

      query = query
        .not("email", "is", null).neq("email", "")
        .order("dias_reales", { ascending: false, nullsFirst: false })
        .range((tanda - 1) * lote, Math.min(tanda * lote * 3, Math.min(MAX_ENVIO * 3, 5000)) - 1);
      const { data, error } = await query;
      if (error) throw error;

      // Filtro client-side para soloSinCorreo
      let filas = (data ?? []) as Pick<LeadRow, "nombre" | "email" | "pais" | "resumen_ia">[];
      if (soloSinCorreo) {
        const { data: correos } = await sb.from("correo_envios").select("email").not("estado", "eq", "fallido").limit(5000);
        const setExcluir = new Set((correos ?? []).map((r: { email: string }) => (r.email || "").trim().toLowerCase()).filter(Boolean));
        filas = filas.filter(l => !setExcluir.has((l.email || "").trim().toLowerCase()));
      }

      const seen = new Set<string>();
      const recips: { email: string; empresa: string; ciudad: string; gancho: string }[] = [];
      for (const l of filas) {
        const email = (l.email || "").trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        recips.push({ email, empresa: l.nombre || "", ciudad: l.pais || "", gancho: l.resumen_ia || "" });
        if (recips.length >= lote) break;
      }
      if (!recips.length) { toast({ title: "Sin correos en el filtro", variant: "destructive" }); return; }

      sessionStorage.setItem(LEADS_IMPORT_KEY, JSON.stringify(recips));
      toast({
        title: `${recips.length} leads cargados (tanda ${tanda} de ${totalTandas})`,
        description: totalTandas > 1
          ? `Resend gratis envía 200 correos/día (2 cuentas). Tanda ${tanda} de ${totalTandas}; quedan ${totalTandas - tanda} para los próximos días.`
          : "Revisa y envía en Correos Personalizados.",
      });
      navigate("/correos-personalizados");
    } catch (e) {
      toast({ title: "Error al cargar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCargando(false);
    }
  };

  // Carga los leads con email que NUNCA recibieron un correo (sin entrada en correo_envios).
  // Útil para el primer contacto masivo sin re-contactar a los que ya están en seguimiento.
  const cargarSinCorreoEnCorreos = async () => {
    setCargandoSin(true);
    try {
      const { data: enviados } = await sb
        .from("correo_envios")
        .select("email")
        .not("estado", "eq", "fallido")
        .limit(10000);
      const yaEnviados = new Set(
        (enviados ?? []).map((r: { email: string }) => (r.email || "").trim().toLowerCase()).filter(Boolean),
      );

      // Traemos un bloque grande para tener margen tras excluir los ya enviados
      let query = supabase
        .from("leads_campana")
        .select("nombre, email, pais, resumen_ia")
        .not("email", "is", null)
        .neq("email", "");
      query = applyFilters(query, { q: qDebounced, tagId, pais, estado, respondido, incluirArchivados, soloConEmail });
      query = query
        .order("dias_reales", { ascending: false, nullsFirst: false })
        .limit(Math.min(lote * 5, 2000));

      const { data, error } = await query;
      if (error) throw error;

      const seen = new Set<string>();
      const recips: { email: string; empresa: string; ciudad: string; gancho: string }[] = [];
      for (const l of (data ?? []) as Pick<LeadRow, "nombre" | "email" | "pais" | "resumen_ia">[]) {
        if (recips.length >= lote) break;
        const email = (l.email || "").trim().toLowerCase();
        if (!email || seen.has(email) || yaEnviados.has(email)) continue;
        seen.add(email);
        recips.push({ email, empresa: l.nombre || "", ciudad: l.pais || "", gancho: l.resumen_ia || "" });
      }

      if (!recips.length) {
        toast({ title: "Sin leads nuevos", description: "Todos los leads con email del filtro ya recibieron al menos un correo.", variant: "destructive" });
        return;
      }
      sessionStorage.setItem(LEADS_IMPORT_KEY, JSON.stringify(recips));
      toast({ title: `${recips.length} leads sin correo previo cargados`, description: "Revisa y envía en Correos Personalizados." });
      navigate("/correos-personalizados");
    } catch (e) {
      toast({ title: "Error al cargar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setCargandoSin(false);
    }
  };

  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const hasta = Math.min(total, page * PAGE_SIZE + rows.length);

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
        Estos leads provienen de tus <span className="font-semibold text-foreground">campañas</span> (no del buscador de leads).
        Úsalos para re-contactar y reactivar contactos que ya no responden.
      </p>
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-[#003DA5]" /> Filtro de leads de campaña
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
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloConCorreo} onCheckedChange={(v) => { setSoloConCorreo(v); if (v) setSoloSinCorreo(false); }} /> Solo con correo enviado
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={soloSinCorreo} onCheckedChange={(v) => { setSoloSinCorreo(v); if (v) setSoloConCorreo(false); }} /> Solo con correo <span className="font-semibold text-red-600">NO</span> enviado
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
              Leads de campaña
              <Badge variant="secondary">{loading ? "…" : total.toLocaleString("es-CL")}</Badge>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Select value={String(lote)} onValueChange={(v) => setLote(Number(v))} disabled={loading || cargando || total === 0}>
                <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOTES.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} por tanda</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(tanda)} onValueChange={(v) => setTanda(Number(v))} disabled={loading || cargando || total === 0}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalTandas }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      Tanda {i + 1} · {i * lote + 1}–{Math.min((i + 1) * lote, total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={cargarEnCorreos} disabled={loading || cargando || cargandoSin || total === 0} className="gap-1.5">
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Cargar tanda {tanda} en Correos
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={cargarSinCorreoEnCorreos} disabled={loading || cargando || cargandoSin || total === 0} className="gap-1.5">
                {cargandoSin ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailIcon className="h-4 w-4" />}
                Sin correo previo
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#003DA5]/30 bg-[#003DA5]/5 p-2">
              <Badge variant="secondary">{selected.size} seleccionados</Badge>
              {canWrite && (
                <>
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
                </>
              )}
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
                  <TableHead className="hidden sm:table-cell">Último correo</TableHead>
                  <TableHead className="hidden md:table-cell">Etiquetas</TableHead>
                  <TableHead className="hidden lg:table-cell w-16">Días</TableHead>
                  <TableHead className="hidden lg:table-cell w-16">Punt.</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8}>
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                    </div>
                  </TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8}>
                    <div className="py-10 text-center text-sm text-muted-foreground">Sin resultados con estos filtros.</div>
                  </TableCell></TableRow>
                ) : (
                  rows.map((l) => {
                    const wa = waIcebreaker(l);
                    return (
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
                            {l.telefono && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-600" /> {l.telefono}</span>}
                            {l.email && <span className="inline-flex items-center gap-1"><MailIcon className="h-3 w-3" /> {l.email}</span>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {l.ha_respondido && <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">respondió</span>}
                            {l.vendedor_id && <span className="inline-block rounded-full border border-[#003DA5]/30 bg-[#003DA5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#003DA5]">enviado</span>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{l.pais || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {(() => {
                            const c = l.email ? correosMap[(l.email || "").trim().toLowerCase()] : undefined;
                            if (!c) return <span className="text-xs text-muted-foreground">—</span>;
                            const ui = CORREO_UI[c.estado] ?? CORREO_UI.enviado;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.cls}`}>
                                  {ui.label}
                                  {c.count > 1 && <span className="opacity-70">·{c.count}</span>}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{fmtFechaHora(c.enviado_at)}</span>
                              </div>
                            );
                          })()}
                        </TableCell>
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

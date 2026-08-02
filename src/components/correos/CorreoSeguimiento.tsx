import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, MailCheck, Eye, MousePointerClick, AlertTriangle, Mail, Sparkles, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Envio = {
  id: string; email: string; empresa: string | null; asunto: string | null;
  estado: string; enviado_at: string; entregado_at: string | null;
  abierto_at: string | null; click_at: string | null; opens: number; clicks: number; error: string | null;
};
type Resumen = { total: number; entregados: number; abiertos: number; clicks: number; rebotados: number };

const ESTADO_UI: Record<string, { label: string; cls: string }> = {
  enviado:   { label: "Enviado",   cls: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  entregado: { label: "Recibido",  cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  abierto:   { label: "Abierto",   cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  click:     { label: "Clic",      cls: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  rebotado:  { label: "Rebotó",    cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  quejado:   { label: "Queja",     cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  fallido:   { label: "Falló",     cls: "bg-red-500/15 text-red-600 border-red-500/30" },
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const abrio = (r: Envio) => Boolean(r.abierto_at) || r.estado === "abierto" || r.estado === "click";
const hizoClic = (r: Envio) => Boolean(r.click_at) || r.estado === "click";
const recibido = (r: Envio) =>
  Boolean(r.entregado_at) || ["entregado", "abierto", "click"].includes(r.estado);

type Filtro = "todos" | "recibidos" | "abrieron" | "no_abrieron" | "clic";

type Props = {
  refreshKey?: number;
  onCargarLeads?: (leads: { email: string; empresa: string }[]) => void;
};

export default function CorreoSeguimiento({ refreshKey = 0, onCargarLeads }: Props) {
  // correo_envios / RPC aún no están en el types.ts generado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [rows, setRows] = useState<Envio[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cargandoSeg, setCargandoSeg] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: envios }, { data: res }] = await Promise.all([
        sb.from("correo_envios").select("*").order("enviado_at", { ascending: false }).limit(100),
        sb.rpc("correo_envios_resumen", { _dias: 30 }),
      ]);
      setRows((envios ?? []) as Envio[]);
      setResumen(Array.isArray(res) && res[0] ? (res[0] as Resumen) : null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  const visibles = useMemo(() => {
    if (filtro === "recibidos") return rows.filter(recibido);
    if (filtro === "abrieron") return rows.filter(abrio);
    if (filtro === "no_abrieron") return rows.filter((r) => !abrio(r) && r.estado !== "rebotado" && r.estado !== "fallido");
    if (filtro === "clic") return rows.filter(hizoClic);
    return rows;
  }, [rows, filtro]);

  // Carga en el composer SOLO los del segmento activo (consulta la BD, no solo los visibles).
  const campanaSegmento = async () => {
    if (!onCargarLeads) return;
    setCargandoSeg(true);
    try {
      let query = sb.from("correo_envios").select("email, empresa, abierto_at, estado");
      if (filtro === "abrieron") {
        query = query.or("abierto_at.not.is.null,estado.eq.click,estado.eq.abierto");
      } else if (filtro === "recibidos") {
        query = query
          .or("entregado_at.not.is.null,estado.eq.entregado,estado.eq.abierto,estado.eq.click")
          .not("estado", "in", '("rebotado","fallido")');
      } else if (filtro === "no_abrieron") {
        query = query
          .or("entregado_at.not.is.null,estado.eq.entregado,estado.eq.abierto,estado.eq.click")
          .not("estado", "in", '("rebotado","fallido")')
          .or("abierto_at.is.null,estado.not.in.(" + ['"abierto"', '"click"'].join(",") + ")");
      } else if (filtro === "clic") {
        query = query.or("click_at.not.is.null,estado.eq.click");
      } else {
        query = query.not("estado", "in", '("rebotado","fallido")');
      }
      const { data } = await query.order("abierto_at", { ascending: false }).limit(1000);
      const seen = new Set<string>();
      const leads: { email: string; empresa: string }[] = [];
      for (const r of (data ?? []) as { email: string; empresa: string | null }[]) {
        const email = (r.email || "").trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        leads.push({ email, empresa: r.empresa || "" });
      }
      onCargarLeads(leads);
    } finally {
      setCargandoSeg(false);
    }
  };

  const FILTRO_LABEL: Record<Filtro, string> = {
    todos: "todos los que recibieron",
    recibidos: "los que recibieron",
    abrieron: "los que abrieron",
    no_abrieron: "los que no abrieron",
    clic: "los que hicieron clic",
  };

  const segmentos: { id: Filtro; label: string; cls: string; n: number }[] = [
    { id: "todos", label: "Todos", cls: "from-slate-400 to-slate-500", n: rows.length },
    { id: "recibidos", label: "Recibidos", cls: "from-blue-400 to-blue-600", n: rows.filter(recibido).length },
    { id: "abrieron", label: "Abrieron", cls: "from-emerald-400 to-emerald-600", n: rows.filter(abrio).length },
    { id: "no_abrieron", label: "No abrieron", cls: "from-amber-400 to-orange-500", n: rows.filter((r) => !abrio(r) && r.estado !== "rebotado" && r.estado !== "fallido").length },
    { id: "clic", label: "Con clic", cls: "from-violet-400 to-fuchsia-600", n: rows.filter(hizoClic).length },
  ];

  const kpis = [
    { k: "Enviados", v: resumen?.total ?? 0, icon: Mail, cls: "text-slate-600" },
    { k: "Recibidos", v: resumen?.entregados ?? 0, icon: MailCheck, cls: "text-blue-600" },
    { k: "Abiertos", v: resumen?.abiertos ?? 0, icon: Eye, cls: "text-emerald-600" },
    { k: "Clics", v: resumen?.clicks ?? 0, icon: MousePointerClick, cls: "text-violet-600" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <MailCheck className="h-4 w-4 text-[#003DA5]" /> Seguimiento de correos
            <span className="text-xs font-normal text-muted-foreground">(últimos 30 días)</span>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((c) => (
            <div key={c.k} className="rounded-lg border p-3">
              <div className={`flex items-center gap-1.5 text-2xl font-semibold ${c.cls}`}>
                <c.icon className="h-4 w-4" /> {c.v}
              </div>
              <div className="text-xs text-muted-foreground">{c.k}</div>
            </div>
          ))}
        </div>

        {/* Segmentos animados + campaña con los que abrieron */}
        <style>{`@keyframes lhGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
        <div className="flex flex-wrap items-center gap-2">
          {segmentos.map((s) => {
            const active = filtro === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setFiltro(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? `bg-gradient-to-r ${s.cls} text-white shadow-sm scale-[1.03]`
                    : "border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-muted"}`}>{s.n}</span>
              </button>
            );
          })}
          {onCargarLeads && (
            <button
              type="button"
              onClick={campanaSegmento}
              disabled={cargandoSeg || (segmentos.find((s) => s.id === filtro)?.n ?? 0) === 0}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:scale-[1.04] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
              style={{
                backgroundImage: "linear-gradient(90deg,#003DA5,#0e7c66,#7c1f2e,#C9A227,#003DA5)",
                backgroundSize: "300% 300%",
                animation: "lhGrad 6s ease infinite",
              }}
            >
              {cargandoSeg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Campaña con {FILTRO_LABEL[filtro]}
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {loading ? "Cargando…" : "Aún no hay envíos registrados. Al enviar una campaña aparecerán aquí con su estado."}
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Ningún correo en este segmento (de los últimos 100 mostrados).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Enviado</TableHead>
                  <TableHead className="hidden md:table-cell">Recibido</TableHead>
                  <TableHead className="hidden md:table-cell">Abierto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r) => {
                  const ui = ESTADO_UI[r.estado] ?? ESTADO_UI.enviado;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.email}</div>
                        <div className="text-xs text-muted-foreground">{r.empresa || r.asunto || ""}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.cls}`}>
                          {ui.label}{r.estado === "rebotado" && <AlertTriangle className="h-3 w-3" />}
                          {r.opens > 1 && <span className="opacity-70">·{r.opens}</span>}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{fmt(r.enviado_at)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmt(r.entregado_at)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmt(r.abierto_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

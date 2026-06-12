import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EditablePhoneCell } from "@/components/EditablePhoneCell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScanSearch,
  Tags,
  Mic,
  BotMessageSquare,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from "lucide-react";
import { useVoiceLeads } from "@/hooks/use-voice-leads";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type ScannerLead = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono: string;
  email: string | null;
  pais: string | null;
  estado: string;
  campaign_name: string;
  created_at: string;
};

type TagRow = { id: string; nombre: string; color: string };
type LeadTagged = { id: string; nombre: string; telefono: string; tag_ids: string[] | null };

type AIContact = {
  telefono: string;
  nombre: string | null;
  pais: string | null;
  campaign_name: string | null;
  last_at: string;
  count: number;
};

type DialogKind = null | "scanner" | "tags" | "voice" | "ai";

type SortDir = "asc" | "desc";
type Sort<T extends string> = { key: T; dir: SortDir } | null;

function useSort<T extends string>(initial: Sort<T> = null) {
  const [sort, setSort] = useState<Sort<T>>(initial);
  const toggle = (key: T) =>
    setSort((s) =>
      !s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null,
    );
  return { sort, toggle };
}

function SortHead<T extends string>({
  k,
  label,
  sort,
  onToggle,
  className,
}: {
  k: T;
  label: string;
  sort: Sort<T>;
  onToggle: (k: T) => void;
  className?: string;
}) {
  const active = sort?.key === k;
  const Icon = !active ? ArrowUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function sortBy<T, K extends string>(rows: T[], sort: Sort<K>, getter: (r: T, k: K) => unknown) {
  if (!sort) return rows;
  const { key, dir } = sort;
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getter(a, key);
    const vb = getter(b, key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
    return String(va).localeCompare(String(vb), "es", { numeric: true }) * mult;
  });
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#cc0000",
  "#003366",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

function trendByDay(items: { created_at?: string; last_at?: string }[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  items.forEach((it) => {
    const ts = it.created_at || it.last_at;
    if (!ts) return;
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Array.from(buckets.entries()).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));
}

type DateRange = { from: string; to: string };
const emptyRange: DateRange = { from: "", to: "" };

function inRange(ts: string | null | undefined, r: DateRange) {
  if (!ts) return true;
  const day = ts.slice(0, 10);
  if (r.from && day < r.from) return false;
  if (r.to && day > r.to) return false;
  return true;
}

function FiltersBar({
  range,
  onRange,
  selectValue,
  onSelectValue,
  selectOptions,
  selectLabel,
  showDate = true,
  onClear,
}: {
  range?: DateRange;
  onRange?: (r: DateRange) => void;
  selectValue?: string;
  onSelectValue?: (v: string) => void;
  selectOptions?: { value: string; label: string }[];
  selectLabel?: string;
  showDate?: boolean;
  onClear: () => void;
}) {
  const hasActive =
    (range && (range.from || range.to)) || (selectValue && selectValue !== "__all__");
  return (
    <div className="flex flex-wrap items-end gap-2 mb-3 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
        <Filter className="h-3.5 w-3.5" /> Filtros
      </div>
      {showDate && range && onRange && (
        <>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-muted-foreground mb-0.5">Desde</label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => onRange({ ...range, from: e.target.value })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-muted-foreground mb-0.5">Hasta</label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => onRange({ ...range, to: e.target.value })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        </>
      )}
      {selectOptions && onSelectValue && (
        <div className="flex flex-col">
          <label className="text-[10px] uppercase text-muted-foreground mb-0.5">
            {selectLabel || "Filtro"}
          </label>
          <Select value={selectValue || "__all__"} onValueChange={onSelectValue}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {selectOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs">
          <X className="h-3 w-3 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}

export default function NewStatsSection() {
  const [scanner, setScanner] = useState<ScannerLead[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [taggedLeads, setTaggedLeads] = useState<LeadTagged[]>([]);
  const [aiContacts, setAiContacts] = useState<AIContact[]>([]);
  const [aiMessages, setAiMessages] = useState<{ created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // search state per dialog
  const [scannerSearch, setScannerSearch] = useState("");
  const [tagsSearch, setTagsSearch] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [aiSearch, setAiSearch] = useState("");

  // advanced filters per dialog
  const [scannerRange, setScannerRange] = useState<DateRange>(emptyRange);
  const [scannerCampaign, setScannerCampaign] = useState("__all__");
  const [voiceStatus, setVoiceStatus] = useState("__all__");
  const [aiRange, setAiRange] = useState<DateRange>(emptyRange);
  const [aiCampaign, setAiCampaign] = useState("__all__");
  const [tagsTagId, setTagsTagId] = useState("__all__");

  // sort state per dialog
  const scannerSort = useSort<"nombre" | "telefono" | "pais" | "campaign_name" | "estado" | "created_at">({
    key: "created_at",
    dir: "desc",
  });
  const voiceSort = useSort<"nombre" | "telefono" | "tipo_interes" | "ubicacion" | "presupuesto" | "status">();
  const aiSort = useSort<"nombre" | "telefono" | "pais" | "campaign_name" | "count" | "last_at">({
    key: "last_at",
    dir: "desc",
  });

  const { leads: voiceLeads, loading: voiceLoading } = useVoiceLeads();

  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes, lRes, mRes] = await Promise.all([
          supabase
            .from("leads_escaner")
            .select("id, nombre, apellidos, telefono, email, pais, estado, campaign_name, created_at")
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase.from("lead_tags").select("id, nombre, color"),
          supabase.from("leads_campana").select("id, nombre, telefono, tag_ids").limit(10000),
          supabase
            .from("mensajes_automatizacion")
            .select("telefono, nombre, pais, campaign_name, created_at, direccion")
            .eq("direccion", "outbound")
            .order("created_at", { ascending: false })
            .limit(10000),
        ]);
        setScanner((sRes.data ?? []) as ScannerLead[]);
        setTags((tRes.data ?? []) as TagRow[]);
        setTaggedLeads((lRes.data ?? []) as LeadTagged[]);

        const map = new Map<string, AIContact>();
        const allMsgs: { created_at: string }[] = [];
        (mRes.data ?? []).forEach((m: any) => {
          if (m.created_at) allMsgs.push({ created_at: m.created_at });
          if (!m.telefono) return;
          const cur = map.get(m.telefono);
          if (cur) {
            cur.count++;
            if (m.created_at > cur.last_at) cur.last_at = m.created_at;
          } else {
            map.set(m.telefono, {
              telefono: m.telefono,
              nombre: m.nombre,
              pais: m.pais,
              campaign_name: m.campaign_name,
              last_at: m.created_at,
              count: 1,
            });
          }
        });
        setAiMessages(allMsgs);
        setAiContacts(Array.from(map.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tagStats = useMemo(() => {
    return tags
      .map((t) => {
        const leads = taggedLeads.filter((l) => l.tag_ids?.includes(t.id));
        return { ...t, count: leads.length, leads };
      })
      .sort((a, b) => b.count - a.count);
  }, [tags, taggedLeads]);

  const totalTagged = useMemo(
    () => taggedLeads.filter((l) => (l.tag_ids?.length ?? 0) > 0).length,
    [taggedLeads],
  );

  // ── Base (filter-aware) datasets feeding both charts and tables ───────
  const scannerBase = useMemo(() => {
    return scanner.filter(
      (s) =>
        inRange(s.created_at, scannerRange) &&
        (scannerCampaign === "__all__" || (s.campaign_name || "Sin campaña") === scannerCampaign),
    );
  }, [scanner, scannerRange, scannerCampaign]);

  const voiceBase = useMemo(() => {
    return voiceLeads.filter(
      (v) => voiceStatus === "__all__" || (v.status || "nuevo").toLowerCase() === voiceStatus,
    );
  }, [voiceLeads, voiceStatus]);

  const aiContactsBase = useMemo(() => {
    return aiContacts.filter(
      (a) =>
        inRange(a.last_at, aiRange) &&
        (aiCampaign === "__all__" || (a.campaign_name || "Sin campaña") === aiCampaign),
    );
  }, [aiContacts, aiRange, aiCampaign]);

  const aiMessagesBase = useMemo(
    () => aiMessages.filter((m) => inRange(m.created_at, aiRange)),
    [aiMessages, aiRange],
  );

  // Filter option lists
  const scannerCampaignOpts = useMemo(
    () =>
      Array.from(new Set(scanner.map((s) => s.campaign_name || "Sin campaña")))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [scanner],
  );
  const aiCampaignOpts = useMemo(
    () =>
      Array.from(new Set(aiContacts.map((a) => a.campaign_name || "Sin campaña")))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [aiContacts],
  );
  const voiceStatusOpts = useMemo(
    () =>
      Array.from(new Set(voiceLeads.map((v) => (v.status || "nuevo").toLowerCase())))
        .sort()
        .map((s) => ({ value: s, label: s })),
    [voiceLeads],
  );
  const tagOpts = useMemo(
    () => tagStats.map((t) => ({ value: t.id, label: `${t.nombre} (${t.count})` })),
    [tagStats],
  );

  // ── Derived data for charts (from filtered base) ──────────────────────
  const scannerByCampaign = useMemo(() => {
    const m = new Map<string, number>();
    scannerBase.forEach((s) =>
      m.set(s.campaign_name || "Sin campaña", (m.get(s.campaign_name || "Sin campaña") || 0) + 1),
    );
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [scannerBase]);

  const scannerTrend = useMemo(() => trendByDay(scannerBase), [scannerBase]);
  const aiTrend = useMemo(() => trendByDay(aiMessagesBase), [aiMessagesBase]);

  const voiceByStatus = useMemo(() => {
    const m = new Map<string, number>();
    voiceBase.forEach((v) => {
      const s = (v.status || "nuevo").toLowerCase();
      m.set(s, (m.get(s) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [voiceBase]);

  const aiByCampaign = useMemo(() => {
    const m = new Map<string, number>();
    aiContactsBase.forEach((a) =>
      m.set(a.campaign_name || "Sin campaña", (m.get(a.campaign_name || "Sin campaña") || 0) + a.count),
    );
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [aiContactsBase]);

  const tagStatsForChart = useMemo(() => {
    if (tagsTagId === "__all__") return tagStats;
    return tagStats.filter((t) => t.id === tagsTagId);
  }, [tagStats, tagsTagId]);

  // ── Filtering / sorting (tables) ──────────────────────────────────────
  const scannerFiltered = useMemo(() => {
    const q = scannerSearch.trim().toLowerCase();
    const filtered = !q
      ? scannerBase
      : scannerBase.filter((s) =>
          [s.nombre, s.apellidos, s.telefono, s.email, s.pais, s.campaign_name, s.estado]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        );
    return sortBy(filtered, scannerSort.sort, (r, k) =>
      k === "nombre" ? `${r.nombre ?? ""} ${r.apellidos ?? ""}`.trim() : (r as any)[k],
    );
  }, [scannerBase, scannerSearch, scannerSort.sort]);

  const voiceFiltered = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase();
    const filtered = !q
      ? voiceBase
      : voiceBase.filter((v) =>
          [v.nombre, v.telefono, v.tipo_interes, v.ubicacion, v.presupuesto, v.status]
            .filter(Boolean)
            .some((x) => String(x).toLowerCase().includes(q)),
        );
    return sortBy(filtered, voiceSort.sort, (r, k) => (r as any)[k]);
  }, [voiceBase, voiceSearch, voiceSort.sort]);

  const aiFiltered = useMemo(() => {
    const q = aiSearch.trim().toLowerCase();
    const filtered = !q
      ? aiContactsBase
      : aiContactsBase.filter((a) =>
          [a.nombre, a.telefono, a.pais, a.campaign_name]
            .filter(Boolean)
            .some((x) => String(x).toLowerCase().includes(q)),
        );
    return sortBy(filtered, aiSort.sort, (r, k) => (r as any)[k]);
  }, [aiContactsBase, aiSearch, aiSort.sort]);

  const tagStatsFiltered = useMemo(() => {
    const q = tagsSearch.trim().toLowerCase();
    const base = tagsTagId === "__all__" ? tagStats : tagStats.filter((t) => t.id === tagsTagId);
    if (!q) return base;
    return base.filter((t) => t.nombre.toLowerCase().includes(q));
  }, [tagStats, tagsSearch, tagsTagId]);

  const cards = [
    {
      key: "scanner" as const,
      title: "Leads Escáner",
      value: scanner.length,
      icon: ScanSearch,
      accent: "text-fuchsia-600",
      bg: "bg-fuchsia-50 dark:bg-fuchsia-950",
      subtitle: `${new Set(scanner.map((s) => s.campaign_name)).size} campañas`,
    },
    {
      key: "tags" as const,
      title: "Leads Etiquetados",
      value: totalTagged,
      icon: Tags,
      accent: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
      subtitle: `${tags.length} etiquetas`,
    },
    {
      key: "voice" as const,
      title: "CRM Realty Web-AI",
      value: voiceLeads.length,
      icon: Mic,
      accent: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950",
      subtitle: voiceLoading
        ? "Cargando..."
        : `${voiceLeads.filter((v) => v.status === "cierre").length} cierres`,
    },
    {
      key: "ai" as const,
      title: "Contactados por IA",
      value: aiContacts.length,
      icon: BotMessageSquare,
      accent: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950",
      subtitle: `${aiContacts.reduce((s, a) => s + a.count, 0)} mensajes enviados`,
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const selectedTag = selectedTagId ? tagStats.find((t) => t.id === selectedTagId) : null;

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Nuevas estadísticas · clic en una tarjeta para ver el detalle
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => setOpenDialog(card.key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenDialog(card.key)}
              className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scanner dialog */}
      <Dialog open={openDialog === "scanner"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanSearch className="h-5 w-5 text-fuchsia-600" />
              Leads desde el Escáner ({scanner.length})
            </DialogTitle>
          </DialogHeader>

          <FiltersBar
            range={scannerRange}
            onRange={setScannerRange}
            selectValue={scannerCampaign}
            onSelectValue={setScannerCampaign}
            selectOptions={scannerCampaignOpts}
            selectLabel="Campaña"
            onClear={() => {
              setScannerRange(emptyRange);
              setScannerCampaign("__all__");
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top campañas</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scannerByCampaign} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" hide />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tendencia últimos 14 días</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scannerTrend} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#cc0000" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono, email, país, campaña..."
              value={scannerSearch}
              onChange={(e) => setScannerSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Mostrando {Math.min(scannerFiltered.length, 500)} de {scannerFiltered.length}
          </p>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="nombre" label="Nombre" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                  <SortHead k="telefono" label="Teléfono" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                  <TableHead>Email</TableHead>
                  <SortHead k="pais" label="País" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                  <SortHead k="campaign_name" label="Campaña" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                  <SortHead k="estado" label="Estado" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                  <SortHead k="created_at" label="Fecha" sort={scannerSort.sort} onToggle={scannerSort.toggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {scannerFiltered.slice(0, 500).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {[s.nombre, s.apellidos].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell className="text-sm">{s.telefono}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email || "—"}</TableCell>
                    <TableCell className="text-sm">{s.pais || "—"}</TableCell>
                    <TableCell className="text-sm">{s.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {scannerFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tags dialog */}
      <Dialog
        open={openDialog === "tags"}
        onOpenChange={(o) => {
          if (!o) {
            setOpenDialog(null);
            setSelectedTagId(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-indigo-600" />
              Estadísticas de etiquetas
            </DialogTitle>
          </DialogHeader>

          <FiltersBar
            showDate={false}
            selectValue={tagsTagId}
            onSelectValue={setTagsTagId}
            selectOptions={tagOpts}
            selectLabel="Etiqueta"
            onClear={() => setTagsTagId("__all__")}
          />

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conteo por etiqueta</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tagStatsForChart.slice(0, 12)} margin={{ left: 0, right: 8, top: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="nombre" angle={-25} textAnchor="end" interval={0} className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {tagStatsForChart.slice(0, 12).map((t, i) => (
                      <Cell key={t.id} fill={t.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar etiqueta..."
                  value={tagsSearch}
                  onChange={(e) => setTagsSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2">
                  {tags.length} etiquetas · {totalTagged} leads etiquetados
                </p>
                {tagStatsFiltered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTagId(t.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition hover:bg-muted/50 ${
                      selectedTagId === t.id ? "bg-muted border-primary" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="font-medium">{t.nombre}</span>
                    </span>
                    <Badge variant="secondary">{t.count}</Badge>
                  </button>
                ))}
                {tagStatsFiltered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin coincidencias.</p>
                )}
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
              {!selectedTag ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">
                  Selecciona una etiqueta para ver sus leads.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTag.leads.slice(0, 300).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nombre}</TableCell>
                        <TableCell className="text-sm">{l.telefono}</TableCell>
                      </TableRow>
                    ))}
                    {selectedTag.leads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                          Sin leads con esta etiqueta.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice dialog */}
      <Dialog open={openDialog === "voice"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-pink-600" />
              CRM Realty Web-AI ({voiceLeads.length})
            </DialogTitle>
          </DialogHeader>

          <FiltersBar
            showDate={false}
            selectValue={voiceStatus}
            onSelectValue={setVoiceStatus}
            selectOptions={voiceStatusOpts}
            selectLabel="Estado"
            onClear={() => setVoiceStatus("__all__")}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {["nuevo", "contactado", "reanion", "cierre"].map((st) => {
              const count = voiceBase.filter((v) => (v.status || "nuevo").toLowerCase() === st).length;
              return (
                <div key={st} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground capitalize">{st}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribución por estado</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={voiceByStatus}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={(e) => `${e.name}: ${e.value}`}
                  >
                    {voiceByStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono, interés, ubicación..."
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="nombre" label="Nombre" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                  <SortHead k="telefono" label="Teléfono" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                  <SortHead k="tipo_interes" label="Interés" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                  <SortHead k="ubicacion" label="Ubicación" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                  <SortHead k="presupuesto" label="Presupuesto" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                  <SortHead k="status" label="Estado" sort={voiceSort.sort} onToggle={voiceSort.toggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {voiceFiltered.map((v) => (
                  <TableRow key={v.row}>
                    <TableCell className="font-medium">{v.nombre}</TableCell>
                    <TableCell className="text-sm">{v.telefono}</TableCell>
                    <TableCell className="text-sm">{v.tipo_interes}</TableCell>
                    <TableCell className="text-sm">{v.ubicacion}</TableCell>
                    <TableCell className="text-sm">{v.presupuesto}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.status || "nuevo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {voiceFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI contacted dialog */}
      <Dialog open={openDialog === "ai"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BotMessageSquare className="h-5 w-5 text-teal-600" />
              Contactados por la IA ({aiContacts.length})
            </DialogTitle>
          </DialogHeader>

          <FiltersBar
            range={aiRange}
            onRange={setAiRange}
            selectValue={aiCampaign}
            onSelectValue={setAiCampaign}
            selectOptions={aiCampaignOpts}
            selectLabel="Campaña"
            onClear={() => {
              setAiRange(emptyRange);
              setAiCampaign("__all__");
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mensajes por campaña</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aiByCampaign} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" hide />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tendencia últimos 14 días</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiTrend} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono, país, campaña..."
              value={aiSearch}
              onChange={(e) => setAiSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="nombre" label="Nombre" sort={aiSort.sort} onToggle={aiSort.toggle} />
                  <SortHead k="telefono" label="Teléfono" sort={aiSort.sort} onToggle={aiSort.toggle} />
                  <SortHead k="pais" label="País" sort={aiSort.sort} onToggle={aiSort.toggle} />
                  <SortHead k="campaign_name" label="Campaña" sort={aiSort.sort} onToggle={aiSort.toggle} />
                  <SortHead k="count" label="Mensajes" sort={aiSort.sort} onToggle={aiSort.toggle} className="text-right" />
                  <SortHead k="last_at" label="Último envío" sort={aiSort.sort} onToggle={aiSort.toggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiFiltered.slice(0, 500).map((a) => (
                  <TableRow key={a.telefono}>
                    <TableCell className="font-medium">{a.nombre || "—"}</TableCell>
                    <TableCell className="text-sm">{a.telefono}</TableCell>
                    <TableCell className="text-sm">{a.pais || "—"}</TableCell>
                    <TableCell className="text-sm">{a.campaign_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.last_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {aiFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

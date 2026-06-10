import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquareText,
  Bot,
  Loader2,
  TrendingUp,
  UserCheck,
  Globe2,
  RefreshCw,
  Download,
  Inbox as InboxIcon,
  Megaphone,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { countryFlag } from "@/lib/countryFlag";
import { toast } from "sonner";
import NewStatsSection from "@/components/dashboard/NewStatsSection";

interface KPIs {
  totalMessages: number;
  botActive: number;
  leadsResponded: number;
  responseRate: number;
}

interface MessagesByDay {
  date: string;
  inbound: number;
  outbound: number;
}

interface CountryKPI {
  pais: string;
  total: number;
  recientes_7d: number;
  promedio_dias: number;
  pct: number;
  respondidos?: number;
  tasa_respuesta?: number;
}

interface LeadRow {
  id: string;
  nombre: string;
  telefono: string;
  pais: string | null;
  estado: string | null;
  ha_respondido: boolean | null;
  bot_activo: boolean | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([]);
  const [countries, setCountries] = useState<CountryKPI[]>([]);
  const [countriesTotal, setCountriesTotal] = useState(0);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryKPI | null>(null);
  const [contactedSet, setContactedSet] = useState<Set<string>>(new Set());
  const [inboundSet, setInboundSet] = useState<Set<string>>(new Set());
  const [contactFilter, setContactFilter] = useState<"all" | "contacted" | "uncontacted">("all");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  async function fetchData() {
    // Fetch messages in pages (Supabase default cap is 1000)
    async function fetchAllMessages() {
      const all: { direccion: string; created_at: string; telefono: string }[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("mensajes_whatsapp")
          .select("direccion, created_at, telefono")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < pageSize) break;
        if (from > 200000) break; // safety
      }
      return all;
    }

    const [leadsRes, messages, countryRes] = await Promise.all([
      supabase
        .from("leads_campana")
        .select("id, nombre, telefono, pais, estado, ha_respondido, bot_activo")
        .limit(10000),
      fetchAllMessages(),
      supabase.functions.invoke("sheets-country-kpis", { body: {} }),
    ]);

    const leadsData = (leadsRes.data ?? []) as LeadRow[];
    setLeads(leadsData);

    // Real respondents = distinct phones with at least one inbound message
    // Contacted = distinct phones with at least one outbound message
    const inboundPhones = new Set<string>();
    const outboundPhones = new Set<string>();
    messages.forEach((m) => {
      if (!m.telefono) return;
      const phone = String(m.telefono).split("@")[0];
      if (m.direccion === "inbound") inboundPhones.add(phone);
      else if (m.direccion === "outbound") outboundPhones.add(phone);
    });
    setInboundSet(inboundPhones);
    setContactedSet(outboundPhones);

    const leadsResponded = leadsData.filter((l) =>
      inboundPhones.has(String(l.telefono).split("@")[0]),
    ).length;
    const botActive = leadsData.filter((l) => l.bot_activo).length;
    const responseRate =
      leadsData.length > 0 ? (leadsResponded / leadsData.length) * 100 : 0;

    setKpis({
      totalMessages: messages.length,
      botActive,
      leadsResponded,
      responseRate,
    });

    // Messages by day (last 14 days)
    const dayMap: Record<string, { inbound: number; outbound: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().slice(0, 10)] = { inbound: 0, outbound: 0 };
    }
    messages.forEach((m) => {
      if (!m.created_at) return;
      const key = m.created_at.slice(0, 10);
      if (dayMap[key]) {
        if (m.direccion === "inbound") dayMap[key].inbound++;
        else dayMap[key].outbound++;
      }
    });
    setMessagesByDay(
      Object.entries(dayMap).map(([date, c]) => ({ date: date.slice(5), ...c })),
    );

    // Country KPIs: total leads + REAL responses per country (from messages)
    const respByCountry = new Map<string, { total: number; resp: number }>();
    leadsData.forEach((l) => {
      const key = (l.pais || "Sin país").trim() || "Sin país";
      const cur = respByCountry.get(key) || { total: 0, resp: 0 };
      cur.total += 1;
      if (inboundPhones.has(String(l.telefono).split("@")[0])) cur.resp += 1;
      respByCountry.set(key, cur);
    });

    const sheetsCountries: CountryKPI[] = countryRes.data?.success
      ? countryRes.data.countries || []
      : [];
    setCountriesTotal(countryRes.data?.total_contactos || 0);

    const merged: CountryKPI[] = sheetsCountries.length
      ? sheetsCountries.map((c) => {
          const r = respByCountry.get(c.pais);
          return {
            ...c,
            respondidos: r?.resp ?? 0,
            tasa_respuesta: r && r.total > 0 ? +((r.resp / r.total) * 100).toFixed(1) : 0,
          };
        })
      : Array.from(respByCountry.entries())
          .map(([pais, v]) => ({
            pais,
            total: v.total,
            recientes_7d: 0,
            promedio_dias: 0,
            pct: 0,
            respondidos: v.resp,
            tasa_respuesta: v.total > 0 ? +((v.resp / v.total) * 100).toFixed(1) : 0,
          }))
          .sort((a, b) => b.total - a.total);

    setCountries(merged);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchData();
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      toast.success("Datos actualizados");
    } catch (e: any) {
      toast.error("Error al actualizar", { description: e?.message });
    }
    setRefreshing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-id-contacto");
      if (error) throw error;
      toast.success("Sincronización completa", {
        description: `Actualizados: ${data?.actualizados ?? 0} · Sin match: ${data?.sin_match ?? 0}`,
      });
      await fetchData();
    } catch (e: any) {
      toast.error("Error al sincronizar", { description: e?.message });
    }
    setSyncing(false);
  };

  const handleExport = () => {
    const headers = ["pais", "total_contactos", "respondidos", "tasa_respuesta_%", "recientes_7d", "promedio_dias"];
    const rows = countries.map((c) =>
      [c.pais, c.total, c.respondidos ?? 0, c.tasa_respuesta ?? 0, c.recientes_7d, c.promedio_dias].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpis-paises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  const topCountries = useMemo(() => countries.slice(0, 10), [countries]);
  const topResponseCountries = useMemo(
    () =>
      [...countries]
        .filter((c) => (c.respondidos ?? 0) > 0)
        .sort((a, b) => (b.tasa_respuesta ?? 0) - (a.tasa_respuesta ?? 0))
        .slice(0, 10),
    [countries],
  );

  const allCountryLeads = useMemo(() => {
    if (!selectedCountry) return [];
    const target = selectedCountry.pais.toLowerCase();
    return leads.filter((l) => (l.pais || "").toLowerCase() === target);
  }, [selectedCountry, leads]);

  const countryStats = useMemo(() => {
    const contacted = allCountryLeads.filter((l) =>
      contactedSet.has(String(l.telefono).split("@")[0]),
    );
    const uncontacted = allCountryLeads.filter(
      (l) => !contactedSet.has(String(l.telefono).split("@")[0]),
    );
    return { contacted, uncontacted };
  }, [allCountryLeads, contactedSet]);

  const countryLeads = useMemo(() => {
    const base =
      contactFilter === "contacted"
        ? countryStats.contacted
        : contactFilter === "uncontacted"
          ? countryStats.uncontacted
          : allCountryLeads;
    return base.slice(0, 300);
  }, [contactFilter, countryStats, allCountryLeads]);

  const handleCreateRecoveryCampaign = async () => {
    if (!selectedCountry || countryStats.uncontacted.length === 0) return;
    setCreatingCampaign(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Debes iniciar sesión");
        setCreatingCampaign(false);
        return;
      }
      const phones = countryStats.uncontacted.map((l) => l.telefono);
      const { error } = await supabase.from("lead_recovery_campaigns").insert({
        user_id: userId,
        campaign_name: `Recuperación ${selectedCountry.pais} · ${new Date().toLocaleDateString()}`,
        channel: "whatsapp",
        status: "pendiente",
        target_filters: {
          pais: selectedCountry.pais,
          solo_no_contactados: true,
          telefonos: phones,
        },
        total_leads: phones.length,
        message_template_whatsapp:
          "Hola {{nombre}}, te contactamos desde Realtyplus. ¿Sigues interesado en propiedades en " +
          selectedCountry.pais +
          "?",
      });
      if (error) throw error;
      toast.success("Campaña creada", {
        description: `${phones.length} leads sin contactar listos para automatización`,
      });
      navigate("/campaigns");
    } catch (e: any) {
      toast.error("Error al crear campaña", { description: e?.message });
    }
    setCreatingCampaign(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Países (Sheets)",
      value: countries.length.toLocaleString(),
      icon: Globe2,
      accent: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950",
    },
    {
      title: "Contactos (Sheets)",
      value: countriesTotal.toLocaleString(),
      icon: Users,
      accent: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950",
    },
    {
      title: "Mensajes Totales",
      value: kpis!.totalMessages.toLocaleString(),
      icon: MessageSquareText,
      accent: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      title: "Bot Activo",
      value: kpis!.botActive.toLocaleString(),
      icon: Bot,
      accent: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    {
      title: "Leads Respondieron",
      value: kpis!.leadsResponded.toLocaleString(),
      icon: UserCheck,
      accent: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Tasa de Respuesta",
      value: `${kpis!.responseRate.toFixed(1)}%`,
      icon: TrendingUp,
      accent: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
  ];

  const countryChartConfig = {
    total: { label: "Contactos", color: "hsl(var(--primary))" },
  };
  const respChartConfig = {
    tasa_respuesta: { label: "Tasa de respuesta %", color: "hsl(142, 71%, 45%)" },
  };
  const lineChartConfig = {
    inbound: { label: "Entrantes", color: "hsl(var(--primary))" },
    outbound: { label: "Salientes", color: "hsl(142, 71%, 45%)" },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen general del CRM · Haz clic en un país para ver el detalle
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Sheets
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!countries.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/inbox")}>
            <InboxIcon className="mr-2 h-4 w-4" /> Inbox
          </Button>
          <Button size="sm" onClick={() => navigate("/campaigns")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Megaphone className="mr-2 h-4 w-4" /> Campañas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.accent}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <NewStatsSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Mensajes por día (últimos 14 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineChartConfig} className="h-[280px] w-full">
            <LineChart data={messagesByDay} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Entrantes" />
              <Line type="monotone" dataKey="outbound" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Salientes" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {countries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary" />
                Top 10 países por contactos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={countryChartConfig} className="h-[320px] w-full">
                <BarChart
                  data={topCountries}
                  layout="vertical"
                  margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                  onClick={(state: any) => {
                    const p = state?.activePayload?.[0]?.payload as CountryKPI | undefined;
                    if (p) setSelectedCountry(p);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} className="cursor-pointer">
                    {topCountries.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Tasa de respuesta por país (top 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topResponseCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Aún no hay leads con respuesta registrada.
                </p>
              ) : (
                <ChartContainer config={respChartConfig} className="h-[320px] w-full">
                  <BarChart
                    data={topResponseCountries}
                    layout="vertical"
                    margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                    onClick={(state: any) => {
                      const p = state?.activePayload?.[0]?.payload as CountryKPI | undefined;
                      if (p) setSelectedCountry(p);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="tasa_respuesta" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} className="cursor-pointer" />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {countries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Detalle por país ({countries.length}) · clic en una fila para segmentar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>País</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Respondieron</TableHead>
                    <TableHead className="text-right">Tasa resp.</TableHead>
                    <TableHead className="text-right">Últ. 7d</TableHead>
                    <TableHead className="text-right">Días prom.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countries.map((c) => (
                    <TableRow
                      key={c.pais}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCountry(c)}
                    >
                      <TableCell className="font-medium">
                        <span className="mr-2">{countryFlag(c.pais)}</span>
                        {c.pais}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{c.pct}%</TableCell>
                      <TableCell className="text-right tabular-nums">{(c.respondidos ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {(c.tasa_respuesta ?? 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.recientes_7d.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{c.promedio_dias}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedCountry} onOpenChange={(o) => !o && setSelectedCountry(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedCountry && countryFlag(selectedCountry.pais)}</span>
              {selectedCountry?.pais} · detalle
            </DialogTitle>
          </DialogHeader>
          {selectedCountry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Sheets</p>
                  <p className="text-xl font-bold">{selectedCountry.total.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">En BD</p>
                  <p className="text-xl font-bold">{allCountryLeads.length.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-xs text-muted-foreground">Contactados</p>
                  <p className="text-xl font-bold text-blue-600">
                    {countryStats.contacted.length.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-orange-50 dark:bg-orange-950/30">
                  <p className="text-xs text-muted-foreground">Sin contactar</p>
                  <p className="text-xl font-bold text-orange-600">
                    {countryStats.uncontacted.length.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Respondieron</p>
                  <p className="text-xl font-bold">{(selectedCountry.respondidos ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tasa resp.</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {(selectedCountry.tasa_respuesta ?? 0).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border p-1 bg-muted/30">
                  {([
                    { k: "all", label: `Todos (${allCountryLeads.length})` },
                    { k: "contacted", label: `Contactados (${countryStats.contacted.length})` },
                    { k: "uncontacted", label: `Sin contactar (${countryStats.uncontacted.length})` },
                  ] as const).map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setContactFilter(t.k)}
                      className={`px-3 py-1 text-xs rounded-md transition ${
                        contactFilter === t.k
                          ? "bg-background shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateRecoveryCampaign}
                  disabled={creatingCampaign || countryStats.uncontacted.length === 0}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Megaphone className="mr-2 h-4 w-4" />
                  {creatingCampaign
                    ? "Creando..."
                    : `Crear campaña (${countryStats.uncontacted.length} sin contactar)`}
                </Button>
              </div>

              <div className="max-h-[340px] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Contactado</TableHead>
                      <TableHead>Respondió</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countryLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                          No hay leads para mostrar con este filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      countryLeads.map((l) => {
                        const phone = String(l.telefono).split("@")[0];
                        const wasContacted = contactedSet.has(phone);
                        const didRespond = inboundSet.has(phone);
                        return (
                          <TableRow
                            key={l.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedCountry(null);
                              navigate(`/inbox?phone=${encodeURIComponent(l.telefono)}`);
                            }}
                          >
                            <TableCell className="font-medium">{l.nombre}</TableCell>
                            <TableCell className="text-sm">{l.telefono}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{l.estado || "—"}</TableCell>
                            <TableCell>
                              {wasContacted ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  Sí
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                  No
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{didRespond ? "✅" : "—"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

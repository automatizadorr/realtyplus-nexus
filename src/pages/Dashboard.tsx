import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, animate, useReducedMotion } from "framer-motion";
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
import { EditablePhoneCell } from "@/components/EditablePhoneCell";


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

// Número que cuenta hacia arriba al montar (respeta prefers-reduced-motion).
function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <>
      {display.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

// Variantes de entrada escalonada para las tarjetas KPI.
const kpiGrid = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const kpiItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

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

  const kpiCards: {
    title: string;
    value: number;
    decimals?: number;
    suffix?: string;
    icon: React.ElementType;
    iconWrap: string;
    bar: string;
  }[] = [
    {
      title: "Países\u00a0",
      value: countries.length,
      icon: Globe2,
      iconWrap: "from-cyan-500/20 to-cyan-500/5 text-cyan-600 ring-cyan-500/25",
      bar: "from-cyan-400 to-cyan-600",
    },
    {
      title: "Contactos\u00a0",
      value: countriesTotal,
      icon: Users,
      iconWrap: "from-rose-500/20 to-rose-500/5 text-rose-600 ring-rose-500/25",
      bar: "from-rose-400 to-rose-600",
    },
    {
      title: "Mensajes Totales",
      value: kpis!.totalMessages,
      icon: MessageSquareText,
      iconWrap: "from-violet-500/20 to-violet-500/5 text-violet-600 ring-violet-500/25",
      bar: "from-violet-400 to-violet-600",
    },
    {
      title: "Bot Activo",
      value: kpis!.botActive,
      icon: Bot,
      iconWrap: "from-amber-500/20 to-amber-500/5 text-amber-600 ring-amber-500/25",
      bar: "from-amber-400 to-amber-600",
    },
    {
      title: "Leads Respondieron",
      value: kpis!.leadsResponded,
      icon: UserCheck,
      iconWrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/25",
      bar: "from-blue-400 to-blue-600",
    },
    {
      title: "Tasa de Respuesta",
      value: kpis!.responseRate,
      decimals: 1,
      suffix: "%",
      icon: TrendingUp,
      iconWrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/25",
      bar: "from-emerald-400 to-emerald-600",
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
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
            Panorama del CRM
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen general · haz clic en un país para ver el detalle
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

      <motion.div
        variants={kpiGrid}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {kpiCards.map((card) => (
          <motion.div key={card.title} variants={kpiItem}>
            <Card className="relative overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.bar}`} aria-hidden="true" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {card.title.trim()}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
                      <AnimatedNumber value={card.value} decimals={card.decimals ?? 0} suffix={card.suffix ?? ""} />
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-xl bg-gradient-to-br p-2.5 ring-1 ${card.iconWrap}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <NewStatsSection />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="border-border/60 transition-shadow hover:shadow-md">
          <CardHeader className="pb-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Actividad</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
                <MessageSquareText className="h-4 w-4" />
              </span>
              Mensajes por día
              <span className="ml-auto text-xs font-normal text-muted-foreground">últimos 14 días</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineChartConfig} className="h-[280px] w-full">
              <LineChart data={messagesByDay} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Entrantes" />
                <Line type="monotone" dataKey="outbound" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Salientes" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {countries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <Card className="border-border/60 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Volumen</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
                  <Globe2 className="h-4 w-4" />
                </span>
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
                  <defs>
                    <linearGradient id="barPrimary" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="url(#barPrimary)" className="cursor-pointer" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-border/60 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Efectividad</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-1 ring-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </span>
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
                    <defs>
                      <linearGradient id="barEmerald" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="tasa_respuesta" fill="url(#barEmerald)" radius={[0, 4, 4, 0]} className="cursor-pointer" />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {countries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Detalle</p>
              <CardTitle className="mt-1 text-base font-semibold">
                Detalle por país <span className="font-normal text-muted-foreground">({countries.length})</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">· clic en una fila para segmentar</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[440px] overflow-y-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 [&_th]:h-9 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>País</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Participación</TableHead>
                      <TableHead className="text-right">Respondieron</TableHead>
                      <TableHead>Tasa resp.</TableHead>
                      <TableHead className="text-right">Últ. 7d</TableHead>
                      <TableHead className="text-right">Días prom.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countries.map((c) => (
                      <TableRow
                        key={c.pais}
                        className="cursor-pointer even:bg-muted/20 hover:bg-primary/5"
                        onClick={() => setSelectedCountry(c)}
                      >
                        <TableCell className="font-medium">
                          <span className="mr-2">{countryFlag(c.pais)}</span>
                          {c.pais}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{c.total.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-full min-w-[36px] max-w-[90px] overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{(c.respondidos ?? 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-full min-w-[36px] max-w-[90px] overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(c.tasa_respuesta ?? 0, 100)}%` }} />
                            </div>
                            <span className="w-11 text-right text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {(c.tasa_respuesta ?? 0).toFixed(1)}%
                            </span>
                          </div>
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
        </motion.div>
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
                            <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                              <EditablePhoneCell phone={l.telefono} onUpdated={fetchData} />
                            </TableCell>
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



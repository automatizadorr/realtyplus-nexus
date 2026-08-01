import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatedNumber, kpiGrid, kpiItem } from "@/components/AnimatedNumber";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquareText,
  Bot,
  Loader2,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Download,
  Inbox as InboxIcon,
  Megaphone,
  Database,
  Clock,
  Flame,
  ArrowRight,
  Reply,
} from "lucide-react";
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
import { FxPanel, StatTile } from "@/components/dashboard/fx";
import { HotLeadDialog, type HotLead } from "@/components/dashboard/HotLeadDialog";
import { tickFase } from "@/lib/acuse";
import { EditablePhoneCell } from "@/components/EditablePhoneCell";

const NewStatsSection = lazy(() => import("@/components/dashboard/NewStatsSection"));
const DashboardCharts = lazy(() => import("@/components/dashboard/DashboardCharts"));
const CountryDetailTable = lazy(() => import("@/components/dashboard/CountryDetailTable"));

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}


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
  const [rawMessages, setRawMessages] = useState<
    { direccion: string; created_at: string; telefono: string; estado_envio?: string | null }[]
  >([]);
  const [hotLead, setHotLead] = useState<HotLead | null>(null);

  async function fetchEssential() {
    const last90d = new Date();
    last90d.setDate(last90d.getDate() - 90);
    const since = last90d.toISOString();

    const [leadsRes, messagesRes, countRes] = await Promise.all([
      supabase
        .from("leads_campana")
        .select("id, nombre, telefono, pais, estado, ha_respondido, bot_activo")
        .limit(10000),
      supabase
        .from("mensajes_whatsapp")
        .select("direccion, created_at, telefono, estado_envio")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("mensajes_whatsapp")
        .select("*", { count: "exact", head: true }),
    ]);

    const messages = (messagesRes.data ?? []) as {
      direccion: string; created_at: string; telefono: string; estado_envio?: string | null;
    }[];

    const leadsData = (leadsRes.data ?? []) as LeadRow[];
    setLeads(leadsData);

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
    setRawMessages(messages);

    const leadsResponded = leadsData.filter((l) =>
      inboundPhones.has(String(l.telefono).split("@")[0]),
    ).length;
    const botActive = leadsData.filter((l) => l.bot_activo).length;
    const responseRate =
      leadsData.length > 0 ? (leadsResponded / leadsData.length) * 100 : 0;

    setKpis({
      totalMessages: countRes.count ?? 0,
      botActive,
      leadsResponded,
      responseRate,
    });

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

    const respByCountry = new Map<string, { total: number; resp: number }>();
    leadsData.forEach((l) => {
      const key = (l.pais || "Sin país").trim() || "Sin país";
      const cur = respByCountry.get(key) || { total: 0, resp: 0 };
      cur.total += 1;
      if (inboundPhones.has(String(l.telefono).split("@")[0])) cur.resp += 1;
      respByCountry.set(key, cur);
    });

    return { leadsData, respByCountry };
  }

  async function fetchCountryData(
    respByCountry: Map<string, { total: number; resp: number }>,
  ) {
    const countryRes = await supabase.functions.invoke("sheets-country-kpis", { body: {} });

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

  async function fetchData() {
    const { respByCountry } = await fetchEssential();
    await fetchCountryData(respByCountry);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { respByCountry } = await fetchEssential();
        setLoading(false);
        fetchCountryData(respByCountry).catch(console.error);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
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

  // Leads calientes: respondieron y la pelota está en nuestro lado (su último
  // mensaje ≥ el nuestro) y no falló el envío. El corazón del command center.
  const hot = useMemo(() => {
    const digits = (t: string) => String(t || "").split("@")[0].replace(/\D/g, "");
    const byPhone = new Map<string, { lastIn: number; lastOut: number; failed: boolean }>();
    for (const m of rawMessages) {
      const p = digits(m.telefono);
      if (!p) continue;
      const t = m.created_at ? Date.parse(m.created_at) : 0;
      const e = byPhone.get(p) || { lastIn: 0, lastOut: 0, failed: false };
      if (m.direccion === "inbound") e.lastIn = Math.max(e.lastIn, t);
      else {
        e.lastOut = Math.max(e.lastOut, t);
        if (tickFase(m.estado_envio) === "fallido") e.failed = true;
      }
      byPhone.set(p, e);
    }
    const leadByPhone = new Map(leads.map((l) => [digits(l.telefono), l]));
    const list: { telefono: string; nombre: string; pais: string | null; at: number }[] = [];
    for (const [p, e] of byPhone) {
      if (e.lastIn > 0 && e.lastIn >= e.lastOut && !e.failed) {
        const lead = leadByPhone.get(p);
        list.push({ telefono: lead?.telefono || p, nombre: lead?.nombre || "Sin nombre", pais: lead?.pais ?? null, at: e.lastIn });
      }
    }
    list.sort((a, b) => b.at - a.at);
    return { count: list.length, list: list.slice(0, 8) };
  }, [rawMessages, leads]);

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
    <div className="p-4 space-y-4">
      {/* ── Centro de mando (panel claro futurista) ──────────────────────── */}
      <FxPanel className="p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-sky-600">
                Centro de mando · NexusPlus-AI
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Actualizar", icon: RefreshCw, onClick: handleRefresh, disabled: refreshing, spin: refreshing },
              { label: "Sincronizar", icon: RefreshCw, onClick: handleSync, disabled: syncing, spin: syncing },
              { label: "Exportar", icon: Download, onClick: handleExport, disabled: !countries.length },
              { label: "Inbox", icon: InboxIcon, onClick: () => navigate("/inbox") },
            ].map((b) => (
              <Button key={b.label} variant="outline" size="sm" onClick={b.onClick} disabled={b.disabled} className="bg-white/70 backdrop-blur">
                <b.icon className={`mr-2 h-4 w-4 ${b.spin ? "animate-spin" : ""}`} />
                {b.label}
              </Button>
            ))}
            <Button size="sm" onClick={() => navigate("/campaigns")} className="bg-[#DC1C2E] text-white hover:bg-[#DC1C2E]/90 shadow-[0_8px_20px_-8px_rgba(220,28,46,0.6)]">
              <Megaphone className="mr-2 h-4 w-4" /> Campañas
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { title: "Contactos", value: countriesTotal, icon: Users, from: "#38bdf8", to: "#0ea5e9", glow: "56,189,248", explain: "Total de contactos cargados desde Google Sheets. Es tu universo de leads disponibles para lanzar campañas de reactivación." },
            { title: "Mensajes", value: kpis!.totalMessages, icon: MessageSquareText, from: "#a78bfa", to: "#8b5cf6", glow: "167,139,250", explain: "Total de mensajes de WhatsApp intercambiados (entrantes + salientes) en el canal de reactivación. Mide el volumen de actividad." },
            { title: "Respondieron", value: kpis!.leadsResponded, icon: Reply, from: "#22d3ee", to: "#06b6d4", glow: "34,211,238", explain: "Leads que respondieron al menos un mensaje. Refleja interés real y la calidad de la base contactada." },
            { title: "Tasa de respuesta", value: kpis!.responseRate, decimals: 1, suffix: "%", gauge: true, icon: TrendingUp, from: "#34d399", to: "#10b981", glow: "52,211,153", explain: "Porcentaje de leads que respondieron sobre el total. Es el termómetro de efectividad de tu mensajería: si sube, tu copy y segmentación funcionan." },
            { title: "Leads calientes", value: hot.count, icon: Flame, from: "#fb923c", to: "#f97316", glow: "251,146,60", explain: "Leads que respondieron y esperan tu réplica (la pelota está en tu lado, sin fallo de envío). Atiéndelos primero: son los más propensos a cerrar. Los ves listados abajo." },
          ].map((t, i) => (
            <StatTile key={t.title} index={i} {...t} />
          ))}
        </div>

        {/* Acción inmediata: leads calientes por atender */}
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/60 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Acción inmediata</p>
              <h3 className="text-sm font-semibold text-slate-900">
                Leads calientes por atender <span className="text-emerald-600">({hot.count})</span>
              </h3>
            </div>
          </div>
          {hot.list.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nada pendiente ahora mismo. Todos los que respondieron ya recibieron réplica. 🎯</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {hot.list.map((l) => (
                <button
                  key={l.telefono}
                  onClick={() => setHotLead({ telefono: l.telefono, nombre: l.nombre, pais: l.pais })}
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 8px #22c55e88" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {l.pais ? `${countryFlag(l.pais)} ` : ""}{l.nombre}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{l.telefono} · respondió {timeAgo(l.at)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      </FxPanel>

      <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}>
        <NewStatsSection />
      </Suspense>

      <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}>
        <DashboardCharts
          messagesByDay={messagesByDay}
          topCountries={topCountries}
          topResponseCountries={topResponseCountries}
          countries={countries}
          lineChartConfig={lineChartConfig}
          countryChartConfig={countryChartConfig}
          respChartConfig={respChartConfig}
          onSelectCountry={setSelectedCountry}
        />
      </Suspense>

      <Suspense fallback={null}>
        <CountryDetailTable countries={countries} onSelectCountry={setSelectedCountry} />
      </Suspense>

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
              <motion.div
                variants={kpiGrid}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                {[
                  { label: "Total Sheets", value: selectedCountry.total.toLocaleString(), icon: Users, wrap: "from-slate-500/20 to-slate-500/5 text-slate-600 ring-slate-500/20", vc: "text-foreground" },
                  { label: "En BD", value: allCountryLeads.length.toLocaleString(), icon: Database, wrap: "from-violet-500/20 to-violet-500/5 text-violet-600 ring-violet-500/20", vc: "text-foreground" },
                  { label: "Contactados", value: countryStats.contacted.length.toLocaleString(), icon: MessageSquareText, wrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/20", vc: "text-blue-600" },
                  { label: "Sin contactar", value: countryStats.uncontacted.length.toLocaleString(), icon: Clock, wrap: "from-orange-500/20 to-orange-500/5 text-orange-600 ring-orange-500/20", vc: "text-orange-600" },
                  { label: "Respondieron", value: (selectedCountry.respondidos ?? 0).toLocaleString(), icon: UserCheck, wrap: "from-indigo-500/20 to-indigo-500/5 text-indigo-600 ring-indigo-500/20", vc: "text-foreground" },
                  { label: "Tasa resp.", value: `${(selectedCountry.tasa_respuesta ?? 0).toFixed(1)}%`, icon: TrendingUp, wrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/20", vc: "text-emerald-600" },
                ].map((s) => (
                  <motion.div
                    key={s.label}
                    variants={kpiItem}
                    className="rounded-xl border border-border/60 p-3 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${s.wrap}`}>
                        <s.icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {s.label}
                      </p>
                    </div>
                    <p className={`mt-2 text-xl font-bold tabular-nums ${s.vc}`}>{s.value}</p>
                  </motion.div>
                ))}
              </motion.div>

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

      <HotLeadDialog
        lead={hotLead}
        onOpenChange={(o) => !o && setHotLead(null)}
        onGoToLead={(tel) => {
          setHotLead(null);
          navigate(`/inbox?phone=${encodeURIComponent(tel)}`);
        }}
      />
    </div>
  );
}



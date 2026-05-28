import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Megaphone, MessageSquareText, Bot, Loader2, TrendingUp, UserCheck, Globe2 } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryFlag } from "@/lib/countryFlag";

  totalLeads: number;
  activeCampaigns: number;
  responseRate: number;
  totalMessages: number;
  botActive: number;
  leadsResponded: number;
}

interface MessagesByDay {
  date: string;
  inbound: number;
  outbound: number;
}

interface LeadsByState {
  name: string;
  value: number;
}

const STATE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
];

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([]);
  const [leadsByState, setLeadsByState] = useState<LeadsByState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [leadsRes, campaignsRes, messagesRes] = await Promise.all([
        supabase.from("leads_campana").select("id, ha_respondido, bot_activo, estado"),
        supabase.from("lead_recovery_campaigns").select("id, status"),
        supabase.from("mensajes_whatsapp").select("id, direccion, created_at"),
      ]);

      const leads = leadsRes.data ?? [];
      const campaigns = campaignsRes.data ?? [];
      const messages = messagesRes.data ?? [];

      // KPIs
      const totalLeads = leads.length;
      const leadsResponded = leads.filter((l) => l.ha_respondido).length;
      const responseRate = totalLeads > 0 ? (leadsResponded / totalLeads) * 100 : 0;
      const activeCampaigns = campaigns.filter((c) => c.status === "executing").length;
      const botActive = leads.filter((l) => l.bot_activo).length;

      setKpis({
        totalLeads,
        activeCampaigns,
        responseRate,
        totalMessages: messages.length,
        botActive,
        leadsResponded,
      });

      // Messages by day (last 14 days)
      const dayMap: Record<string, { inbound: number; outbound: number }> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = { inbound: 0, outbound: 0 };
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
        Object.entries(dayMap).map(([date, counts]) => ({
          date: date.slice(5), // MM-DD
          ...counts,
        }))
      );

      // Leads by state
      const stateMap: Record<string, number> = {};
      leads.forEach((l) => {
        const estado = l.estado || "sin estado";
        stateMap[estado] = (stateMap[estado] || 0) + 1;
      });
      setLeadsByState(
        Object.entries(stateMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      );

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpiCards = [
    { title: "Total Leads", value: kpis!.totalLeads.toLocaleString(), icon: Users, accent: "text-primary", bg: "bg-primary/10" },
    { title: "Campañas Activas", value: kpis!.activeCampaigns.toString(), icon: Megaphone, accent: "text-accent", bg: "bg-accent/10" },
    { title: "Tasa de Respuesta", value: `${kpis!.responseRate.toFixed(1)}%`, icon: TrendingUp, accent: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
    { title: "Leads Respondieron", value: kpis!.leadsResponded.toLocaleString(), icon: UserCheck, accent: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
    { title: "Mensajes Totales", value: kpis!.totalMessages.toLocaleString(), icon: MessageSquareText, accent: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
    { title: "Bot Activo", value: kpis!.botActive.toLocaleString(), icon: Bot, accent: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
  ];

  const lineChartConfig = {
    inbound: { label: "Entrantes", color: "hsl(var(--primary))" },
    outbound: { label: "Salientes", color: "hsl(142, 71%, 45%)" },
  };

  const pieChartConfig = leadsByState.reduce((acc, item, i) => {
    acc[item.name] = { label: item.name, color: STATE_COLORS[i % STATE_COLORS.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del CRM</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Line Chart - Messages per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Mensajes por día (últimos 14 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineChartConfig} className="h-[300px] w-full">
              <LineChart data={messagesByDay} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Entrantes" />
                <Line type="monotone" dataKey="outbound" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Salientes" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Leads by state */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Leads por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieChartConfig} className="h-[300px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={leadsByState}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {leadsByState.map((_, i) => (
                    <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Megaphone, MessageSquareText, Bot, Loader2, TrendingUp, UserCheck } from "lucide-react";

interface KPIs {
  totalLeads: number;
  activeCampaigns: number;
  responseRate: number;
  totalMessages: number;
  botActive: number;
  leadsResponded: number;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      setLoading(true);

      const [leadsRes, campaignsRes, messagesRes] = await Promise.all([
        supabase.from("leads_campana").select("id, ha_respondido, bot_activo"),
        supabase.from("lead_recovery_campaigns").select("id, status"),
        supabase.from("mensajes_whatsapp").select("id, direccion"),
      ]);

      const leads = leadsRes.data ?? [];
      const campaigns = campaignsRes.data ?? [];
      const messages = messagesRes.data ?? [];

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
      setLoading(false);
    }

    fetchKPIs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    {
      title: "Total Leads",
      value: kpis!.totalLeads.toLocaleString(),
      icon: Users,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Campañas Activas",
      value: kpis!.activeCampaigns.toString(),
      icon: Megaphone,
      accent: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "Tasa de Respuesta",
      value: `${kpis!.responseRate.toFixed(1)}%`,
      icon: TrendingUp,
      accent: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Leads Respondieron",
      value: kpis!.leadsResponded.toLocaleString(),
      icon: UserCheck,
      accent: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Mensajes Totales",
      value: kpis!.totalMessages.toLocaleString(),
      icon: MessageSquareText,
      accent: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "Bot Activo",
      value: kpis!.botActive.toLocaleString(),
      icon: Bot,
      accent: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
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
    </div>
  );
}

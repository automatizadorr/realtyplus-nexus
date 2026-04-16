import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import CreateCampaignDialog from "@/components/campaigns/CreateCampaignDialog";

interface Campaign {
  id: string;
  campaign_name: string;
  status: string | null;
  channel: string | null;
  total_leads: number | null;
  contacted_whatsapp: number | null;
  contacted_email: number | null;
  responded: number | null;
  converted: number | null;
  created_at: string | null;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_recovery_campaigns")
      .select("id, campaign_name, status, channel, total_leads, contacted_whatsapp, contacted_email, responded, converted, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const statusColor = (estado: string | null) => {
    switch (estado?.toLowerCase()) {
      case "executing": return "default";
      case "completed": return "secondary";
      case "paused": return "outline";
      default: return "secondary";
    }
  };

  const channelLabel = (ch: string | null) => {
    switch (ch) {
      case "whatsapp": return "WhatsApp";
      case "email": return "Email";
      case "whatsapp_email": return "WhatsApp + Email";
      default: return ch || "—";
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-accent" />
          <h2 className="text-2xl font-bold text-foreground">Campañas</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" /> Nueva Campaña
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Campañas</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !loading ? (
            <p className="text-muted-foreground text-center py-8">No hay campañas registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Contactados</TableHead>
                  <TableHead className="text-right">Respondidos</TableHead>
                  <TableHead className="text-right">Convertidos</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.campaign_name}</TableCell>
                    <TableCell className="text-sm">{channelLabel(c.channel)}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(c.status)}>{c.status || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.total_leads ?? 0}</TableCell>
                    <TableCell className="text-right">{(c.contacted_whatsapp ?? 0) + (c.contacted_email ?? 0)}</TableCell>
                    <TableCell className="text-right">{c.responded ?? 0}</TableCell>
                    <TableCell className="text-right font-semibold">{c.converted ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("es-ES") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateCampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchCampaigns} />
    </div>
  );
}

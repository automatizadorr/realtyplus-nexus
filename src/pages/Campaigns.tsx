import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, RefreshCw, Plus, Users, Send, CheckCircle2, TrendingUp, Activity, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CreateCampaignDialog from "@/components/campaigns/CreateCampaignDialog";
import CampaignDetailsDialog, { CampaignRow } from "@/components/campaigns/CampaignDetailsDialog";
import EditCampaignDialog from "@/components/campaigns/EditCampaignDialog";

export default function Campaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CampaignRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CampaignRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_recovery_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setCampaigns(data as CampaignRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const kpis = useMemo(() => {
    const total = campaigns.length;
    const executing = campaigns.filter(c => c.status?.toLowerCase() === "executing").length;
    const totalLeads = campaigns.reduce((s, c) => s + (c.total_leads ?? 0), 0);
    const contacted = campaigns.reduce((s, c) => s + (c.contacted_whatsapp ?? 0) + (c.contacted_email ?? 0), 0);
    const responded = campaigns.reduce((s, c) => s + (c.responded ?? 0), 0);
    const converted = campaigns.reduce((s, c) => s + (c.converted ?? 0), 0);
    const responseRate = totalLeads > 0 ? ((responded / totalLeads) * 100).toFixed(1) : "0";
    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : "0";
    return { total, executing, totalLeads, contacted, responded, converted, responseRate, conversionRate };
  }, [campaigns]);

  const kpiCards = [
    { label: "Campaña de Nuevas Oportunidades", value: kpis.total, sub: `${kpis.executing} activas`, icon: Megaphone, color: "text-primary" },
    { label: "Leads totales", value: kpis.totalLeads, sub: "en campañas", icon: Users, color: "text-blue-600" },
    { label: "Contactados", value: kpis.contacted, sub: "WhatsApp + Email", icon: Send, color: "text-indigo-600" },
    { label: "Respondieron", value: kpis.responded, sub: `${kpis.responseRate}% tasa`, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Convertidos", value: kpis.converted, sub: `${kpis.conversionRate}% tasa`, icon: TrendingUp, color: "text-accent" },
    { label: "Ejecutando", value: kpis.executing, sub: "en curso", icon: Activity, color: "text-amber-600" },
  ];

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

  const openDetails = (c: CampaignRow) => {
    setSelected(c);
    setDetailsOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-accent" />
          <h2 className="text-2xl font-bold text-foreground">Campaña de Nuevas Oportunidades</h2>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => (
          <Card key={k.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de Campaña de Nuevas Oportunidades · clic para ver detalle y ejecutar</CardTitle>
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
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetails(c)}>
                    <TableCell className="font-medium">{c.campaign_name}</TableCell>
                    <TableCell className="text-sm">{channelLabel(c.channel)}</TableCell>
                    <TableCell><Badge variant={statusColor(c.status)}>{c.status || "—"}</Badge></TableCell>
                    <TableCell className="text-right">{c.total_leads ?? 0}</TableCell>
                    <TableCell className="text-right">{(c.contacted_whatsapp ?? 0) + (c.contacted_email ?? 0)}</TableCell>
                    <TableCell className="text-right">{c.responded ?? 0}</TableCell>
                    <TableCell className="text-right font-semibold">{c.converted ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("es-ES") : "—"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openDetails(c)}>
                          <Send className="mr-1 h-3 w-3" /> Ejecutar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(c)} title="Editar">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateCampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchCampaigns} />
      <CampaignDetailsDialog
        campaign={selected}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onExecuted={fetchCampaigns}
      />
      <EditCampaignDialog
        campaign={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        onSaved={fetchCampaigns}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente "{deleteTarget?.campaign_name}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                setDeleting(true);
                const { error } = await supabase
                  .from("lead_recovery_campaigns")
                  .delete()
                  .eq("id", deleteTarget.id);
                setDeleting(false);
                if (error) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  return;
                }
                toast({ title: "Campaña eliminada" });
                setDeleteTarget(null);
                fetchCampaigns();
              }}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

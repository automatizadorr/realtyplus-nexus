import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedNumber, kpiGrid, kpiItem } from "@/components/AnimatedNumber";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, RefreshCw, Plus, Users, Send, CheckCircle2, TrendingUp, Activity, Pencil, Trash2, Zap } from "lucide-react";
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
  const [n8nConfirmOpen, setN8nConfirmOpen] = useState(false);
  const [n8nFiring, setN8nFiring] = useState(false);

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
    { label: "Campañas IA", value: kpis.total, sub: `${kpis.executing} activas`, icon: Megaphone, iconWrap: "from-primary/20 to-primary/5 text-primary ring-primary/25", bar: "from-primary/70 to-primary" },
    { label: "Leads totales", value: kpis.totalLeads, sub: "en campañas", icon: Users, iconWrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/25", bar: "from-blue-400 to-blue-600" },
    { label: "Contactados", value: kpis.contacted, sub: "WhatsApp + Email", icon: Send, iconWrap: "from-indigo-500/20 to-indigo-500/5 text-indigo-600 ring-indigo-500/25", bar: "from-indigo-400 to-indigo-600" },
    { label: "Respondieron", value: kpis.responded, sub: `${kpis.responseRate}% tasa`, icon: CheckCircle2, iconWrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/25", bar: "from-emerald-400 to-emerald-600" },
    { label: "Convertidos", value: kpis.converted, sub: `${kpis.conversionRate}% tasa`, icon: TrendingUp, iconWrap: "from-accent/20 to-accent/5 text-accent ring-accent/25", bar: "from-accent/70 to-accent" },
    { label: "Ejecutando", value: kpis.executing, sub: "en curso", icon: Activity, iconWrap: "from-amber-500/20 to-amber-500/5 text-amber-600 ring-amber-500/25", bar: "from-amber-400 to-amber-600" },
  ];

  const statusMeta = (estado: string | null): { label: string; cls: string; pulse?: boolean } => {
    switch (estado?.toLowerCase()) {
      case "executing": return { label: "Ejecutando", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30", pulse: true };
      case "completed": return { label: "Completada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30" };
      case "paused": return { label: "Pausada", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30" };
      case "pendiente": return { label: "Pendiente", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30" };
      default: return { label: estado || "—", cls: "bg-muted text-muted-foreground ring-border" };
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">Automatización</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Megaphone className="h-6 w-6 text-accent" />
            Campañas IA
          </h1>
          <p className="text-sm text-muted-foreground">Reactivación y expansión de leads por WhatsApp e IA</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setN8nConfirmOpen(true)}
          >
            <Zap className="mr-2 h-4 w-4" /> Re-Activar vía Whatsapp Meta AI
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" /> Nueva Campaña
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <motion.div
        variants={kpiGrid}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {kpiCards.map((k) => (
          <motion.div key={k.label} variants={kpiItem}>
            <Card className="relative h-full overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${k.bar}`} aria-hidden="true" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${k.iconWrap}`}>
                    <k.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
                  <AnimatedNumber value={k.value} />
                </p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Historial</p>
          <CardTitle className="mt-1 text-base font-semibold">
            Campañas IA <span className="font-normal text-muted-foreground">({campaigns.length})</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">· clic en una fila para ver detalle y ejecutar</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 ring-1 ring-accent/20">
                <Megaphone className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">No hay campañas registradas.</p>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" /> Crear la primera
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader className="bg-muted/50 [&_th]:h-9 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide">
                  <TableRow className="hover:bg-transparent">
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
                  {campaigns.map((c) => {
                    const st = statusMeta(c.status);
                    return (
                      <TableRow key={c.id} className="cursor-pointer even:bg-muted/20 hover:bg-primary/5" onClick={() => openDetails(c)}>
                        <TableCell className="font-medium">{c.campaign_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{channelLabel(c.channel)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${st.cls}`}>
                            {st.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.total_leads ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{(c.contacted_whatsapp ?? 0) + (c.contacted_email ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.responded ?? 0}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{c.converted ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("es-ES") : "—"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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

      <AlertDialog open={n8nConfirmOpen} onOpenChange={(v) => !v && setN8nConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar disparo de webhook n8n</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta acción ejecuta un flujo automatizado que consume la API oficial de Meta (WhatsApp Business / Cloud API).</p>
              <p><strong>Gastos asociados:</strong></p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Cada mensaje de WhatsApp enviado se cobra según la tarifa de Meta por país y tipo de conversación.</li>
                <li>Las conversaciones iniciadas por la empresa (utility, marketing, authentication) tienen costos variables por región.</li>
                <li>El procesamiento de IA (n8n / OpenAI) puede generar cargos adicionales por tokens utilizados.</li>
                <li>No se generan cargos desde esta plataforma; los costos son directamente con Meta y los proveedores de IA conectados.</li>
              </ul>
              <p className="text-sm text-muted-foreground">Asegúrate de tener saldo suficiente en tu cuenta de Meta Business y revisa los límites de tu plan antes de continuar.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={n8nFiring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={n8nFiring}
              onClick={async (e) => {
                e.preventDefault();
                setN8nFiring(true);
                try {
                  await fetch("https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/4b7dff80-2d0e-42f9-8eae-1adbcaa07eff", {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "campaigns", triggeredAt: new Date().toISOString() }),
                  });
                  toast({ title: "Webhook enviado", description: "Disparador enviado a n8n correctamente." });
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message ?? "No se pudo enviar el webhook", variant: "destructive" });
                } finally {
                  setN8nFiring(false);
                  setN8nConfirmOpen(false);
                }
              }}
            >
              {n8nFiring ? "Enviando..." : "Confirmar y disparar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

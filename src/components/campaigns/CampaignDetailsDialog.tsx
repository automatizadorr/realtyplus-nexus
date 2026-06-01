import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Send, Calendar, Users, MessageCircle, Mail, CheckCircle2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CampaignExecuteWarning from "./CampaignExecuteWarning";



export interface CampaignRow {
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
  message_template_whatsapp?: string | null;
  message_template_email?: string | null;
  subject_email?: string | null;
  target_filters?: any;
}

interface Props {
  campaign: CampaignRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onExecuted?: () => void;
}

export default function CampaignDetailsDialog({ campaign, open, onOpenChange, onExecuted }: Props) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);

  if (!campaign) return null;

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const tf = campaign.target_filters || {};
      const pais: string | null = tf?.pais || null;
      const telefonos: string[] = Array.isArray(tf?.telefonos) ? tf.telefonos : [];
      const soloNoContactados = !!tf?.solo_no_contactados;

      // Traer datos completos de la hoja (sin filtrar por teléfono — solo por país)
      let sheetLeads: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("sheets-leads", {
          body: { pais, solo_no_contactados: soloNoContactados, telefonos },
        });
        if (error) throw error;
        if (data?.success) sheetLeads = data.leads || [];
      } catch (e) {
        console.warn("No se pudo obtener leads del sheet:", e);
      }

      // Mapa sheets por teléfono normalizado
      const normPhone = (p: string) => (p || "").replace(/\D/g, "");
      const sheetByPhone = new Map<string, any>();
      for (const l of sheetLeads) {
        const ph = normPhone(l.telefono || "");
        if (ph && !sheetByPhone.has(ph)) sheetByPhone.set(ph, l);
      }

      // Construir leads completos: TODOS los teléfonos del target, enriquecidos con sheets
      const allLeads = telefonos.map((tel) => {
        const ph = normPhone(tel);
        const sl = sheetByPhone.get(ph) || null;
        return {
          id_contacto: sl?.id_contacto || null,
          nombres:     sl?.nombres    || "",
          apellidos:   sl?.apellidos  || "",
          email:       sl?.email      || "",
          telefono:    tel,
          pais:        sl?.pais       || pais || "",
          dias_transcurridos: sl?.dias_transcurridos != null ? Number(sl.dias_transcurridos) : 1,
        };
      });

      const { error: whErr } = await supabase.functions.invoke("send-n8n-webhook", {
        body: {
          target: "campanas_segmentadas",
          payload: {
            campaign_id:               campaign.id,
            campaign_name:             campaign.campaign_name,
            channel:                   campaign.channel,
            status:                    campaign.status,
            total_leads:               allLeads.length,
            message_template_whatsapp: campaign.message_template_whatsapp,
            message_template_email:    campaign.message_template_email,
            subject_email:             campaign.subject_email,
            target_filters:            campaign.target_filters,
            sheet: {
              pais,
              total: allLeads.length,
              leads: allLeads,
            },
            triggered_at: new Date().toISOString(),
          },
        },
      });
      if (whErr) throw whErr;
      toast({ title: "Campaña enviada", description: `${allLeads.length} leads enviados al webhook.` });
      onExecuted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error al ejecutar", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const stats = [
    { label: "Total Leads", value: campaign.total_leads ?? 0, icon: Users },
    { label: "WhatsApp", value: campaign.contacted_whatsapp ?? 0, icon: MessageCircle },
    { label: "Email", value: campaign.contacted_email ?? 0, icon: Mail },
    { label: "Respondieron", value: campaign.responded ?? 0, icon: CheckCircle2 },
    { label: "Convertidos", value: campaign.converted ?? 0, icon: TrendingUp },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-accent" /> {campaign.campaign_name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="secondary">{campaign.status || "—"}</Badge>
            <Badge variant="outline">{campaign.channel || "—"}</Badge>
            {campaign.created_at && (
              <span className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(campaign.created_at).toLocaleString("es-ES")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {stats.map(s => (
            <div key={s.label} className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <s.icon className="h-3 w-3" /> {s.label}
              </div>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {campaign.subject_email && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Asunto Email</p>
            <p className="text-sm border rounded p-2 bg-muted/30">{campaign.subject_email}</p>
          </div>
        )}
        {campaign.message_template_email && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Plantilla Email</p>
            <pre className="text-sm border rounded p-2 bg-muted/30 whitespace-pre-wrap font-sans">{campaign.message_template_email}</pre>
          </div>
        )}
        {campaign.message_template_whatsapp && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Plantilla WhatsApp</p>
            <pre className="text-sm border rounded p-2 bg-muted/30 whitespace-pre-wrap font-sans">{campaign.message_template_whatsapp}</pre>
          </div>
        )}
        {campaign.target_filters && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Filtros / Target</p>
            <pre className="text-xs border rounded p-2 bg-muted/30 overflow-x-auto">{JSON.stringify(campaign.target_filters, null, 2)}</pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button
            onClick={() => setWarningOpen(true)}
            disabled={executing}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send className="mr-2 h-4 w-4" />
            {executing ? "Enviando..." : "Ejecutar Campaña"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CampaignExecuteWarning
        open={warningOpen}
        onOpenChange={setWarningOpen}
        campaignName={campaign.campaign_name}
        totalLeads={campaign.total_leads ?? 0}
        channel={campaign.channel}
        onConfirm={handleExecute}
      />
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CampaignRow } from "./CampaignDetailsDialog";

interface Props {
  campaign: CampaignRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export default function EditCampaignDialog({ campaign, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp_email");
  const [status, setStatus] = useState("executing");
  const [subject, setSubject] = useState("");
  const [tplWa, setTplWa] = useState("");
  const [tplMail, setTplMail] = useState("");

  useEffect(() => {
    if (campaign && open) {
      setName(campaign.campaign_name || "");
      setChannel(campaign.channel || "whatsapp_email");
      setStatus(campaign.status || "executing");
      setSubject(campaign.subject_email || "");
      setTplWa(campaign.message_template_whatsapp || "");
      setTplMail(campaign.message_template_email || "");
    }
  }, [campaign, open]);

  if (!campaign) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("lead_recovery_campaigns")
      .update({
        campaign_name: name.trim(),
        channel,
        status,
        subject_email: subject || null,
        message_template_whatsapp: tplWa || null,
        message_template_email: tplMail || null,
      })
      .eq("id", campaign.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Campaña actualizada" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-accent" /> Editar Campaña
          </DialogTitle>
          <DialogDescription>Modifica los datos de la campaña</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">Solo WhatsApp</SelectItem>
                  <SelectItem value="email">Solo Email</SelectItem>
                  <SelectItem value="whatsapp_email">WhatsApp + Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executing">executing</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="pendiente">pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(channel === "whatsapp" || channel === "whatsapp_email") && (
            <div className="space-y-2">
              <Label>Plantilla WhatsApp</Label>
              <Textarea value={tplWa} onChange={(e) => setTplWa(e.target.value)} rows={3} />
            </div>
          )}
          {(channel === "email" || channel === "whatsapp_email") && (
            <>
              <div className="space-y-2">
                <Label>Asunto Email</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plantilla Email</Label>
                <Textarea value={tplMail} onChange={(e) => setTplMail(e.target.value)} rows={3} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

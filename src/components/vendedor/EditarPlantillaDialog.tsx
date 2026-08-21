import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

const VARIABLES_HINT = "Variables: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// Diálogo de edición compartido por Mis Plantillas y la Bandeja. `plantilla`
// null = crear nueva; con datos = editar (propia o compartida — la RLS decide
// si el guardado se acepta, no hace falta chequearlo acá).
export default function EditarPlantillaDialog({
  open, onOpenChange, canal, plantilla, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canal: "whatsapp" | "email";
  plantilla: PlantillaWa | PlantillaEmail | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ nombre: "", contenido: "", asunto: "", cuerpo_html: "", cuerpo_text: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!plantilla) {
      setForm({ nombre: "", contenido: "", asunto: "", cuerpo_html: "", cuerpo_text: "" });
    } else if (canal === "whatsapp") {
      const w = plantilla as PlantillaWa;
      setForm({ nombre: w.nombre, contenido: w.contenido, asunto: "", cuerpo_html: "", cuerpo_text: "" });
    } else {
      const e = plantilla as PlantillaEmail;
      setForm({ nombre: e.nombre, contenido: "", asunto: e.asunto, cuerpo_html: e.cuerpo_html, cuerpo_text: e.cuerpo_text || "" });
    }
  }, [open, plantilla, canal]);

  const guardar = async () => {
    if (!form.nombre.trim() || !user) return;
    setSaving(true);
    const tabla = canal === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const payload = canal === "whatsapp"
      ? { nombre: form.nombre, contenido: form.contenido, creado_por: user.id, activa: true }
      : { nombre: form.nombre, asunto: form.asunto, cuerpo_html: form.cuerpo_html, cuerpo_text: form.cuerpo_text || null, creado_por: user.id, activa: true };

    const { error } = plantilla
      ? await sb.from(tabla).update(payload).eq("id", plantilla.id)
      : await sb.from(tabla).insert(payload);

    setSaving(false);
    if (error) { toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: plantilla ? "Plantilla actualizada" : "Plantilla creada" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{plantilla ? "Editar" : "Nueva"} plantilla · {canal === "whatsapp" ? "WhatsApp" : "Email"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre interno</Label>
            <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          {canal === "whatsapp" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Mensaje</Label>
              <Textarea value={form.contenido} onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))} className="min-h-[120px] text-sm" />
              <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Asunto</Label>
                <Input value={form.asunto} onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cuerpo (HTML)</Label>
                <Textarea value={form.cuerpo_html} onChange={(e) => setForm((f) => ({ ...f, cuerpo_html: e.target.value }))} className="min-h-[140px] font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cuerpo (texto plano, opcional)</Label>
                <Textarea value={form.cuerpo_text} onChange={(e) => setForm((f) => ({ ...f, cuerpo_text: e.target.value }))} className="min-h-[70px] text-sm" />
              </div>
              <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={saving} className="bg-[#003DA5] hover:bg-[#003DA5]/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

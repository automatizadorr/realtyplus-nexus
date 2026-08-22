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
import type { PlantillaWa } from "@/components/vendedor/types";

const VARIABLES_HINT = "Variables: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// Diálogo de edición de plantillas de WhatsApp (Mis Plantillas). El diseño de
// correo vive aparte, inline, en la sección "Diseño de Correo"
// (CorreosVendedorTab) — no en un diálogo.
export default function EditarPlantillaDialog({
  open, onOpenChange, plantilla, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantilla: PlantillaWa | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ nombre: "", contenido: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(plantilla ? { nombre: plantilla.nombre, contenido: plantilla.contenido } : { nombre: "", contenido: "" });
  }, [open, plantilla]);

  const guardar = async () => {
    if (!form.nombre.trim() || !user) return;
    setSaving(true);
    const payload = { nombre: form.nombre, contenido: form.contenido, creado_por: user.id, activa: true };
    const { error } = plantilla
      ? await sb.from("plantillas_whatsapp").update(payload).eq("id", plantilla.id)
      : await sb.from("plantillas_whatsapp").insert(payload);
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
          <DialogTitle>{plantilla ? "Editar" : "Nueva"} plantilla · WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre interno</Label>
            <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensaje</Label>
            <Textarea value={form.contenido} onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))} className="min-h-[120px] text-sm" />
            <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
          </div>
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

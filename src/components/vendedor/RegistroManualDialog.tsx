import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PAISES_PROSPECCION } from "@/lib/paises";

type Form = {
  nombre: string; telefono: string; email: string; pais: string;
  instagram: string; facebook: string; notas: string;
};
const vacio = (): Form => ({ nombre: "", telefono: "", email: "", pais: "", instagram: "", facebook: "", notas: "" });

// Alta manual de un lead desde la Bandeja: el vendedor consigue un contacto
// fuera del CRM (referido, evento, llamada entrante, un DM) y lo carga a mano
// para que entre al mismo flujo que los leads asignados — Bandeja primero,
// Pipeline después de contactarlo.
export default function RegistroManualDialog({
  open, onOpenChange, onCreado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreado?: (leadId: string) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Form>(vacio());
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const hayContacto = Boolean(
    form.telefono.trim() || form.email.trim() || form.instagram.trim() || form.facebook.trim(),
  );
  const puedeGuardar = Boolean(form.nombre.trim()) && hayContacto && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    const { data, error } = await supabase.rpc("vendedor_registrar_lead_manual", {
      _nombre: form.nombre.trim(),
      _telefono: form.telefono.trim() || null,
      _email: form.email.trim() || null,
      _pais: form.pais || null,
      _instagram: form.instagram.trim() || null,
      _facebook: form.facebook.trim() || null,
      _notas: form.notas.trim() || null,
    });
    setGuardando(false);
    if (error) {
      toast({ title: "No se pudo registrar el lead", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lead registrado", description: "Quedó en tu Bandeja, listo para el primer contacto." });
    setForm(vacio());
    onOpenChange(false);
    if (data) onCreado?.(String(data));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!guardando) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#003DA5]" /> Registrar lead a mano
          </DialogTitle>
          <DialogDescription className="text-xs">
            Para contactos que no vinieron del CRM: un referido, alguien de un evento, una llamada
            entrante o un DM. Entra a tu Bandeja como cualquier otro lead asignado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre o empresa *</Label>
            <Input value={form.nombre} onChange={(e) => set("nombre")(e.target.value)} placeholder="p. ej. Inmobiliaria Costa Norte" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono / WhatsApp</Label>
              <Input value={form.telefono} onChange={(e) => set("telefono")(e.target.value)} placeholder="+56 9 1234 5678" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="contacto@empresa.com" inputMode="email" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">País</Label>
              <Select value={form.pais} onValueChange={set("pais")}>
                <SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger>
                <SelectContent>
                  {PAISES_PROSPECCION.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instagram</Label>
              <Input value={form.instagram} onChange={(e) => set("instagram")(e.target.value)} placeholder="@usuario" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Facebook</Label>
              <Input value={form.facebook} onChange={(e) => set("facebook")(e.target.value)} placeholder="@pagina" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={form.notas} onChange={(e) => set("notas")(e.target.value)}
              placeholder="De dónde salió, qué te pidió, con quién hay que hablar…"
              className="min-h-[60px] text-sm"
            />
          </div>

          {!hayContacto && form.nombre.trim() !== "" && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700">
              Falta al menos un dato de contacto: teléfono, email, Instagram o Facebook.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Si el teléfono ya existe en la base, no se duplica: se recupera ese lead a tu Bandeja.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={guardando} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!puedeGuardar} onClick={guardar} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

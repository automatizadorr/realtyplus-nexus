import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Mail as MailIcon, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

const VARIABLES_HINT = "Variables: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

type Stat = { plantilla_id: string; canal: string; usos: number; respondieron: number; tasa_pct: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function MisPlantillasTab({
  plantillasWa, plantillasEmail, onChanged,
}: {
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState("whatsapp");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaWa | PlantillaEmail | null>(null);
  const [form, setForm] = useState({ nombre: "", contenido: "", asunto: "", cuerpo_html: "", cuerpo_text: "" });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    sb.rpc("plantilla_stats").then(({ data }: { data: Stat[] | null }) => setStats(data ?? []));
  }, []);

  const statsById = useMemo(() => {
    const m = new Map<string, Stat>();
    for (const s of stats) m.set(s.plantilla_id, s);
    return m;
  }, [stats]);

  const propias = tab === "whatsapp"
    ? plantillasWa.filter((p) => p.creado_por === user?.id)
    : plantillasEmail.filter((p) => p.creado_por === user?.id);
  const compartidas = tab === "whatsapp"
    ? plantillasWa.filter((p) => p.creado_por !== user?.id)
    : plantillasEmail.filter((p) => p.creado_por !== user?.id);

  const abrirNueva = () => {
    setEditing(null);
    setForm({ nombre: "", contenido: "", asunto: "", cuerpo_html: "", cuerpo_text: "" });
    setDialogOpen(true);
  };

  const abrirEditar = (p: PlantillaWa | PlantillaEmail) => {
    setEditing(p);
    if (tab === "whatsapp") {
      const w = p as PlantillaWa;
      setForm({ nombre: w.nombre, contenido: w.contenido, asunto: "", cuerpo_html: "", cuerpo_text: "" });
    } else {
      const e = p as PlantillaEmail;
      setForm({ nombre: e.nombre, contenido: "", asunto: e.asunto, cuerpo_html: e.cuerpo_html, cuerpo_text: e.cuerpo_text || "" });
    }
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !user) return;
    setSaving(true);
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const payload = tab === "whatsapp"
      ? { nombre: form.nombre, contenido: form.contenido, creado_por: user.id, activa: true }
      : { nombre: form.nombre, asunto: form.asunto, cuerpo_html: form.cuerpo_html, cuerpo_text: form.cuerpo_text || null, creado_por: user.id, activa: true };

    const { error } = editing
      ? await sb.from(tabla).update(payload).eq("id", editing.id)
      : await sb.from(tabla).insert(payload);

    setSaving(false);
    if (error) { toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Plantilla actualizada" : "Plantilla creada" });
    setDialogOpen(false);
    onChanged();
  };

  const eliminar = async (p: PlantillaWa | PlantillaEmail) => {
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const { error } = await sb.from(tabla).delete().eq("id", p.id);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plantilla borrada" });
    onChanged();
  };

  const toggleActiva = async (p: PlantillaWa | PlantillaEmail, activa: boolean) => {
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const { error } = await sb.from(tabla).update({ activa }).eq("id", p.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="whatsapp" className="gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5"><MailIcon className="h-4 w-4" /> Email</TabsTrigger>
          </TabsList>
          <Button type="button" size="sm" onClick={abrirNueva} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
            <Plus className="h-4 w-4" /> Nueva plantilla
          </Button>
        </div>

        <TabsContent value={tab} className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tus plantillas</h3>
            {propias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no creaste ninguna. Usa "Nueva plantilla".</p>
            ) : (
              <div className="space-y-2">
                {propias.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="flex items-start gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.nombre}</span>
                          <Badge variant={p.activa ? "secondary" : "outline"} className={p.activa ? "text-emerald-600" : "text-muted-foreground"}>
                            {p.activa ? "Activa" : "Inactiva"}
                          </Badge>
                          {statsById.get(p.id) && (
                            <span className="text-[11px] text-muted-foreground">
                              {statsById.get(p.id)!.usos} usos · {statsById.get(p.id)!.tasa_pct ?? 0}% respondió
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {tab === "whatsapp" ? (p as PlantillaWa).contenido : (p as PlantillaEmail).asunto}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Switch checked={!!p.activa} onCheckedChange={(v) => toggleActiva(p, v)} />
                        <Button type="button" variant="ghost" size="sm" onClick={() => abrirEditar(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminar(p)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Lock className="h-3 w-3" /> Compartidas por tu equipo
            </h3>
            {compartidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin plantillas compartidas activas.</p>
            ) : (
              <div className="space-y-2">
                {compartidas.map((p) => (
                  <Card key={p.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{p.nombre}</span>
                        {statsById.get(p.id) && (
                          <span className="text-[11px] text-muted-foreground">
                            {statsById.get(p.id)!.usos} usos · {statsById.get(p.id)!.tasa_pct ?? 0}% respondió
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {tab === "whatsapp" ? (p as PlantillaWa).contenido : (p as PlantillaEmail).asunto}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nueva"} plantilla · {tab === "whatsapp" ? "WhatsApp" : "Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre interno</Label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            {tab === "whatsapp" ? (
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
                  <Label className="text-xs">Cuerpo</Label>
                  <Textarea value={form.cuerpo_html} onChange={(e) => setForm((f) => ({ ...f, cuerpo_html: e.target.value, cuerpo_text: e.target.value }))} className="min-h-[120px] text-sm" />
                </div>
                <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={saving} className="bg-[#003DA5] hover:bg-[#003DA5]/90">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

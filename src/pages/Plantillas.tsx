import { useEffect, useState } from "react";
import { FileText, MessageCircle, Mail as MailIcon, Plus, Pencil, Trash2, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-is-admin";

type PlantillaWa = { id: string; nombre: string; contenido: string; activa: boolean };
type PlantillaEmail = { id: string; nombre: string; asunto: string; cuerpo_html: string; cuerpo_text: string | null; activa: boolean };

const VARIABLES_HINT = "Variables disponibles: {{nombre}} {{empresa}} {{ciudad}} {{pais}} {{propuesta_valor}} {{gancho}}";

// Las tablas plantillas_* aún no están en el types.ts generado (se regenera desde
// Lovable). Accesor sin tipos, mismo patrón que BuscarLeads.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function Plantillas() {
  const { toast } = useToast();
  const { canWrite, loading: roleLoading } = useRole();

  const [tab, setTab] = useState("whatsapp");
  const [loading, setLoading] = useState(true);
  const [wa, setWa] = useState<PlantillaWa[]>([]);
  const [email, setEmail] = useState<PlantillaEmail[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaWa | PlantillaEmail | null>(null);
  const [form, setForm] = useState({ nombre: "", contenido: "", asunto: "", cuerpo_html: "", cuerpo_text: "" });
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const [{ data: waData, error: waErr }, { data: emailData, error: emailErr }] = await Promise.all([
      sb.from("plantillas_whatsapp").select("*").order("nombre"),
      sb.from("plantillas_email").select("*").order("nombre"),
    ]);
    if (waErr || emailErr) {
      toast({ title: "Error al cargar plantillas", description: (waErr || emailErr)?.message, variant: "destructive" });
    } else {
      setWa((waData ?? []) as PlantillaWa[]);
      setEmail((emailData ?? []) as PlantillaEmail[]);
    }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

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
    if (!form.nombre.trim()) { toast({ title: "Falta el nombre", variant: "destructive" }); return; }
    setSaving(true);
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const payload = tab === "whatsapp"
      ? { nombre: form.nombre, contenido: form.contenido }
      : { nombre: form.nombre, asunto: form.asunto, cuerpo_html: form.cuerpo_html, cuerpo_text: form.cuerpo_text || null };

    const { error } = editing
      ? await sb.from(tabla).update(payload).eq("id", editing.id)
      : await sb.from(tabla).insert(payload);

    setSaving(false);
    if (error) { toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Plantilla actualizada" : "Plantilla creada" });
    setDialogOpen(false);
    cargar();
  };

  const eliminar = async (p: PlantillaWa | PlantillaEmail) => {
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const { error } = await sb.from(tabla).delete().eq("id", p.id);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plantilla borrada" });
    cargar();
  };

  const toggleActiva = async (p: PlantillaWa | PlantillaEmail, activa: boolean) => {
    const tabla = tab === "whatsapp" ? "plantillas_whatsapp" : "plantillas_email";
    const { error } = await sb.from(tabla).update({ activa }).eq("id", p.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    cargar();
  };

  if (!roleLoading && !canWrite) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acceso restringido</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Solo administradores pueden gestionar las plantillas de contacto de los vendedores.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Plantillas</h1>
          <p className="text-sm text-muted-foreground">
            Mensajes predeterminados que tus vendedores usan para contactar leads de campaña.
          </p>
        </div>
      </div>

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

        <TabsContent value="whatsapp" className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : wa.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Sin plantillas de WhatsApp todavía. {VARIABLES_HINT}
            </div>
          ) : (
            wa.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.nombre}</span>
                      <Badge variant={p.activa ? "secondary" : "outline"} className={p.activa ? "text-emerald-600" : "text-muted-foreground"}>
                        {p.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">{p.contenido}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={p.activa} onCheckedChange={(v) => toggleActiva(p, v)} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => abrirEditar(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => eliminar(p)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="email" className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : email.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Sin plantillas de email todavía. {VARIABLES_HINT}
            </div>
          ) : (
            email.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.nombre}</span>
                      <Badge variant={p.activa ? "secondary" : "outline"} className={p.activa ? "text-emerald-600" : "text-muted-foreground"}>
                        {p.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Asunto: {p.asunto}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">{p.cuerpo_text || p.cuerpo_html}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={p.activa} onCheckedChange={(v) => toggleActiva(p, v)} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => abrirEditar(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => eliminar(p)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"} · {tab === "whatsapp" ? "WhatsApp" : "Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre interno</Label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="p. ej. Primer contacto corredores" />
            </div>
            {tab === "whatsapp" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Mensaje</Label>
                <Textarea
                  value={form.contenido}
                  onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))}
                  className="min-h-[140px] text-sm"
                  placeholder={`Hola {{nombre}}, vi que {{empresa}} en {{ciudad}}...`}
                />
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
                  <Textarea
                    value={form.cuerpo_html}
                    onChange={(e) => setForm((f) => ({ ...f, cuerpo_html: e.target.value }))}
                    className="min-h-[140px] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cuerpo (texto plano, opcional)</Label>
                  <Textarea
                    value={form.cuerpo_text}
                    onChange={(e) => setForm((f) => ({ ...f, cuerpo_text: e.target.value }))}
                    className="min-h-[80px] text-sm"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={saving} className="bg-[#003DA5] hover:bg-[#003DA5]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

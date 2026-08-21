import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Mail as MailIcon, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EditarPlantillaDialog from "@/components/vendedor/EditarPlantillaDialog";
import PlantillaEmailPreviewDialog from "@/components/vendedor/PlantillaEmailPreviewDialog";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

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
  const [previewing, setPreviewing] = useState<PlantillaEmail | null>(null);
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

  const abrirNueva = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (p: PlantillaWa | PlantillaEmail) => { setEditing(p); setDialogOpen(true); };
  const abrirPreview = (p: PlantillaEmail) => setPreviewing(p);

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

  const excerpt = (p: PlantillaWa | PlantillaEmail) => {
    if (tab === "whatsapp") return (p as PlantillaWa).contenido;
    const e = p as PlantillaEmail;
    const cuerpo = (e.cuerpo_text || e.cuerpo_html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    return `${e.asunto} — ${cuerpo}`;
  };

  const Tarjeta = ({ p, esPropia }: { p: PlantillaWa | PlantillaEmail; esPropia: boolean }) => (
    <Card key={p.id} className={esPropia ? undefined : "bg-muted/30"}>
      <CardContent
        className={`flex items-start gap-3 p-3 ${tab === "email" ? "cursor-pointer" : ""}`}
        onClick={tab === "email" ? () => abrirPreview(p as PlantillaEmail) : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.nombre}</span>
            {esPropia && (
              <Badge variant={p.activa ? "secondary" : "outline"} className={p.activa ? "text-emerald-600" : "text-muted-foreground"}>
                {p.activa ? "Activa" : "Inactiva"}
              </Badge>
            )}
            {statsById.get(p.id) && (
              <span className="text-[11px] text-muted-foreground">
                {statsById.get(p.id)!.usos} usos · {statsById.get(p.id)!.tasa_pct ?? 0}% respondió
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{excerpt(p)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {esPropia && <Switch checked={!!p.activa} onCheckedChange={(v) => toggleActiva(p, v)} />}
          <Button type="button" variant="ghost" size="sm" onClick={() => abrirEditar(p)}><Pencil className="h-3.5 w-3.5" /></Button>
          {esPropia && (
            <Button type="button" variant="ghost" size="sm" onClick={() => eliminar(p)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
                {propias.map((p) => <Tarjeta key={p.id} p={p} esPropia />)}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Lock className="h-3 w-3" /> Compartidas por tu equipo
            </h3>
            <p className="mb-2 text-[11px] text-muted-foreground">Podés editarlas — el cambio se ve para todo el equipo. Solo el dueño puede borrarlas.</p>
            {compartidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin plantillas compartidas activas.</p>
            ) : (
              <div className="space-y-2">
                {compartidas.map((p) => <Tarjeta key={p.id} p={p} esPropia={false} />)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <EditarPlantillaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        canal={tab === "whatsapp" ? "whatsapp" : "email"}
        plantilla={editing}
        onSaved={onChanged}
      />

      <PlantillaEmailPreviewDialog
        open={!!previewing}
        onOpenChange={(v) => !v && setPreviewing(null)}
        plantilla={previewing}
        onEditar={() => { if (previewing) { setEditing(previewing); setPreviewing(null); setDialogOpen(true); } }}
      />
    </div>
  );
}

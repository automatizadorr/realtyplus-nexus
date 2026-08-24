import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EditarPlantillaDialog from "@/components/vendedor/EditarPlantillaDialog";
import type { PlantillaWa } from "@/components/vendedor/types";

type Stat = { plantilla_id: string; canal: string; usos: number; respondieron: number; tasa_pct: number | null };

// Plantillas de WhatsApp del vendedor. El diseño de correos (HTML, botón,
// logo, etc.) vive en su propia sección "Correos Personalizados"
// (CorreosVendedorTab), con su propio ítem en el sidebar.
export default function MisPlantillasTab({
  plantillasWa, onChanged,
}: {
  plantillasWa: PlantillaWa[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaWa | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    supabase.rpc("plantilla_stats").then(({ data }: { data: Stat[] | null }) => setStats(data ?? []));
  }, []);

  const statsById = useMemo(() => {
    const m = new Map<string, Stat>();
    for (const s of stats) m.set(s.plantilla_id, s);
    return m;
  }, [stats]);

  const propias = plantillasWa.filter((p) => p.creado_por === user?.id);
  const compartidas = plantillasWa.filter((p) => p.creado_por !== user?.id);

  const abrirNueva = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (p: PlantillaWa) => { setEditing(p); setDialogOpen(true); };

  const eliminar = async (p: PlantillaWa) => {
    const { error } = await supabase.from("plantillas_whatsapp").delete().eq("id", p.id);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plantilla borrada" });
    onChanged();
  };

  const toggleActiva = async (p: PlantillaWa, activa: boolean) => {
    const { error } = await supabase.from("plantillas_whatsapp").update({ activa }).eq("id", p.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  const Tarjeta = ({ p, esPropia }: { p: PlantillaWa; esPropia: boolean }) => (
    <Card key={p.id} className={esPropia ? undefined : "bg-muted/30"}>
      <CardContent className="flex items-start gap-3 p-3">
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
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.contenido}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <MessageCircle className="h-5 w-5 text-[#003DA5]" /> Mis Plantillas · WhatsApp
        </h2>
        <Button type="button" size="sm" onClick={abrirNueva} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
          <Plus className="h-4 w-4" /> Nueva plantilla
        </Button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tus plantillas</h3>
        {propias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no creaste ninguna. Usa "Nueva plantilla".</p>
        ) : (
          <div className="space-y-2">{propias.map((p) => <Tarjeta key={p.id} p={p} esPropia />)}</div>
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
          <div className="space-y-2">{compartidas.map((p) => <Tarjeta key={p.id} p={p} esPropia={false} />)}</div>
        )}
      </div>

      <EditarPlantillaDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        plantilla={editing} onSaved={onChanged}
      />
    </div>
  );
}

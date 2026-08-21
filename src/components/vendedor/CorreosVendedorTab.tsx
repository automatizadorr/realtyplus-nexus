import { useMemo, useState } from "react";
import { Mail, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import EditarPlantillaDialog from "@/components/vendedor/EditarPlantillaDialog";
import PlantillaEmailPreviewDialog from "@/components/vendedor/PlantillaEmailPreviewDialog";
import type { PlantillaEmail } from "@/components/vendedor/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// Sección propia (separada de "Mis Plantillas", que quedó solo para
// WhatsApp): diseño visual de correos, mismo compositor que Correos
// Personalizados del admin (EmailDesignCard + emailTemplates), pero acotado
// a las plantillas de email del vendedor.
export default function CorreosVendedorTab({
  plantillasEmail, onChanged,
}: {
  plantillasEmail: PlantillaEmail[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaEmail | null>(null);
  const [previewing, setPreviewing] = useState<PlantillaEmail | null>(null);

  const propias = useMemo(() => plantillasEmail.filter((p) => p.creado_por === user?.id), [plantillasEmail, user?.id]);
  const compartidas = useMemo(() => plantillasEmail.filter((p) => p.creado_por !== user?.id), [plantillasEmail, user?.id]);

  const abrirNueva = () => { setEditing(null); setDialogOpen(true); };
  const abrirEditar = (p: PlantillaEmail) => { setEditing(p); setDialogOpen(true); };

  const eliminar = async (p: PlantillaEmail) => {
    const { error } = await sb.from("plantillas_email").delete().eq("id", p.id);
    if (error) { toast({ title: "No se pudo borrar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plantilla borrada" });
    onChanged();
  };

  const toggleActiva = async (p: PlantillaEmail, activa: boolean) => {
    const { error } = await sb.from("plantillas_email").update({ activa }).eq("id", p.id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    onChanged();
  };

  const excerpt = (p: PlantillaEmail) =>
    `${p.asunto} — ${(p.cuerpo_text || p.cuerpo_html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()}`;

  const Tarjeta = ({ p, esPropia }: { p: PlantillaEmail; esPropia: boolean }) => (
    <Card key={p.id} className={esPropia ? undefined : "bg-muted/30"}>
      <CardContent className="flex cursor-pointer items-start gap-3 p-3" onClick={() => setPreviewing(p)}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.nombre}</span>
            {esPropia && (
              <Badge variant={p.activa ? "secondary" : "outline"} className={p.activa ? "text-emerald-600" : "text-muted-foreground"}>
                {p.activa ? "Activa" : "Inactiva"}
              </Badge>
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
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight">Correos Personalizados</h2>
          <p className="text-sm text-muted-foreground">Diseña el HTML de tus correos: título, botón, color de marca, logo y firma.</p>
        </div>
        <Button type="button" size="sm" onClick={abrirNueva} className="shrink-0 gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
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
        canal="email" plantilla={editing} onSaved={onChanged}
      />

      <PlantillaEmailPreviewDialog
        open={!!previewing} onOpenChange={(v) => !v && setPreviewing(null)}
        plantilla={previewing}
        onEditar={() => { if (previewing) { setEditing(previewing); setPreviewing(null); setDialogOpen(true); } }}
      />
    </div>
  );
}

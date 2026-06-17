import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeadTag {
  id: string;
  nombre: string;
  color: string;
  es_permanente: boolean;
}

const PRESET_COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6",
  "#8b5cf6", "#06b6d4", "#ec4899", "#6b7280",
];

/**
 * Gestión de etiquetas no-permanentes (IA y custom).
 * Destino: src/components/tags/TagManager.tsx
 * Uso: insertar en la pestaña de ajustes o como sección en Settings.tsx
 *
 * <TagManager />
 */
export function TagManager() {
  const { toast } = useToast();
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  async function fetchTags() {
    setLoading(true);
    const { data } = await supabase
      .from("lead_tags")
      .select("id, nombre, color, es_permanente")
      .order("es_permanente", { ascending: false })
      .order("nombre");
    setTags((data as LeadTag[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTags(); }, []);

  async function handleCreate() {
    if (!nombre.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("lead_tags")
      .insert({ nombre: nombre.trim(), color, es_permanente: false });

    if (error) {
      toast({ title: "Error al crear etiqueta", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Etiqueta creada" });
      setOpen(false);
      setNombre("");
      setColor(PRESET_COLORS[0]);
      fetchTags();
    }
    setSaving(false);
  }

  async function handleDelete(tag: LeadTag) {
    if (tag.es_permanente) {
      toast({ title: "No se puede eliminar una etiqueta permanente", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("lead_tags").delete().eq("id", tag.id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Etiqueta eliminada" });
      fetchTags();
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Etiquetas de leads</h3>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus size={14} />
              Nueva etiqueta
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Crear etiqueta</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Nombre
                </label>
                <Input
                  placeholder="ej. Interesado en renta"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        background: c,
                        borderColor: color === c ? "#fff" : "transparent",
                        outline: color === c ? `2px solid ${c}` : "none",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded-full cursor-pointer border border-border"
                    title="Color personalizado"
                  />
                </div>

                {/* Preview */}
                <div className="mt-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: `${color}22`,
                      color,
                      border: `1px solid ${color}55`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    {nombre || "Vista previa"}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!nombre.trim() || saving}>
                {saving && <Loader2 className="animate-spin mr-1.5" size={14} />}
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-muted-foreground" size={18} />
        </div>
      ) : (
        <div className="space-y-1.5">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: `${tag.color}33`, background: `${tag.color}08` }}
            >
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: `${tag.color}22`,
                  color: tag.color,
                  border: `1px solid ${tag.color}55`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
                {tag.nombre}
              </span>

              {tag.es_permanente ? (
                <span className="text-[10px] text-muted-foreground">permanente</span>
              ) : (
                <button
                  onClick={() => handleDelete(tag)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

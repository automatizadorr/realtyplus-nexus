import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy, Loader2, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuickReply {
  id: string;
  titulo: string;
  contenido: string;
  created_at: string;
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<QuickReply>;
  onSave: (data: { titulo: string; contenido: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [titulo, setTitulo] = useState(initial?.titulo || "");
  const [contenido, setContenido] = useState(initial?.contenido || "");

  const variables = ["{nombre}", "{telefono}", "{propiedad}", "{precio}", "{ciudad}"];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="titulo">Nombre de la plantilla</Label>
        <Input
          id="titulo"
          placeholder="Ej: Saludo inicial, Seguimiento 3 días..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contenido">Mensaje</Label>
        <Textarea
          id="contenido"
          placeholder="Escribe el mensaje. Usa variables como {nombre} para personalizar..."
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={6}
          className="font-mono text-sm resize-none"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className="text-xs text-muted-foreground">Variables:</span>
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setContenido((c) => c + v)}
              className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono"
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {contenido.length} caracteres
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button
          onClick={() => onSave({ titulo: titulo.trim(), contenido: contenido.trim() })}
          disabled={saving || !titulo.trim() || !contenido.trim()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar plantilla
        </Button>
      </DialogFooter>
    </div>
  );
}

export function PlantillasTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QuickReply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("quick_replies")
      .select("id, titulo, contenido, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error al cargar plantillas", description: error.message, variant: "destructive" });
    }
    setTemplates((data || []) as QuickReply[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async ({ titulo, contenido }: { titulo: string; contenido: string }) => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("quick_replies")
      .insert({ titulo, contenido, user_id: user.id });
    setSaving(false);
    if (error) {
      toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Plantilla creada" });
    setCreateOpen(false);
    load();
  };

  const handleEdit = async ({ titulo, contenido }: { titulo: string; contenido: string }) => {
    if (!editTarget) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("quick_replies")
      .update({ titulo, contenido })
      .eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Plantilla actualizada" });
    setEditTarget(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await (supabase as any)
      .from("quick_replies")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Plantilla eliminada" });
    setDeleteTarget(null);
    load();
  };

  const copyToClipboard = async (t: QuickReply) => {
    await navigator.clipboard.writeText(t.contenido);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copiado al portapapeles" });
  };

  const filtered = templates.filter(
    (t) =>
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      t.contenido.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar plantillas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nueva plantilla
        </Button>
        <Badge variant="secondary">{filtered.length} plantilla{filtered.length !== 1 ? "s" : ""}</Badge>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search ? "No se encontraron plantillas." : "Aún no tienes plantillas."}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Crear primera plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col hover:shadow-md transition-shadow group">
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm truncate">{t.titulo}</span>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => copyToClipboard(t)}
                      title="Copiar"
                    >
                      <Copy className={`h-3.5 w-3.5 ${copiedId === t.id ? "text-green-500" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditTarget(t)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1 whitespace-pre-wrap font-mono bg-muted/40 rounded p-2">
                  {t.contenido}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("es-ES")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.contenido.length} chars
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva plantilla de mensaje</DialogTitle>
          </DialogHeader>
          <TemplateForm onSave={handleCreate} onCancel={() => setCreateOpen(false)} saving={saving} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar plantilla</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <TemplateForm
              initial={editTarget}
              onSave={handleEdit}
              onCancel={() => setEditTarget(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "<strong>{deleteTarget?.titulo}</strong>" permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

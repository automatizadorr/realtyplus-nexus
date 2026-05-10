import { useEffect, useState } from "react";
import { Zap, Plus, Pencil, Trash2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { QuickReply } from "@/lib/supabase";

interface Props {
  isAdmin: boolean;
  onPick: (text: string) => void;
  contactName?: string | null;
}

export function QuickRepliesPopover({ isAdmin, onPick, contactName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any).from("quick_replies").select("*").order("created_at", { ascending: false });
    setItems((data || []) as QuickReply[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open && isAdmin) load();
  }, [open, isAdmin]);

  const replaceVars = (text: string) => text.replace(/\{\{nombre\}\}/g, contactName || "");

  const save = async () => {
    if (!titulo.trim() || !contenido.trim() || !user) return;
    if (editing) {
      await (supabase as any).from("quick_replies").update({ titulo, contenido }).eq("id", editing.id);
    } else {
      await (supabase as any).from("quick_replies").insert({ titulo, contenido, user_id: user.id });
    }
    setEditorOpen(false);
    setEditing(null);
    setTitulo("");
    setContenido("");
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from("quick_replies").delete().eq("id", id);
    load();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isAdmin) {
      e.preventDefault();
      toast({ title: "Solo administradores", description: "Función bloqueada.", variant: "destructive" });
    }
  };

  return (
    <>
      <Popover open={open && isAdmin} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={handleClick}
          >
            {isAdmin ? <Zap className="h-4 w-4" /> : <Lock className="h-4 w-4 opacity-60" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-80 p-0">
          <div className="flex items-center justify-between p-2 border-b">
            <span className="text-sm font-semibold">Respuestas rápidas</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setTitulo("");
                setContenido("");
                setEditorOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
            </Button>
          </div>
          <ScrollArea className="max-h-72">
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center p-4">Sin plantillas. Crea la primera.</p>
            ) : (
              items.map((r) => (
                <div key={r.id} className="group flex items-start gap-2 p-2 hover:bg-muted/50 border-b last:border-0">
                  <button
                    className="flex-1 text-left"
                    onClick={() => {
                      onPick(replaceVars(r.contenido));
                      setOpen(false);
                    }}
                  >
                    <div className="text-xs font-semibold text-foreground">{r.titulo}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{r.contenido}</div>
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditing(r);
                        setTitulo(r.titulo);
                        setContenido(r.contenido);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
          <div className="p-2 border-t text-[10px] text-muted-foreground">
            Variable disponible: <code>{"{{nombre}}"}</code>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Título (ej: Saludo inicial)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Textarea
              placeholder="Mensaje. Usa {{nombre}} para insertar el nombre del lead."
              rows={5}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

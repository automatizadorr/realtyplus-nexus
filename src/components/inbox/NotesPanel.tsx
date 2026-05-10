import { useEffect, useState } from "react";
import { StickyNote, Send, Trash2, Loader2, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { LeadNote } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isAdmin: boolean;
  leadId: string;
  open: boolean;
  onClose: () => void;
}

export function NotesPanel({ isAdmin, leadId, open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setNotes((data || []) as LeadNote[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open && isAdmin && leadId) load();
  }, [open, isAdmin, leadId]);

  const add = async () => {
    if (!text.trim() || !user) return;
    const { error } = await (supabase as any)
      .from("lead_notes")
      .insert({ lead_id: leadId, user_id: user.id, contenido: text.trim() });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setText("");
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from("lead_notes").delete().eq("id", id);
    load();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 24 }}
          className="w-80 border-l bg-card flex flex-col h-full shrink-0"
        >
          <div className="h-14 px-3 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notas internas</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!isAdmin ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 p-6 text-center">
              <Lock className="h-8 w-8 opacity-50" />
              <p className="text-sm">Solo administradores pueden ver y crear notas.</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b space-y-2">
                <Textarea
                  placeholder="Añadir nota privada..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
                <Button size="sm" onClick={add} disabled={!text.trim()} className="w-full">
                  <Send className="h-3.5 w-3.5 mr-1" /> Guardar nota
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center p-4">Sin notas todavía.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="group p-3 border-b text-sm">
                      <p className="whitespace-pre-wrap">{n.contenido}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("es-ES")}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => remove(n.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

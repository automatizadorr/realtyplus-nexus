import { useEffect, useState } from "react";
import { Tag, Plus, Trash2, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadTag, LeadCampana } from "@/lib/supabase";

const PALETTE = ["#003366", "#cc0000", "#0d9488", "#7c3aed", "#ea580c", "#16a34a", "#0284c7", "#db2777"];

interface TagsButtonProps {
  isAdmin: boolean;
  contact: LeadCampana;
  allTags: LeadTag[];
  onChange: (tagIds: string[]) => void;
  onTagsRefresh: () => void;
}

export function TagsButton({ isAdmin, contact, allTags, onChange, onTagsRefresh }: TagsButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);

  const current = contact.tag_ids || [];

  const toggle = async (tagId: string) => {
    const has = current.includes(tagId);
    const next = has ? current.filter((t) => t !== tagId) : [...current, tagId];
    await (supabase as any).from("leads_campana").update({ tag_ids: next }).eq("id", contact.id);
    onChange(next);
  };

  const createTag = async () => {
    if (!newName.trim()) return;
    const { error } = await (supabase as any).from("lead_tags").insert({ nombre: newName.trim(), color: newColor });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    setCreating(false);
    onTagsRefresh();
  };

  const removeTag = async (id: string) => {
    // Las etiquetas permanentes no se pueden borrar (también bloqueado en la BD)
    if (allTags.find((t) => t.id === id)?.es_permanente) {
      toast({ title: "Etiqueta permanente", description: "Esta etiqueta no se puede borrar.", variant: "destructive" });
      return;
    }
    // Remove the tag id from any lead that still references it
    const { data: leadsWithTag } = await (supabase as any)
      .from("leads_campana")
      .select("id, tag_ids")
      .contains("tag_ids", [id]);
    if (leadsWithTag?.length) {
      await Promise.all(
        leadsWithTag.map((l: { id: string; tag_ids: string[] | null }) =>
          (supabase as any)
            .from("leads_campana")
            .update({ tag_ids: (l.tag_ids || []).filter((t) => t !== id) })
            .eq("id", l.id),
        ),
      );
    }
    await (supabase as any).from("lead_tags").delete().eq("id", id);
    onTagsRefresh();
  };

  if (!isAdmin) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Solo administradores", variant: "destructive" })}>
        <Lock className="h-3.5 w-3.5 opacity-60" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 p-0">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-semibold">Etiquetas</span>
          <Button size="sm" variant="ghost" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {creating && (
          <div className="p-2 border-b space-y-2 bg-muted/30">
            <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" />
            <div className="flex gap-1 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-6 w-6 rounded-full border-2"
                  style={{ background: c, borderColor: newColor === c ? "#000" : "transparent" }}
                />
              ))}
            </div>
            <Button size="sm" onClick={createTag} className="w-full h-7 text-xs">
              Crear
            </Button>
          </div>
        )}
        <ScrollArea className="max-h-60">
          {allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">Sin etiquetas</p>
          ) : (
            allTags.map((t) => {
              const active = current.includes(t.id);
              return (
                <div key={t.id} className="group flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50">
                  <button onClick={() => toggle(t.id)} className="flex items-center gap-2 flex-1 text-left">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    <span className="text-xs flex-1">{t.nombre}</span>
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  {t.es_permanente ? (
                    <span className="h-6 w-6 flex items-center justify-center" title="Etiqueta permanente">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </span>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeTag(t.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function TagChips({ tagIds, allTags }: { tagIds: string[] | null | undefined; allTags: LeadTag[] }) {
  if (!tagIds?.length) return null;
  const tags = tagIds.map((id) => allTags.find((t) => t.id === id)).filter(Boolean) as LeadTag[];
  if (!tags.length) return null;
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
          style={{ background: t.color }}
        >
          {t.nombre}
        </span>
      ))}
    </div>
  );
}

import { MoreVertical, MailOpen, Archive, ArchiveRestore, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadCampana } from "@/lib/supabase";

interface Props {
  isAdmin: boolean;
  contact: LeadCampana;
  onChanged: () => void;
}

export function ContactContextMenu({ isAdmin, contact, onChanged }: Props) {
  const { toast } = useToast();

  const blocked = (e: Event) => {
    e.preventDefault();
    toast({ title: "Solo administradores", variant: "destructive" });
  };

  const markUnread = async () => {
    const { data: last } = await (supabase as any)
      .from("mensajes_whatsapp")
      .select("id")
      .eq("telefono", contact.telefono)
      .eq("direccion", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.id) {
      await (supabase as any).from("mensajes_whatsapp").update({ leido: false }).eq("id", last.id);
      toast({ title: "Marcado como no leído" });
      onChanged();
    }
  };

  const toggleArchive = async () => {
    const next = !contact.archivado;
    await (supabase as any).from("leads_campana").update({ archivado: next }).eq("id", contact.id);
    toast({ title: next ? "Contacto archivado" : "Contacto restaurado" });
    onChanged();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={isAdmin ? markUnread : blocked}>
          {isAdmin ? <MailOpen className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2 opacity-60" />}
          Marcar como no leído
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={isAdmin ? toggleArchive : blocked}>
          {isAdmin ? (
            contact.archivado ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />
          ) : (
            <Lock className="h-4 w-4 mr-2 opacity-60" />
          )}
          {contact.archivado ? "Desarchivar" : "Archivar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

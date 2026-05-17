import { useState } from "react";
import { MoreVertical, MailOpen, Archive, ArchiveRestore, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadCampana } from "@/lib/supabase";

interface Props {
  isAdmin: boolean;
  contact: LeadCampana;
  onChanged: () => void;
  onDeleted?: () => void;
}

export function ContactContextMenu({ isAdmin, contact, onChanged, onDeleted }: Props) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const deleteContact = async () => {
    // Delete messages first, then the lead
    const { error: msgErr } = await (supabase as any)
      .from("mensajes_whatsapp")
      .delete()
      .eq("telefono", contact.telefono);
    if (msgErr) {
      toast({ title: "Error al borrar mensajes", description: msgErr.message, variant: "destructive" });
      return;
    }
    const { error: leadErr } = await (supabase as any)
      .from("leads_campana")
      .delete()
      .eq("id", contact.id);
    if (leadErr) {
      toast({ title: "Error al borrar contacto", description: leadErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contacto eliminado" });
    setConfirmDelete(false);
    onDeleted ? onDeleted() : onChanged();
  };

  return (
    <>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              if (!isAdmin) return blocked(e);
              e.preventDefault();
              setConfirmDelete(true);
            }}
          >
            {isAdmin ? <Trash2 className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2 opacity-60" />}
            Eliminar contacto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{contact.nombre || contact.telefono}</strong> y todos sus mensajes de WhatsApp. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

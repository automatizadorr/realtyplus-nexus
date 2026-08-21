import { useEffect, useState } from "react";
import type { LeadCampana, LeadTag } from "@/lib/supabase";
import { ContactSidebar } from "@/components/inbox/ContactSidebar";
import { ChatArea } from "@/components/inbox/ChatArea";
import { supabase } from "@/integrations/supabase/client";

// Mismo chat que /inbox (Reactivación: vista_inbox_contactos + mensajes_whatsapp,
// el canal donde Camil-AI conversa con los leads), pero embebido en la pestaña
// "Reactivación" de Mis Leads. RLS ya lo acota a los leads del vendedor — no
// hace falta filtrar nada acá, solo darle un layout de dos paneles con altura fija.
export default function ReactivacionChatTab() {
  const [selectedContact, setSelectedContact] = useState<LeadCampana | null>(null);
  const [allTags, setAllTags] = useState<LeadTag[]>([]);

  const refreshTags = async () => {
    const { data } = await (supabase as any).from("lead_tags").select("*").order("nombre");
    setAllTags((data || []) as LeadTag[]);
  };

  useEffect(() => { refreshTags(); }, []);

  const handleContactUpdate = (updated: LeadCampana) => setSelectedContact(updated);
  const handleBack = () => setSelectedContact(null);

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
        Acá llegan los leads que Camil-AI ya contactó para reactivarlos con una plantilla. Sigue la conversación y, si respondes tú,
        la IA se apaga sola para ese lead — usa el switch "IA activa/silenciada" para volver a prenderla cuando quieras.
      </p>
      <div className="flex h-[75vh] overflow-hidden rounded-lg border">
        <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
          <ContactSidebar selectedContact={selectedContact} onSelectContact={setSelectedContact} allTags={allTags} />
        </div>
        <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
          <ChatArea
            selectedContact={selectedContact}
            onContactUpdate={handleContactUpdate}
            onBack={handleBack}
            allTags={allTags}
            onTagsRefresh={refreshTags}
          />
        </div>
      </div>
    </div>
  );
}

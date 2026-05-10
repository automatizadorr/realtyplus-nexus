import { useEffect, useState } from "react";
import type { LeadCampana, LeadTag } from "@/lib/supabase";
import { ContactSidebar } from "@/components/inbox/ContactSidebar";
import { ChatArea } from "@/components/inbox/ChatArea";
import { supabase } from "@/integrations/supabase/client";

export default function Inbox() {
  const [selectedContact, setSelectedContact] = useState<LeadCampana | null>(null);
  const [allTags, setAllTags] = useState<LeadTag[]>([]);

  const refreshTags = async () => {
    const { data } = await (supabase as any).from("lead_tags").select("*").order("nombre");
    setAllTags((data || []) as LeadTag[]);
  };

  useEffect(() => {
    refreshTags();
  }, []);

  const handleContactUpdate = (updated: LeadCampana) => setSelectedContact(updated);
  const handleBack = () => setSelectedContact(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <ContactSidebar
          selectedContact={selectedContact}
          onSelectContact={setSelectedContact}
          allTags={allTags}
        />
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
  );
}

import { useState } from "react";
import type { LeadCampana } from "@/lib/supabase";
import { ContactSidebar } from "@/components/inbox/ContactSidebar";
import { ChatArea } from "@/components/inbox/ChatArea";

export default function Inbox() {
  const [selectedContact, setSelectedContact] = useState<LeadCampana | null>(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ContactSidebar
        selectedContact={selectedContact}
        onSelectContact={setSelectedContact}
      />
      <ChatArea selectedContact={selectedContact} />
    </div>
  );
}

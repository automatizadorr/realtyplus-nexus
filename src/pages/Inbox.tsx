import { useState } from "react";
import type { LeadCampana } from "@/lib/supabase";
import { ContactSidebar } from "@/components/inbox/ContactSidebar";
import { ChatArea } from "@/components/inbox/ChatArea";

export default function Inbox() {
  const [selectedContact, setSelectedContact] = useState<LeadCampana | null>(null);

  const handleContactUpdate = (updated: LeadCampana) => {
    setSelectedContact(updated);
  };

  const handleBack = () => setSelectedContact(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Mobile: show sidebar or chat, not both */}
      <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <ContactSidebar
          selectedContact={selectedContact}
          onSelectContact={setSelectedContact}
        />
      </div>
      <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        <ChatArea
          selectedContact={selectedContact}
          onContactUpdate={handleContactUpdate}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}

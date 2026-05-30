import { useState } from "react";
import { AutomationSidebar, type AutomationContact } from "@/components/automation/AutomationSidebar";
import { AutomationChatArea } from "@/components/automation/AutomationChatArea";

export default function AutomationInbox() {
  const [selectedContact, setSelectedContact] = useState<AutomationContact | null>(null);
  const handleBack = () => setSelectedContact(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <AutomationSidebar selectedContact={selectedContact} onSelectContact={setSelectedContact} />
      </div>
      <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        <AutomationChatArea selectedContact={selectedContact} onBack={handleBack} />
      </div>
    </div>
  );
}

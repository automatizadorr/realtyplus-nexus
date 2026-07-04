import { useEffect, useState } from "react";
import { AutomationSidebar, type AutomationContact } from "@/components/automation/AutomationSidebar";
import { AutomationChatArea } from "@/components/automation/AutomationChatArea";
import type { LeadTag } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";

export default function AutomationInbox() {
  const [selectedContact, setSelectedContact] = useState<AutomationContact | null>(null);
  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const handleBack = () => setSelectedContact(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).from("lead_tags").select("*").order("nombre");
      if (!cancelled) setAllTags((data || []) as LeadTag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={`${selectedContact ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0`}>
        <AutomationSidebar selectedContact={selectedContact} onSelectContact={setSelectedContact} allTags={allTags} />
      </div>
      <div className={`${selectedContact ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        <AutomationChatArea selectedContact={selectedContact} onBack={handleBack} allTags={allTags} />
      </div>
    </div>
  );
}

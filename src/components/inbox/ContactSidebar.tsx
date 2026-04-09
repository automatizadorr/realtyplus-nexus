import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LeadCampana } from "@/lib/supabase";

interface ContactSidebarProps {
  selectedContact: LeadCampana | null;
  onSelectContact: (contact: LeadCampana) => void;
}

export function ContactSidebar({ selectedContact, onSelectContact }: ContactSidebarProps) {
  const [contacts, setContacts] = useState<LeadCampana[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<LeadCampana[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("leads_campana")
        .select("id, nombre, telefono, pais, estado, campaign_id, email")
        .order("nombre", { ascending: true });

      if (data) {
        const unique = data.filter(
          (c, i, arr) => arr.findIndex((x) => x.telefono === c.telefono) === i
        ) as LeadCampana[];
        setContacts(unique);
        setFilteredContacts(unique);
      }
      setLoading(false);
    };
    fetchContacts();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter(
        (c) => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q)
      )
    );
  }, [searchQuery, contacts]);

  return (
    <div className="w-80 border-r flex flex-col bg-card">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5 text-accent" />
          <h2 className="font-bold text-foreground">Mensajes</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar contacto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm p-6">Sin contactos</p>
        ) : (
          filteredContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onSelectContact(contact)}
              className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50 ${
                selectedContact?.telefono === contact.telefono
                  ? "bg-muted border-l-2 border-l-accent"
                  : ""
              }`}
            >
              <div className="font-semibold text-sm text-foreground truncate">
                {contact.nombre || "Sin nombre"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {contact.telefono}
                {contact.estado && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide opacity-70">
                    · {contact.estado}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

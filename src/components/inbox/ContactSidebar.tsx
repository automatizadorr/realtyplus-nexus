import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Loader2, Bot, BotOff, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContactSidebarProps {
  selectedContact: LeadCampana | null;
  onSelectContact: (contact: LeadCampana) => void;
}

type FilterType = "all" | "unread" | "bot_on" | "bot_off";

export function ContactSidebar({ selectedContact, onSelectContact }: ContactSidebarProps) {
  const [contacts, setContacts] = useState<LeadCampana[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<LeadCampana[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({});
  const [lastMessageText, setLastMessageText] = useState<Record<string, string>>({});
  const [lastMessageDir, setLastMessageDir] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterType>("all");

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("leads_campana")
        .select("id, nombre, telefono, pais, estado, bot_activo")
        .order("nombre", { ascending: true });

      if (data) {
        const unique = data.filter(
          (c, i, arr) => arr.findIndex((x) => x.telefono === c.telefono) === i
        ) as LeadCampana[];
        setContacts(unique);
      }
      setLoading(false);
    };
    fetchContacts();
  }, []);

  // Fetch unread counts + last message timestamps
  useEffect(() => {
    const fetchUnreadAndTimestamps = async () => {
      const { data } = await supabase
        .from("mensajes_whatsapp")
        .select("telefono, leido, direccion, created_at, contenido")
        .order("created_at", { ascending: false });

      if (data) {
        const counts: Record<string, number> = {};
        const timestamps: Record<string, string> = {};
        const texts: Record<string, string> = {};
        const dirs: Record<string, string> = {};
        data.forEach((msg) => {
          if (msg.direccion === "inbound" && !msg.leido) {
            counts[msg.telefono] = (counts[msg.telefono] || 0) + 1;
          }
          if (!timestamps[msg.telefono]) {
            timestamps[msg.telefono] = msg.created_at || "";
            texts[msg.telefono] = msg.contenido || "";
            dirs[msg.telefono] = msg.direccion || "";
          }
        });
        setUnreadCounts(counts);
        setLastMessageAt(timestamps);
        setLastMessageText(texts);
        setLastMessageDir(dirs);
      }
    };
    fetchUnreadAndTimestamps();

    // Realtime para actualizar conteo
    const channel = supabase
      .channel("unread-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensajes_whatsapp" },
        () => fetchUnreadAndTimestamps()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Apply search + filter
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    let result = contacts.filter(
      (c) => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q)
    );

    if (filter === "unread") {
      result = result.filter((c) => (unreadCounts[c.telefono] || 0) > 0);
    } else if (filter === "bot_on") {
      result = result.filter((c) => c.bot_activo === true);
    } else if (filter === "bot_off") {
      result = result.filter((c) => c.bot_activo === false);
    }

    // Sort by most recent message (like WhatsApp/Telegram)
    result.sort((a, b) => {
      const tA = lastMessageAt[a.telefono] || "";
      const tB = lastMessageAt[b.telefono] || "";
      if (tB > tA) return 1;
      if (tA > tB) return -1;
      return 0;
    });

    setFilteredContacts(result);
  }, [searchQuery, contacts, filter, unreadCounts, lastMessageAt]);

  return (
    <div className="w-80 border-r flex flex-col bg-card">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Contactos</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredContacts.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unread">No leídos</SelectItem>
              <SelectItem value="bot_on">Bot activo</SelectItem>
              <SelectItem value="bot_off">Bot inactivo</SelectItem>
            </SelectContent>
          </Select>
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
          filteredContacts.map((contact) => {
            const unread = unreadCounts[contact.telefono] || 0;
            return (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50 ${
                  selectedContact?.telefono === contact.telefono
                    ? "bg-muted border-l-2 border-l-primary"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {contact.nombre || "Sin nombre"}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unread > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] flex items-center justify-center">
                        {unread}
                      </Badge>
                    )}
                    {contact.bot_activo ? (
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <BotOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
                  {lastMessageText[contact.telefono] ? (
                    <>
                      <span className="opacity-60">
                        {lastMessageDir[contact.telefono] === "outbound" ? "Tú: " : ""}
                      </span>
                      {lastMessageText[contact.telefono]}
                    </>
                  ) : (
                    contact.telefono
                  )}
                </p>
              </button>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}

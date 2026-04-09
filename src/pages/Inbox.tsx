import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WEBHOOK_URL = "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/crmrp";

interface Mensaje {
  id: string;
  telefono: string;
  direccion: string;
  contenido: string;
  created_at: string | null;
}

interface ContactSummary {
  telefono: string;
  lastMessage: string;
  lastTime: string;
}

export default function Inbox() {
  const [messages, setMessages] = useState<Mensaje[]>([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch all messages once, derive contacts
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("mensajes_whatsapp")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }
    if (data) setMessages(data as Mensaje[]);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Derive contacts from messages
  useEffect(() => {
    const map = new Map<string, ContactSummary>();
    for (const m of messages) {
      const existing = map.get(m.telefono);
      const time = m.created_at || "";
      if (!existing || time > existing.lastTime) {
        map.set(m.telefono, {
          telefono: m.telefono,
          lastMessage: m.contenido,
          lastTime: time,
        });
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime));
    setContacts(sorted);
  }, [messages]);

  // Filter contacts by search
  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredContacts(
      q ? contacts.filter((c) => c.telefono.includes(q)) : contacts
    );
  }, [search, contacts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("mensajes_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes_whatsapp" },
        (payload) => {
          const msg = payload.new as Mensaje;
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll on new messages or contact change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected]);

  const chatMessages = selected
    ? messages.filter((m) => m.telefono === selected)
    : [];

  const sendMessage = async () => {
    if (!text.trim() || !selected) return;
    setSending(true);
    const body = { telefono: selected, mensaje: text.trim() };
    setText("");

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-card shrink-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Chats</h2>
            <span className="ml-auto text-xs text-muted-foreground">{contacts.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-sm"
              placeholder="Buscar por teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredContacts.map((c) => (
            <button
              key={c.telefono}
              onClick={() => setSelected(c.telefono)}
              className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/60 ${
                selected === c.telefono ? "bg-muted border-l-2 border-l-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-sm text-foreground">{c.telefono}</span>
                <span className="text-[11px] text-muted-foreground">{formatTime(c.lastTime)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
            </button>
          ))}
          {filteredContacts.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">Sin conversaciones</p>
          )}
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selected ? (
          <>
            {/* Header */}
            <div className="h-14 px-4 flex items-center border-b bg-card gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {selected.slice(-2)}
              </div>
              <span className="font-semibold text-sm text-foreground">{selected}</span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2 max-w-2xl mx-auto">
                {chatMessages.map((msg) => {
                  const isOut = msg.direccion === "outbound";
                  return (
                    <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          isOut
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.contenido}</p>
                        <span
                          className={`text-[10px] mt-1 block text-right ${
                            isOut ? "text-primary-foreground/60" : "text-muted-foreground"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {chatMessages.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-16">Sin mensajes aún.</p>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t bg-card shrink-0">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  size="icon"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-14 w-14 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Selecciona una conversación</p>
              <p className="text-sm mt-1">para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

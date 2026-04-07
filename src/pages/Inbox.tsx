import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Search } from "lucide-react";
import { supabase, type MensajeWhatsapp, type LeadCampana } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function Inbox() {
  const [contacts, setContacts] = useState<LeadCampana[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<LeadCampana[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<LeadCampana | null>(null);
  const [messages, setMessages] = useState<MensajeWhatsapp[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase.from("leads_campana").select("*").order("nombre");
      if (data) {
        // Deduplicate by phone
        const unique = data.filter((c, i, arr) => arr.findIndex((x) => x.telefono === c.telefono) === i);
        setContacts(unique);
        setFilteredContacts(unique);
      }
    };
    fetchContacts();
  }, []);

  // Filter contacts
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter((c) => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q))
    );
  }, [searchQuery, contacts]);

  // Fetch messages for selected contact
  useEffect(() => {
    if (!selectedContact) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("mensajes_whatsapp")
        .select("*")
        .like("telefono", `%${selectedContact.telefono}%`)
        .order("fecha", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${selectedContact.telefono}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes_whatsapp",
        },
        (payload) => {
          const msg = payload.new as MensajeWhatsapp;
          if (msg.telefono?.includes(selectedContact.telefono)) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;
    setSending(true);

    try {
      const { error } = await supabase.from("mensajes_whatsapp").insert({
        telefono: selectedContact.telefono,
        mensaje: newMessage,
        direccion: "outbound",
        fecha: new Date().toISOString(),
        estado: "enviado",
      });

      if (error) throw error;

      // TODO: Disparar webhook POST a n8n para envío real
      // await fetch('https://n8n.example.com/webhook/whatsapp-send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ telefono: selectedContact.telefono, mensaje: newMessage }),
      // });
      console.log("[n8n Webhook] Preparado para enviar:", { telefono: selectedContact.telefono, mensaje: newMessage });

      setNewMessage("");
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Contact list */}
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
          {filteredContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-muted/50 ${
                selectedContact?.telefono === contact.telefono ? "bg-muted border-l-2 border-l-accent" : ""
              }`}
            >
              <div className="font-medium text-sm text-foreground truncate">{contact.nombre || "Sin nombre"}</div>
              <div className="text-xs text-muted-foreground">{contact.telefono}</div>
            </button>
          ))}
          {filteredContacts.length === 0 && (
            <p className="text-center text-muted-foreground text-sm p-6">Sin contactos</p>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 flex items-center border-b bg-card gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {selectedContact.nombre?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{selectedContact.nombre}</div>
                <div className="text-xs text-muted-foreground">{selectedContact.telefono}</div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direccion === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                        msg.direccion === "outbound"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p>{msg.mensaje}</p>
                      <span className={`text-[10px] mt-1 block ${msg.direccion === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.fecha).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-12">No hay mensajes con este contacto.</p>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t bg-card">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="bg-accent text-accent-foreground hover:bg-brand-red-light">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Selecciona un contacto</p>
              <p className="text-sm">para ver la conversación</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

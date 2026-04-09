import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LeadCampana } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  telefono: string;
  contenido: string;
  direccion: string;
  created_at: string;
  leido: boolean | null;
}

interface ChatAreaProps {
  selectedContact: LeadCampana | null;
}

export function ChatArea({ selectedContact }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch messages when contact changes
  useEffect(() => {
    if (!selectedContact?.telefono) {
      setMessages([]);
      return;
    }

    const phone = selectedContact.telefono;

    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("mensajes_whatsapp")
        .select("*")
        .eq("telefono", phone)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
      setLoading(false);
    };
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${phone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes_whatsapp",
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.telefono === phone) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact?.telefono]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact?.telefono) return;
    setSending(true);

    try {
      const { error } = await supabase.from("mensajes_whatsapp").insert({
        telefono: selectedContact.telefono,
        contenido: newMessage,
        direccion: "outbound",
      });

      if (error) throw error;

      // TODO: POST al webhook de n8n para envío real
      console.log("[n8n Webhook] Preparado para enviar:", {
        telefono: selectedContact.telefono,
        mensaje: newMessage,
      });

      setNewMessage("");
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Selecciona un contacto</p>
          <p className="text-sm">para ver la conversación</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direccion === "outbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                    msg.direccion === "outbound"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <p>{msg.contenido}</p>
                  <span
                    className={`text-[10px] mt-1 block ${
                      msg.direccion === "outbound"
                        ? "text-primary-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {messages.length === 0 && !loading && (
              <p className="text-center text-muted-foreground text-sm py-12">
                No hay mensajes con este contacto.
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
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
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-accent text-accent-foreground hover:bg-accent/80"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

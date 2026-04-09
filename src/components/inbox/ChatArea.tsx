import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send, Loader2, Bot, BotOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana, MensajeWhatsapp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  selectedContact: LeadCampana | null;
  onContactUpdate?: (contact: LeadCampana) => void;
}

export function ChatArea({ selectedContact, onContactUpdate }: ChatAreaProps) {
  const [messages, setMessages] = useState<MensajeWhatsapp[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      if (data) setMessages(data as MensajeWhatsapp[]);
      setLoading(false);
    };
    fetchMessages();

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
          const msg = payload.new as MensajeWhatsapp;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleBot = async () => {
    if (!selectedContact) return;
    setTogglingBot(true);
    const newVal = !selectedContact.bot_activo;
    const { error } = await supabase
      .from("leads_campana")
      .update({ bot_activo: newVal })
      .eq("id", selectedContact.id);

    if (!error && onContactUpdate) {
      onContactUpdate({ ...selectedContact, bot_activo: newVal });
    }
    setTogglingBot(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact?.telefono) return;
    setSending(true);

    try {
      const { error } = await supabase.from("mensajes_whatsapp").insert({
        telefono: selectedContact.telefono,
        contenido: newMessage,
        direccion: "outbound",
        autor: "admin",
      });

      if (error) throw error;

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
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">{selectedContact.nombre}</div>
          <div className="text-xs text-muted-foreground">{selectedContact.telefono}</div>
        </div>
        {/* Bot toggle */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedContact.bot_activo ? (
            <Bot className="h-4 w-4 text-primary" />
          ) : (
            <BotOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="hidden sm:inline">
            {selectedContact.bot_activo ? "IA activa" : "IA silenciada"}
          </span>
          <Switch
            checked={!!selectedContact.bot_activo}
            onCheckedChange={toggleBot}
            disabled={togglingBot}
            className="scale-90"
          />
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
            {messages.map((msg) => {
              const isOutbound = msg.direccion === "outbound";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                      isOutbound
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {/* Show autor label for outbound */}
                    {isOutbound && msg.autor && (
                      <span className={`text-[10px] font-medium block mb-0.5 ${
                        msg.autor === "bot"
                          ? "text-primary-foreground/70"
                          : "text-primary-foreground/70"
                      }`}>
                        {msg.autor === "bot" ? "🤖 Bot" : "👤 Admin"}
                      </span>
                    )}
                    <p>{msg.contenido}</p>
                    <span
                      className={`text-[10px] mt-1 block ${
                        isOutbound
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
              );
            })}
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
            size="icon"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

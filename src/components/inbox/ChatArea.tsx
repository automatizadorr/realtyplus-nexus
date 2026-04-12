import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send, Loader2, Bot, BotOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana, MensajeWhatsapp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAreaProps {
  selectedContact: LeadCampana | null;
  onContactUpdate?: (contact: LeadCampana) => void;
  onBack?: () => void;
}

export function ChatArea({ selectedContact, onContactUpdate, onBack }: ChatAreaProps) {
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

      // Marcar como leídos los mensajes inbound no leídos
      await supabase
        .from("mensajes_whatsapp")
        .update({ leido: true })
        .eq("telefono", phone)
        .eq("direccion", "inbound")
        .eq("leido", false);
    };
    fetchMessages();

    // Suscripción Realtime para animar mensajes entrantes al instante
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
            setMessages((prev) => {
              // Evitar duplicados visuales si el mensaje ya está en estado
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        },
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
    const { error } = await supabase.from("leads_campana").update({ bot_activo: newVal }).eq("id", selectedContact.id);

    if (!error && onContactUpdate) {
      onContactUpdate({ ...selectedContact, bot_activo: newVal });
    }
    setTogglingBot(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact?.telefono) return;
    setSending(true);

    try {
      // 1. Apagado automático del bot por intervención humana
      if (selectedContact.bot_activo) {
        await supabase.from("leads_campana").update({ bot_activo: false }).eq("id", selectedContact.id);

        if (onContactUpdate) {
          onContactUpdate({ ...selectedContact, bot_activo: false });
        }
      }

      // 2. Disparo del Payload al Webhook de n8n
      const payload = {
        telefono: selectedContact.telefono,
        mensaje: newMessage,
        autor: "admin",
      };

      const response = await fetch("https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/crmrp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("El Webhook rechazó la conexión.");
      }

      // NOTA: Ya no hacemos insert manual aquí. n8n recibe el webhook,
      // guarda en la BD y Supabase Realtime lo inyectará en la pantalla automáticamente.
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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-center text-muted-foreground"
        >
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Selecciona un contacto</p>
          <p className="text-sm">para ver la conversación</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="h-14 px-2 sm:px-4 flex items-center border-b bg-card gap-2 sm:gap-3 shadow-sm z-10">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-inner shrink-0">
          {selectedContact.nombre?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">{selectedContact.nombre}</div>
          <div className="text-xs text-muted-foreground">{selectedContact.telefono}</div>
        </div>

        {/* Bot toggle animado */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedContact.bot_activo ? "bot-on" : "bot-off"}
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              {selectedContact.bot_activo ? (
                <Bot className="h-4 w-4 text-emerald-500" />
              ) : (
                <BotOff className="h-4 w-4 text-rose-500" />
              )}
            </motion.div>
          </AnimatePresence>
          <span className="hidden sm:inline font-medium">
            {selectedContact.bot_activo ? "IA activa" : "IA silenciada"}
          </span>
          <Switch
            checked={!!selectedContact.bot_activo}
            onCheckedChange={toggleBot}
            disabled={togglingBot}
            className="scale-90 data-[state=checked]:bg-emerald-500"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-slate-50/50 dark:bg-zinc-950/50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isOutbound = msg.direccion === "outbound";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.4,
                      type: "spring",
                      bounce: 0.4,
                      damping: 20,
                    }}
                    className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isOutbound
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-white dark:bg-zinc-900 border border-border text-foreground rounded-bl-sm"
                      }`}
                    >
                      {isOutbound && msg.autor && (
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase block mb-1 ${
                            msg.autor === "bot" ? "text-emerald-300" : "text-blue-300"
                          }`}
                        >
                          {msg.autor === "bot" ? "🤖 Bot" : "👤 Admin"}
                        </span>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                      <div
                        className={`text-[10px] mt-1.5 flex justify-end ${
                          isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {messages.length === 0 && !loading && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-muted-foreground text-sm py-12"
              >
                Inicia la conversación con este lead.
              </motion.p>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input de Envío */}
      <div className="p-3 bg-card border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="flex gap-2 max-w-3xl mx-auto items-end">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-xl bg-muted/50 focus-visible:ring-primary focus-visible:bg-background transition-all border-transparent focus-visible:border-primary"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              size="icon"
              className="rounded-xl h-10 w-10 shadow-md"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

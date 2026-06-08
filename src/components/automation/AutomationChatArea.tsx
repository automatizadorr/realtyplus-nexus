import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, ArrowLeft, Search, ArrowDown, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAuth } from "@/contexts/AuthContext";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { QuickRepliesPopover } from "@/components/inbox/QuickRepliesPopover";
import { EmojiPickerButton } from "@/components/inbox/EmojiPickerButton";
import { FormattedText } from "@/lib/whatsappFormat";
import { countryFlag } from "@/lib/countryFlag";
import type { AutomationContact } from "./AutomationSidebar";

interface MensajeAuto {
  id: string;
  telefono: string;
  contenido: string;
  direccion: "inbound" | "outbound";
  created_at: string;
  leido?: boolean | null;
  campaign_name?: string | null;
  dia_secuencia?: number | null;
  estado_envio?: string | null;
}

interface Props {
  selectedContact: AutomationContact | null;
  onBack?: () => void;
}


const PAGE_SIZE = 50;

function estadoColor(estado: string | null | undefined) {
  if (estado === "enviado") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (estado === "respondido") return "bg-blue-500/15 text-blue-600 border-blue-500/30";
  if (estado === "fallido") return "bg-rose-500/15 text-rose-600 border-rose-500/30";
  return "bg-amber-500/15 text-amber-600 border-amber-500/30";
}

export function AutomationChatArea({ selectedContact, onBack }: Props) {
  const [messages, setMessages] = useState<MensajeAuto[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIdx, setSearchIdx] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [idContacto, setIdContacto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const lastInboundIdRef = useRef<string | null>(null);
  const oldestCreatedAtRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(true);
  const phoneRef = useRef<string>("");
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();

  useEffect(() => {
    if (!selectedContact?.telefono) {
      setMessages([]);
      return;
    }
    const phone = selectedContact.telefono;
    phoneRef.current = phone;

    const fetchMessages = async () => {
      setLoading(true);
      hasMoreOlderRef.current = true;
      setHasMoreOlder(true);
      oldestCreatedAtRef.current = null;
      const { data } = await (supabase as any)
        .from("mensajes_automatizacion")
        .select("id, telefono, contenido, direccion, created_at, leido, campaign_name, dia_secuencia, estado_envio")
        .eq("telefono", phone)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const ordered = (data || []).slice().reverse() as MensajeAuto[];
      setMessages(ordered);
      if (ordered.length > 0) oldestCreatedAtRef.current = ordered[0].created_at;
      if ((data || []).length < PAGE_SIZE) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
      }
      setLoading(false);

      await (supabase as any)
        .from("mensajes_automatizacion")
        .update({ leido: true })
        .eq("telefono", phone)
        .eq("direccion", "inbound")
        .eq("leido", false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`auto-messages-${phone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes_automatizacion" },
        (payload) => {
          const msg = payload.new as MensajeAuto;
          if (msg.telefono === phone) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              if (msg.direccion === "inbound" && !isAtBottomRef.current) {
                setUnreadCount((c) => c + 1);
                lastInboundIdRef.current = msg.id;
              }
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
    setUnreadCount(0);
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    initialLoadRef.current = true;
    lastInboundIdRef.current = null;
    setHighlightId(null);
  }, [selectedContact?.telefono]);

  // id_contacto desde leads_escaner
  useEffect(() => {
    let cancelled = false;
    setIdContacto(null);
    if (!selectedContact?.telefono) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("leads_escaner")
        .select("id_contacto")
        .eq("telefono", selectedContact.telefono)
        .maybeSingle();
      if (!cancelled && data?.id_contacto) setIdContacto(String(data.id_contacto));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContact?.telefono]);

  const loadOlder = async () => {
    if (loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const phone = phoneRef.current;
    const cursor = oldestCreatedAtRef.current;
    if (!phone || !cursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const viewport = messagesEndRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const prevHeight = viewport?.scrollHeight ?? 0;
    const prevTop = viewport?.scrollTop ?? 0;

    const { data } = await (supabase as any)
      .from("mensajes_automatizacion")
      .select("id, telefono, contenido, direccion, created_at, leido, campaign_name, dia_secuencia, estado_envio")
      .eq("telefono", phone)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const older = (data || []).slice().reverse() as MensajeAuto[];
    if (older.length > 0) {
      oldestCreatedAtRef.current = older[0].created_at;
      setMessages((prev) => {
        const ex = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ex.has(m.id)), ...prev];
      });
      requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop = prevTop + (viewport.scrollHeight - prevHeight);
      });
    }
    if ((data || []).length < PAGE_SIZE) {
      hasMoreOlderRef.current = false;
      setHasMoreOlder(false);
    }
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  };

  useEffect(() => {
    const el = messagesEndRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance < 80;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) {
        setUnreadCount(0);
        lastInboundIdRef.current = null;
      }
      if (el.scrollTop < 120 && hasMoreOlderRef.current && !loadingOlderRef.current) loadOlder();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [selectedContact?.telefono, loading]);

  useEffect(() => {
    if (searchOpen && searchQuery.trim()) return;
    if (messages.length === 0) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        isAtBottomRef.current = true;
        setIsAtBottom(true);
      });
      return;
    }
    if (isAtBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchOpen, searchQuery]);

  const scrollToBottom = () => {
    const targetId = lastInboundIdRef.current;
    const targetEl = targetId ? document.getElementById(`amsg-${targetId}`) : null;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(targetId);
      window.setTimeout(() => setHighlightId((c) => (c === targetId ? null : c)), 1800);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    setUnreadCount(0);
    lastInboundIdRef.current = null;
  };

  const matchIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.contenido?.toLowerCase().includes(q)).map((m) => m.id);
  }, [searchQuery, messages]);

  useEffect(() => setSearchIdx(0), [searchQuery]);
  useEffect(() => {
    if (matchIds.length > 0) {
      document
        .getElementById(`amsg-${matchIds[searchIdx]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchIdx, matchIds]);

  const insertText = (text: string) => {
    setNewMessage((prev) => (prev ? prev + text : text));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const ultimoDia = useMemo(
    () => messages.reduce((max, m) => Math.max(max, m.dia_secuencia || 0), 0),
    [messages],
  );
  const ultimoEstado = useMemo(
    () => (messages.length > 0 ? messages[messages.length - 1].estado_envio : null),
    [messages],
  );

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact?.telefono) return;
    setSending(true);
    try {
      const contenido = newMessage;
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("mensajes_automatizacion")
        .insert({
          telefono: selectedContact.telefono,
          nombre: selectedContact.nombre,
          pais: selectedContact.pais,
          campaign_name: selectedContact.campaign_name,
          contenido,
          direccion: "outbound",
          canal: "whatsapp",
          user_id: user?.id,
          dia_secuencia: ultimoDia + 1,
          estado_envio: "enviado",
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (inserted) {
        const newMsg = inserted as MensajeAuto;
        setMessages((prev) => (prev.find((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      }
      setNewMessage("");

      supabase.functions.invoke("send-n8n-webhook", {
        body: {
          target: "primer_contacto",
          payload: {
            tipo: "respuesta_manual",
            telefono: selectedContact.telefono,
            nombre: selectedContact.nombre,
            pais: selectedContact.pais,
            campaign_name: selectedContact.campaign_name,
            contenido,
            user_id: user?.id,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch((e) => console.warn("Webhook warning:", e));
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
          <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Selecciona una conversación</p>
          <p className="text-sm">para ver los mensajes automatizados</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full min-w-0">
      <div className="flex-1 flex flex-col bg-background h-full min-w-0">
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
            <div className="font-semibold text-sm text-foreground truncate">{selectedContact.nombre || "Sin nombre"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{selectedContact.telefono}</span>
              {selectedContact.pais && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>{countryFlag(selectedContact.pais)}</span>
                  <span>{selectedContact.pais}</span>
                </span>
              )}
              {idContacto && (
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-foreground/80">
                  ID: {idContacto}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {selectedContact.campaign_name && (
                <Badge variant="outline" className="h-4 px-1 text-[10px] bg-accent/40 border-accent/40">
                  {selectedContact.campaign_name}
                </Badge>
              )}
              {ultimoDia > 0 && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  Día {ultimoDia}
                </Badge>
              )}
              {ultimoEstado && (
                <Badge variant="outline" className={`h-4 px-1 text-[10px] ${estadoColor(ultimoEstado)}`}>
                  {ultimoEstado}
                </Badge>
              )}
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>

        {searchOpen && (
          <ChatSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            matches={matchIds.length}
            current={searchIdx}
            onPrev={() => setSearchIdx((i) => (i - 1 + matchIds.length) % matchIds.length)}
            onNext={() => setSearchIdx((i) => (i + 1) % matchIds.length)}
            onClose={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          />
        )}

        {/* Messages */}
        <div className="flex-1 relative min-h-0">
          <ScrollArea className="h-full p-4 bg-slate-50/50 dark:bg-zinc-950/50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto pb-4">
                {hasMoreOlder && (
                  <div className="flex items-center justify-center py-2">
                    {loadingOlder ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        onClick={loadOlder}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cargar mensajes anteriores
                      </button>
                    )}
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => {
                    const isOutbound = msg.direccion === "outbound";
                    const isCurrentMatch = matchIds[searchIdx] === msg.id;
                    const isHighlighted = highlightId === msg.id;
                    const msgDate = new Date(msg.created_at);
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDaySep =
                      !prevMsg || (prevMsg.dia_secuencia || 0) !== (msg.dia_secuencia || 0);
                    return (
                      <div key={msg.id}>
                        {showDaySep && msg.dia_secuencia ? (
                          <div className="flex items-center justify-center my-3">
                            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                              Día {msg.dia_secuencia}
                            </span>
                          </div>
                        ) : null}
                        <motion.div
                          id={`amsg-${msg.id}`}
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.4, type: "spring", bounce: 0.4, damping: 20 }}
                          className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-shadow ${
                              isOutbound
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-white dark:bg-zinc-900 border border-border text-foreground rounded-bl-sm"
                            } ${isCurrentMatch ? "ring-2 ring-yellow-400" : ""} ${
                              isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""
                            }`}
                          >
                            {msg.contenido && <FormattedText text={msg.contenido} highlight={searchQuery} />}
                            <div
                              className={`text-[10px] mt-1.5 flex justify-end gap-1 ${
                                isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              <span>
                                {msgDate.toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                })}
                              </span>
                              <span>·</span>
                              <span>
                                {msgDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </AnimatePresence>
                {messages.length === 0 && !loading && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground text-sm py-12"
                  >
                    Aún no hay mensajes en esta conversación.
                  </motion.p>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <AnimatePresence>
            {!isAtBottom && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
              >
                <Button
                  onClick={scrollToBottom}
                  size="sm"
                  className="rounded-full shadow-lg gap-2 h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <ArrowDown className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="font-semibold">
                      {unreadCount} nuevo{unreadCount > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span>Ir al final</span>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="p-3 bg-card border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="flex gap-1 max-w-3xl mx-auto items-end">
            <QuickRepliesPopover isAdmin={isAdmin} onPick={insertText} contactName={selectedContact.nombre || ""} />
            <EmojiPickerButton onPick={insertText} />
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Escribe un mensaje... (*negrita* _cursiva_ ~tachado~)"
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
    </div>
  );
}

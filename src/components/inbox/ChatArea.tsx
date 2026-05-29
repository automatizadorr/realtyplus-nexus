import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send, Loader2, Bot, BotOff, ArrowLeft, Search, StickyNote, X, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana, MensajeWhatsapp, LeadTag } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ChatSearchBar } from "./ChatSearchBar";
import { QuickRepliesPopover } from "./QuickRepliesPopover";
import { EmojiPickerButton } from "./EmojiPickerButton";
import { AttachmentButton } from "./AttachmentButton";
import { MediaBubble } from "./MediaBubble";
import { NotesPanel } from "./NotesPanel";
import { TagsButton, TagChips } from "./TagsManager";
import { FormattedText } from "@/lib/whatsappFormat";

interface ChatAreaProps {
  selectedContact: LeadCampana | null;
  onContactUpdate?: (contact: LeadCampana) => void;
  onBack?: () => void;
  allTags: LeadTag[];
  onTagsRefresh: () => void;
}

export function ChatArea({ selectedContact, onContactUpdate, onBack, allTags, onTagsRefresh }: ChatAreaProps) {
  const [messages, setMessages] = useState<MensajeWhatsapp[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIdx, setSearchIdx] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [highlightId, setHighlightId] = useState<string | number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [idContacto, setIdContacto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const isAtTopRef = useRef(true);
  const lastInboundIdRef = useRef<string | number | null>(null);
  const oldestCreatedAtRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(true);
  const phoneBaseRef = useRef<string>("");
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();


  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!selectedContact?.telefono) {
      setMessages([]);
      return;
    }

    const phone = selectedContact.telefono;
    const normalize = (t?: string | null) => (t || "").split("@")[0];
    const phoneBase = normalize(phone);
    phoneBaseRef.current = phoneBase;

    const fetchMessages = async () => {
      setLoading(true);
      hasMoreOlderRef.current = true;
      setHasMoreOlder(true);
      oldestCreatedAtRef.current = null;
      // Load latest PAGE_SIZE messages, descending then reverse for ASC display
      const { data } = await supabase
        .from("mensajes_whatsapp")
        .select("id, telefono, contenido, direccion, autor, leido, created_at, media_url, media_type")
        .or(`telefono.eq.${phoneBase},telefono.like.${phoneBase}@%`)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const ordered = (data || []).slice().reverse() as MensajeWhatsapp[];
      setMessages(ordered);
      if (ordered.length > 0) oldestCreatedAtRef.current = ordered[0].created_at as any;
      if ((data || []).length < PAGE_SIZE) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
      }
      setLoading(false);

      await supabase
        .from("mensajes_whatsapp")
        .update({ leido: true })
        .or(`telefono.eq.${phoneBase},telefono.like.${phoneBase}@%`)
        .eq("direccion", "inbound")
        .eq("leido", false);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages-${phoneBase}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes_whatsapp" },
        (payload) => {
          const msg = payload.new as MensajeWhatsapp;
          if (normalize(msg.telefono) === phoneBase) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              if (msg.direccion === "inbound" && !isAtTopRef.current) {
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

  // Reset unread/scroll state when switching contacts
  useEffect(() => {
    setUnreadCount(0);
    setIsAtTop(true);
    isAtTopRef.current = true;
    lastInboundIdRef.current = null;
    setHighlightId(null);
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [selectedContact?.telefono]);


  // Load id_contacto for the selected contact
  useEffect(() => {
    let cancelled = false;
    setIdContacto(null);
    if (!selectedContact?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("leads_campana")
        .select("id_contacto")
        .eq("id", selectedContact.id)
        .maybeSingle();
      if (!cancelled && data?.id_contacto) setIdContacto(String(data.id_contacto));
    })();
    return () => { cancelled = true; };
  }, [selectedContact?.id]);

  const loadOlder = async () => {
    if (loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const phoneBase = phoneBaseRef.current;
    const cursor = oldestCreatedAtRef.current;
    if (!phoneBase || !cursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const { data } = await supabase
      .from("mensajes_whatsapp")
      .select("id, telefono, contenido, direccion, autor, leido, created_at, media_url, media_type")
      .or(`telefono.eq.${phoneBase},telefono.like.${phoneBase}@%`)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const older = (data || []).slice().reverse() as MensajeWhatsapp[];
    if (older.length > 0) {
      oldestCreatedAtRef.current = older[0].created_at as any;
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !existing.has(m.id)), ...prev];
      });
      // Older messages are appended at the bottom of the reversed view,
      // so scrollTop stays naturally stable — no adjustment needed.
    }
    if ((data || []).length < PAGE_SIZE) {
      hasMoreOlderRef.current = false;
      setHasMoreOlder(false);
    }
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  };


  // Attach scroll listener to the radix viewport
  useEffect(() => {
    const el = messagesEndRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    scrollViewportRef.current = el;
    const onScroll = () => {
      const atTop = el.scrollTop < 80;
      isAtTopRef.current = atTop;
      setIsAtTop(atTop);
      if (atTop) {
        setUnreadCount(0);
        lastInboundIdRef.current = null;
      }
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 120 && hasMoreOlderRef.current && !loadingOlderRef.current) {
        loadOlder();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [selectedContact?.telefono, loading]);

  // Auto-scroll to top when a new message arrives and user is already at top
  useEffect(() => {
    if (searchOpen && searchQuery.trim()) return;
    const el = scrollViewportRef.current;
    if (el && isAtTopRef.current) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [messages, searchOpen, searchQuery]);

  const scrollToTop = () => {
    const targetId = lastInboundIdRef.current;
    const targetEl = targetId != null ? document.getElementById(`msg-${targetId}`) : null;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(targetId);
      window.setTimeout(() => setHighlightId((cur) => (cur === targetId ? null : cur)), 1800);
    } else {
      scrollViewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    setUnreadCount(0);
    lastInboundIdRef.current = null;
  };


  // Search match indices
  const matchIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.contenido?.toLowerCase().includes(q)).map((m) => m.id);
  }, [searchQuery, messages]);

  useEffect(() => {
    setSearchIdx(0);
  }, [searchQuery]);

  useEffect(() => {
    if (matchIds.length > 0) {
      const id = matchIds[searchIdx];
      document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchIdx, matchIds]);

  const toggleBot = async () => {
    if (!selectedContact) return;
    setTogglingBot(true);
    const newVal = !selectedContact.bot_activo;
    const { error } = await supabase.from("leads_campana").update({ bot_activo: newVal }).eq("id", selectedContact.id);
    if (!error && onContactUpdate) onContactUpdate({ ...selectedContact, bot_activo: newVal });
    setTogglingBot(false);
  };

  const insertText = (text: string) => {
    setNewMessage((prev) => (prev ? prev + text : text));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !pendingMedia) || !selectedContact?.telefono) return;
    setSending(true);

    try {
      if (selectedContact.bot_activo) {
        await supabase.from("leads_campana").update({ bot_activo: false }).eq("id", selectedContact.id);
        if (onContactUpdate) onContactUpdate({ ...selectedContact, bot_activo: false });
      }

      const contenido = newMessage;
      const media = pendingMedia;

      // Optimistic insert into mensajes_whatsapp
      const { data: inserted, error: insertError } = await supabase
        .from("mensajes_whatsapp")
        .insert({
          telefono: selectedContact.telefono,
          contenido,
          direccion: "outbound",
          autor: "admin",
          leido: true,
          media_url: media?.url ?? null,
          media_type: media?.type ?? null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (inserted) {
        const newMsg = inserted as MensajeWhatsapp;
        setMessages((prev) => (prev.find((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      }

      setNewMessage("");
      setPendingMedia(null);

      const payload: Record<string, any> = {
        telefono: selectedContact.telefono,
        mensaje: contenido,
        autor: "admin",
      };
      if (media) {
        payload.media_url = media.url;
        payload.media_type = media.type;
      }

      const response = await fetch("https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/crmrp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("El Webhook rechazó la conexión.");
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
            <div className="font-semibold text-sm text-foreground truncate">{selectedContact.nombre}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{selectedContact.telefono}</span>
              {idContacto && (
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-foreground/80">
                  ID: {idContacto}
                </span>
              )}
            </div>
            <TagChips tagIds={selectedContact.tag_ids} allTags={allTags} />
          </div>

          <TagsButton
            isAdmin={isAdmin}
            contact={selectedContact}
            allTags={allTags}
            onChange={(ids) => onContactUpdate?.({ ...selectedContact, tag_ids: ids })}
            onTagsRefresh={onTagsRefresh}
          />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${notesOpen ? "text-primary" : ""}`}
            onClick={() => setNotesOpen((v) => !v)}
          >
            <StickyNote className="h-3.5 w-3.5" />
          </Button>

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
                {(() => {
                  const displayed = [...messages].slice().reverse();
                  return (
                    <>
                      <AnimatePresence initial={false}>
                        {displayed.map((msg, idx) => {
                          const isOutbound = msg.direccion === "outbound";
                          const isCurrentMatch = matchIds[searchIdx] === msg.id;
                          const isHighlighted = highlightId === msg.id;
                          const msgDate = new Date(msg.created_at);
                          // In reversed order, newer message sits above (idx-1).
                          // Show date separator at the top of a day's group.
                          const prevDisplayed = idx > 0 ? displayed[idx - 1] : null;
                          const showDateSep =
                            !prevDisplayed ||
                            new Date(prevDisplayed.created_at).toDateString() !== msgDate.toDateString();
                          const today = new Date();
                          const yesterday = new Date();
                          yesterday.setDate(today.getDate() - 1);
                          let dateLabel = msgDate.toLocaleDateString("es-ES", {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          });
                          if (msgDate.toDateString() === today.toDateString()) dateLabel = "Hoy";
                          else if (msgDate.toDateString() === yesterday.toDateString()) dateLabel = "Ayer";
                          return (
                            <div key={msg.id}>
                              {showDateSep && (
                                <div className="flex items-center justify-center my-3">
                                  <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                                    {dateLabel}
                                  </span>
                                </div>
                              )}
                              <motion.div
                                id={`msg-${msg.id}`}
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.4, type: "spring", bounce: 0.4, damping: 20 }}
                                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-shadow ${
                                    isOutbound
                                      ? "bg-primary text-primary-foreground rounded-br-sm"
                                      : "bg-white dark:bg-zinc-900 border border-border text-foreground rounded-bl-sm"
                                  } ${isCurrentMatch ? "ring-2 ring-yellow-400" : ""} ${isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""}`}
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
                                  {msg.media_url && (
                                    <div className="mb-1.5">
                                      <MediaBubble url={msg.media_url} type={msg.media_type} />
                                    </div>
                                  )}
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
                                      {msgDate.toLocaleTimeString("es-ES", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                      </AnimatePresence>
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
                      {!hasMoreOlder && messages.length > 0 && (() => {
                        const first = messages[0];
                        const startedByBot = first.direccion === "outbound" && first.autor === "bot";
                        return (
                          <div className="flex flex-col items-center gap-1 py-2">
                            {startedByBot ? (
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Bot className="h-3 w-3" />
                                Conversación iniciada por IA ·{" "}
                                {new Date(first.created_at).toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground/60">
                                Inicio de la conversación
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
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


          {/* Floating new-messages pill */}
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

        {/* Pending media preview */}
        {pendingMedia && (
          <div className="px-3 py-2 bg-muted/40 border-t flex items-center gap-2 text-xs">
            <span className="font-medium">Adjunto listo:</span>
            <span className="truncate flex-1">{pendingMedia.type}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingMedia(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-card border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="flex gap-1 max-w-3xl mx-auto items-end">
            <QuickRepliesPopover isAdmin={isAdmin} onPick={insertText} contactName={selectedContact.nombre} />
            <EmojiPickerButton onPick={insertText} />
            <AttachmentButton isAdmin={isAdmin} onUploaded={(url, type) => setPendingMedia({ url, type })} />
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
                disabled={(!newMessage.trim() && !pendingMedia) || sending}
                size="icon"
                className="rounded-xl h-10 w-10 shadow-md"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      <NotesPanel isAdmin={isAdmin} leadId={selectedContact.id} open={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}

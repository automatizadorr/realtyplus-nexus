import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, ArrowLeft, Search, ArrowDown, Zap, Clock, Check, CheckCheck, AlertCircle, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/hooks/use-is-admin";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { QuickRepliesPopover } from "@/components/inbox/QuickRepliesPopover";
import { EmojiPickerButton } from "@/components/inbox/EmojiPickerButton";
import { AttachmentButton } from "@/components/inbox/AttachmentButton";
import { MediaBubble } from "@/components/inbox/MediaBubble";
import { FormattedText } from "@/lib/whatsappFormat";
import { tickFase, estadoAcuse } from "@/lib/acuse";
import { countryFlag } from "@/lib/countryFlag";
import { TagChips } from "@/components/inbox/TagsManager";
import type { LeadTag } from "@/lib/supabase";
import type { AutomationContact } from "./AutomationSidebar";

interface MensajeAuto {
  id: string;
  telefono: string;
  contenido: string;
  direccion: "inbound" | "outbound";
  created_at: string;
  sort_ts?: string | null;
  seq?: number | null;
  leido?: boolean | null;
  campaign_name?: string | null;
  dia_secuencia?: number | null;
  estado_envio?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

interface Props {
  selectedContact: AutomationContact | null;
  onBack?: () => void;
  allTags?: LeadTag[];
}


const PAGE_SIZE = 50;



export function AutomationChatArea({ selectedContact, onBack, allTags = [] }: Props) {
  const [messages, setMessages] = useState<MensajeAuto[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string } | null>(null);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastInboundIdRef = useRef<string | null>(null);
  const oldestCreatedAtRef = useRef<string | null>(null);
  const oldestSeqRef = useRef<number | null>(null);
  const oldestSortTsRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(true);
  const phoneRef = useRef<string>("");
  const realtimeRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const { isAdmin, canWrite } = useRole();

  useEffect(() => {
    if (!selectedContact?.telefono) {
      setMessages([]);
      return;
    }
    const phone = selectedContact.telefono;
    const phoneKey = phone.replace(/[^0-9]/g, "");
    phoneRef.current = phone;

    const fetchMessages = async () => {
      setLoading(true);
      hasMoreOlderRef.current = true;
      setHasMoreOlder(true);
      oldestCreatedAtRef.current = null;
      oldestSeqRef.current = null;
      oldestSortTsRef.current = null;
      const { data } = await (supabase as any)
        .from("vista_mensajes_automatizacion")
        .select("*")
        .eq("phone_key", phoneKey)
        .order("sort_ts", { ascending: false })
        .limit(PAGE_SIZE);
      const ordered = (data || []).slice().reverse() as MensajeAuto[];
      setMessages(ordered);
      if (ordered.length > 0) {
        oldestSortTsRef.current = ordered[0].sort_ts ?? null;
      }
      if ((data || []).length < PAGE_SIZE) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
      }
      setLoading(false);

      // Marca leído por phone_key en AMBAS tablas (mensajes_automatizacion +
      // mensajes_whatsapp), ya que la conversación de Oportunidades unifica las
      // dos. RPC en la migración 20260704120000.
      await (supabase as any).rpc("marcar_leidos_conversacion", { p_phone_key: phoneKey });
    };
    fetchMessages();

    const handleIncomingMsg = (raw: Record<string, unknown>, table: "mensajes_automatizacion" | "mensajes_whatsapp") => {
      const telefono = (raw.telefono as string) ?? "";
      if (telefono.replace(/[^0-9]/g, "") !== phoneKey) return;
      const msg: MensajeAuto = {
        id: raw.id as string,
        telefono,
        contenido: (raw.contenido as string) ?? "",
        direccion: raw.direccion as "inbound" | "outbound",
        created_at: raw.created_at as string,
        leido: raw.leido as boolean | null,
        campaign_name: (raw.campaign_name as string) ?? null,
        dia_secuencia: (raw.dia_secuencia as number) ?? null,
        estado_envio: (raw.estado_envio as string) ?? null,
        media_url: (raw.media_url as string) ?? null,
        media_type: (raw.media_type as string) ?? null,
      };

      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        // Dedup: mismo contenido+dirección en <15s ya existe (vista lo une)
        const isDup = table === "mensajes_whatsapp" && prev.some(
          (m) =>
            m.contenido === msg.contenido &&
            m.direccion === msg.direccion &&
            Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 15000,
        );
        if (isDup) return prev;
        // Reconcilia mensaje optimista (temp-) con la fila real de n8n
        if (msg.direccion === "outbound") {
          const tempIdx = prev.findIndex(
            (m) => m.id.startsWith("temp-") && m.direccion === "outbound" && m.contenido === msg.contenido,
          );
          if (tempIdx !== -1) {
            const copy = prev.slice();
            copy[tempIdx] = msg;
            return copy;
          }
        }
        if (msg.direccion === "inbound" && !isAtBottomRef.current) {
          setUnreadCount((c) => c + 1);
          lastInboundIdRef.current = msg.id;
        }
        return [...prev, msg];
      });

      // n8n guarda outbound antes que inbound → llegan invertidos por realtime.
      // Refetch de la vista (con sort_ts) 1.5s después del último INSERT para
      // reordenar correctamente sin hacer una query por cada evento.
      if (realtimeRefetchTimerRef.current) clearTimeout(realtimeRefetchTimerRef.current);
      realtimeRefetchTimerRef.current = setTimeout(async () => {
        const { data } = await (supabase as any)
          .from("vista_mensajes_automatizacion")
          .select("*")
          .eq("phone_key", phoneKey)
          .order("sort_ts", { ascending: false })
          .limit(PAGE_SIZE);
        if (!data) return;
        const ordered = (data as MensajeAuto[]).slice().reverse();
        setMessages((prev) => {
          const temps = prev.filter((m) => m.id.startsWith("temp-"));
          if (temps.length > 0) return prev;
          return ordered;
        });
      }, 1500);
    };

    const channel = supabase
      .channel(`auto-messages-${phone}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_automatizacion" },
        (payload) => handleIncomingMsg(payload.new as Record<string, unknown>, "mensajes_automatizacion"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_whatsapp" },
        (payload) => handleIncomingMsg(payload.new as Record<string, unknown>, "mensajes_whatsapp"))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (realtimeRefetchTimerRef.current) clearTimeout(realtimeRefetchTimerRef.current);
    };
  }, [selectedContact?.telefono]);

  useEffect(() => {
    setUnreadCount(0);
    setIsAtBottom(true);
    isAtBottomRef.current = true;
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
    const cursor = oldestSortTsRef.current;
    if (!phone || !cursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const viewport = messagesEndRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const prevHeight = viewport?.scrollHeight ?? 0;
    const prevTop = viewport?.scrollTop ?? 0;

    const phoneKey = phone.replace(/[^0-9]/g, "");
    const { data } = await (supabase as any)
      .from("vista_mensajes_automatizacion")
      .select("id, telefono, contenido, direccion, created_at, seq, leido, campaign_name, dia_secuencia, estado_envio")
      .eq("phone_key", phoneKey)
      .lt("sort_ts", cursor)
      .order("sort_ts", { ascending: false })
      .limit(PAGE_SIZE);

    const older = (data || []).slice().reverse() as MensajeAuto[];
    if (older.length > 0) {
      oldestSortTsRef.current = older[0].sort_ts ?? null;
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
  // Estado de entrega (wamid) del ÚLTIMO mensaje saliente, aunque el lead haya
  // respondido después. Es lo que alimenta el texto explicativo de la mensajería.
  const acuse = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direccion === "outbound") return estadoAcuse(messages[i].estado_envio);
    }
    return null;
  }, [messages]);

  // Envía por el flujo n8n `oportunidades` (espejo de crmrp pero guarda en
  // mensajes_automatizacion): Webhook /oportunidades → Send WhatsApp → insert.
  // n8n es el ÚNICO que escribe en la tabla (evita duplicados); el chat muestra
  // el mensaje de forma optimista y lo reconcilia por realtime. Devuelve si se
  // entregó, y avisa por toast cuando falla.
  const enviarPorWebhook = async (contenido: string): Promise<boolean> => {
    if (!selectedContact?.telefono) return false;
    const { data, error } = await supabase.functions.invoke("send-n8n-webhook", {
      body: {
        target: "oportunidades",
        payload: {
          telefono: selectedContact.telefono,
          mensaje: contenido,
          autor: "admin",
          nombre: selectedContact.nombre,
          pais: selectedContact.pais,
          campaign_name: selectedContact.campaign_name,
        },
      },
    });
    // La Edge Function es "best-effort": ante n8n caído/no-2xx devuelve HTTP 200
    // con { success:true, warning, status }. Inspeccionamos también el cuerpo.
    const d = data as { success?: boolean; warning?: string; status?: number } | null;
    const entregado =
      !error &&
      d?.success !== false &&
      !d?.warning &&
      !(typeof d?.status === "number" && d.status >= 400);
    if (!entregado) {
      console.warn("Webhook no entregado:", error || d);
      toast({
        title: "No se pudo enviar",
        description: d?.status
          ? `n8n respondió ${d.status}. Mensaje marcado como fallido; puedes reintentar.`
          : "El mensaje quedó marcado como fallido. Puedes reintentar.",
        variant: "destructive",
      });
    }
    return entregado;
  };

  // Borra un mensaje de ambas tablas (la vista unifica mensajes_automatizacion +
  // mensajes_whatsapp; intentamos en las dos porque no sabemos cuál contiene el id).
  const deleteMessage = async (msg: MensajeAuto) => {
    if (msg.id.startsWith("temp-")) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      return;
    }
    setDeletingId(msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id)); // optimistic
    try {
      await Promise.all([
        supabase.from("mensajes_automatizacion").delete().eq("id", msg.id),
        (supabase as any).from("mensajes_whatsapp").delete().eq("id", msg.id),
      ]);
    } catch {
      // Rollback: devolver el mensaje al estado si la BD falla
      setMessages((prev) => {
        const sorted = [...prev, msg].sort(
          (a, b) => {
            const dt = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (dt !== 0) return dt;
            return (a.seq ?? 0) - (b.seq ?? 0);
          },
        );
        return sorted;
      });
      toast({ title: "No se pudo borrar", description: "Error de red. El mensaje sigue en la conversación.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const sendMessage = async () => {
    const contenido = newMessage.trim();
    if (!contenido || !selectedContact?.telefono) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimista: MensajeAuto = {
      id: tempId,
      telefono: selectedContact.telefono,
      contenido,
      direccion: "outbound",
      created_at: new Date().toISOString(),
      estado_envio: "enviando",
      campaign_name: selectedContact.campaign_name,
    };
    setMessages((prev) => [...prev, optimista]);
    setNewMessage("");
    setPendingMedia(null);
    // Fallback: si realtime no reconcilia el temp en 15s, lo marca como fallido
    const fallbackTimer = setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId && m.estado_envio === "enviando" ? { ...m, estado_envio: "fallido" } : m)),
      );
    }, 15000);
    try {
      const entregado = await enviarPorWebhook(contenido);
      clearTimeout(fallbackTimer);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, estado_envio: entregado ? "enviado" : "fallido" } : m)),
      );
    } catch (err: any) {
      clearTimeout(fallbackTimer);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, estado_envio: "fallido" } : m)));
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const reintentar = async (msg: MensajeAuto) => {
    if (!selectedContact?.telefono) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, estado_envio: "enviando" } : m)));
    const entregado = await enviarPorWebhook(msg.contenido);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, estado_envio: entregado ? "enviado" : "fallido" } : m)),
    );
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 dark:bg-zinc-950/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-center"
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground">Selecciona una conversación</p>
          <p className="text-sm text-muted-foreground">para ver los mensajes automatizados</p>
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
              {acuse && (
                <Badge
                  variant="outline"
                  className={`h-4 px-1 text-[10px] ${acuse.badge}`}
                  title={acuse.largo}
                >
                  {acuse.corto}
                </Badge>
              )}
              <TagChips tagIds={selectedContact.tag_ids} allTags={allTags} />
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
                      <div key={msg.id} className="group">
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
                          className={`flex items-end gap-1.5 ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          {/* Botón borrar — visible solo a admins al hacer hover */}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => deleteMessage(msg)}
                              disabled={deletingId === msg.id}
                              title="Borrar mensaje"
                              className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:pointer-events-none ${
                                isOutbound ? "order-first" : "order-last"
                              }`}
                            >
                              {deletingId === msg.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </button>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-shadow ${
                              isOutbound
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-white dark:bg-zinc-900 border border-border text-foreground rounded-bl-sm"
                            } ${isCurrentMatch ? "ring-2 ring-yellow-400" : ""} ${
                              isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : ""
                            }`}
                          >
                            {msg.media_url && (
                              <div className={msg.contenido ? "mb-1.5" : ""}>
                                <MediaBubble url={msg.media_url} type={msg.media_type} />
                              </div>
                            )}
                            {msg.contenido && <FormattedText text={msg.contenido} highlight={searchQuery} />}
                            <div
                              className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
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
                              {isOutbound && (() => {
                                const fase = tickFase(msg.estado_envio);
                                if (fase === "enviando")
                                  return <Clock className="h-3 w-3 shrink-0" aria-label="Enviando" />;
                                if (fase === "enviado")
                                  return <Check className="h-3 w-3 shrink-0" aria-label="Enviado" />;
                                if (fase === "entregado")
                                  return <CheckCheck className="h-3 w-3 shrink-0" aria-label="Entregado" />;
                                if (fase === "leido")
                                  return (
                                    <CheckCheck
                                      className="h-3 w-3 shrink-0 text-sky-300"
                                      aria-label="Leído / Respondido"
                                    />
                                  );
                                if (fase === "fallido")
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => reintentar(msg)}
                                      className="inline-flex items-center gap-0.5 text-rose-200 hover:text-white font-medium"
                                      title="Reintentar envío"
                                    >
                                      <AlertCircle className="h-3 w-3 shrink-0" />
                                      Reintentar
                                    </button>
                                  );
                                return null;
                              })()}
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
          {pendingMedia && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <MediaBubble url={pendingMedia.url} type={pendingMedia.type} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setPendingMedia(null)}
                title="Quitar adjunto"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {acuse && (
            <div
              className={`max-w-3xl mx-auto mb-1.5 flex items-center gap-1.5 text-[11px] leading-none ${acuse.clase}`}
            >
              {acuse.fase === "enviando" && <Clock className="h-3 w-3 shrink-0" />}
              {acuse.fase === "enviado" && <Check className="h-3 w-3 shrink-0" />}
              {(acuse.fase === "entregado" || acuse.fase === "leido") && (
                <CheckCheck className="h-3 w-3 shrink-0" />
              )}
              {acuse.fase === "fallido" && <AlertCircle className="h-3 w-3 shrink-0" />}
              <span>Tu último mensaje: {acuse.largo}</span>
            </div>
          )}
          <div className="flex gap-1 max-w-3xl mx-auto items-end">
            <QuickRepliesPopover isAdmin={canWrite} onPick={insertText} contactName={selectedContact.nombre || ""} />
            <EmojiPickerButton onPick={insertText} />
            <AttachmentButton isAdmin={canWrite} onUploaded={(url, type) => setPendingMedia({ url, type })} />
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && canWrite && sendMessage()}
              placeholder={canWrite ? "Escribe un mensaje... (*negrita* _cursiva_ ~tachado~)" : "Solo lectura"}
              disabled={!canWrite}
              className="flex-1 rounded-xl bg-muted/50 focus-visible:ring-primary focus-visible:bg-background transition-all border-transparent focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <motion.div whileHover={{ scale: canWrite ? 1.05 : 1 }} whileTap={{ scale: canWrite ? 0.95 : 1 }}>
              <Button
                onClick={sendMessage}
                disabled={(!newMessage.trim() && !pendingMedia) || sending || !canWrite}
                size="icon"
                className="rounded-xl h-10 w-10 shadow-md"
                title={!canWrite ? "Sin permiso de envío" : undefined}
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

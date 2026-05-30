import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare, Search, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { countryFlag } from "@/lib/countryFlag";
import { useToast } from "@/hooks/use-toast";


interface InboxRow {
  telefono: string;
  nombre: string | null;
  pais: string | null;
  campaign_name: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_dir: string | null;
  ultimo_dia: number | null;
  ultimo_estado: string | null;
  unread_count: number | null;
  total_mensajes: number | null;
}

interface AutoMessage {
  id: string;
  telefono: string;
  contenido: string;
  direccion: string;
  canal: string | null;
  campaign_name: string | null;
  dia_secuencia: number | null;
  created_at: string;
}

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ConversationsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load inbox view
  const loadInbox = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("vista_inbox_automatizacion")
      .select(
        "telefono, nombre, pais, campaign_name, last_message_at, last_message_text, last_message_dir, ultimo_dia, ultimo_estado, unread_count, total_mensajes",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) console.error(error);
    setRows((data || []) as InboxRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadInbox();
    const channel = supabase
      .channel("auto-inbox-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensajes_automatizacion" },
        () => loadInbox(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // load messages for selected contact
  const loadMessages = async (tel: string) => {
    setLoadingMsgs(true);
    const { data, error } = await (supabase as any)
      .from("mensajes_automatizacion")
      .select(
        "id, telefono, contenido, direccion, canal, campaign_name, dia_secuencia, created_at",
      )
      .eq("telefono", tel)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) console.error(error);
    setMessages((data || []) as AutoMessage[]);
    setLoadingMsgs(false);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.telefono);
    const channel = supabase
      .channel(`auto-msgs-${selected.telefono}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensajes_automatizacion",
          filter: `telefono=eq.${selected.telefono}`,
        },
        () => loadMessages(selected.telefono),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.telefono]);

  const campaigns = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.campaign_name && s.add(r.campaign_name));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (campaignFilter !== "all" && r.campaign_name !== campaignFilter)
        return false;
      if (!q) return true;
      return (
        (r.nombre || "").toLowerCase().includes(q) ||
        (r.telefono || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, campaignFilter]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selected || !user) return;
    setSending(true);

    const payload = {
      telefono: selected.telefono,
      nombre: selected.nombre || null,
      pais: selected.pais || null,
      campaign_name: selected.campaign_name || null,
      contenido: text,
      direccion: "outbound",
      canal: "whatsapp",
      user_id: user.id,
    };

    const { error } = await (supabase as any)
      .from("mensajes_automatizacion")
      .insert(payload);

    if (error) {
      toast({
        title: "Error al enviar",
        description: error.message,
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    setDraft("");
    loadMessages(selected.telefono);

    // fire-and-forget webhook
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "mensaje_manual",
        telefono: selected.telefono,
        nombre: selected.nombre,
        pais: selected.pais,
        campaign_name: selected.campaign_name,
        contenido: text,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      }),
    }).catch((e) => console.warn("webhook error:", e));

    setSending(false);
  };

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-full md:w-80 border-r flex flex-col bg-card">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Conversaciones</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Campaña" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las campañas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm p-6">
              Sin conversaciones
            </p>
          ) : (
            filtered.map((r) => {
              const isSelected = selected?.telefono === r.telefono;
              const unread = r.unread_count || 0;
              return (
                <button
                  key={r.telefono}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left border-b px-3 py-2 hover:bg-muted/50 transition-colors ${
                    isSelected ? "bg-muted border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm font-semibold truncate flex-1">
                      {r.nombre || r.telefono}
                    </span>
                    {r.pais && (
                      <span className="text-[11px] shrink-0">
                        {countryFlag(r.pais)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(r.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {r.campaign_name && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[10px] font-normal max-w-[120px] truncate"
                      >
                        {r.campaign_name}
                      </Badge>
                    )}
                    {unread > 0 && (
                      <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px]">
                        {unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {r.last_message_dir === "outbound" ? "Tú: " : ""}
                    {r.last_message_text || r.telefono}
                  </p>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col bg-background">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="border-b p-3 flex items-center gap-2 bg-card">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">
                    {selected.nombre || selected.telefono}
                  </span>
                  {selected.pais && (
                    <span className="text-sm">{countryFlag(selected.pais)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {selected.telefono}
                  </span>
                  {selected.campaign_name && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[10px] font-normal"
                    >
                      {selected.campaign_name}
                    </Badge>
                  )}
                  {selected.ultimo_dia != null && (
                    <Badge className="h-4 px-1 text-[10px]" variant="secondary">
                      Día {selected.ultimo_dia}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div ref={scrollRef} className="space-y-2">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Sin mensajes
                  </p>
                ) : (
                  messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const showDay =
                      m.dia_secuencia != null &&
                      m.dia_secuencia !== prev?.dia_secuencia;
                    const isOut = m.direccion === "outbound";
                    return (
                      <div key={m.id}>
                        {showDay && (
                          <div className="flex justify-center my-2">
                            <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Día {m.dia_secuencia}
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex ${isOut ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                              isOut
                                ? "bg-accent text-accent-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <div>{m.contenido}</div>
                            <div className="text-[10px] opacity-60 mt-1 text-right">
                              {formatTime(m.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-3 flex items-center gap-2 bg-card">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Escribe un mensaje..."
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="border rounded-lg p-8 text-center text-muted-foreground bg-card">
      <p className="text-sm">{title}</p>
    </div>
  );
}

export default function Automation() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automatización</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de campañas automatizadas y conversaciones.
        </p>
      </div>

      <Tabs defaultValue="conversaciones" className="w-full">
        <TabsList>
          <TabsTrigger value="resumen">📊 Resumen</TabsTrigger>
          <TabsTrigger value="plantillas">📝 Plantillas</TabsTrigger>
          <TabsTrigger value="configuracion">⚙️ Configuración</TabsTrigger>
          <TabsTrigger value="conversaciones">💬 Conversaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <PlaceholderTab title="Resumen de automatización (próximamente)" />
        </TabsContent>
        <TabsContent value="plantillas" className="mt-4">
          <PlaceholderTab title="Plantillas de mensajes (próximamente)" />
        </TabsContent>
        <TabsContent value="configuracion" className="mt-4">
          <PlaceholderTab title="Configuración (próximamente)" />
        </TabsContent>
        <TabsContent value="conversaciones" className="mt-4">
          <ConversationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

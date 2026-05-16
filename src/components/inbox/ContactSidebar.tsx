import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Loader2, Bot, BotOff, Filter, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana, LeadTag } from "@/lib/supabase";
import { playNotificationSound } from "@/hooks/use-notification-sound";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ContactContextMenu } from "./ContactContextMenu";
import { TagChips } from "./TagsManager";
import { useInboxContacts, type InboxFilter } from "@/hooks/use-inbox-contacts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface ContactSidebarProps {
  selectedContact: LeadCampana | null;
  onSelectContact: (contact: LeadCampana) => void;
  allTags: LeadTag[];
}

export function ContactSidebar({ selectedContact, onSelectContact, allTags }: ContactSidebarProps) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const { isAdmin } = useIsAdmin();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { rows, loading, total, hasMore, loadMore, refreshPhone, patchPhone } = useInboxContacts({
    search,
    filter,
    tagId: tagFilter,
  });

  // Realtime: refresh ONLY the affected row, not the whole list
  useEffect(() => {
    const channel = supabase
      .channel("inbox-row-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensajes_whatsapp" },
        (payload) => {
          const tel = (payload.new as any)?.telefono ?? (payload.old as any)?.telefono;
          if (tel) refreshPhone(tel);
          if (payload.eventType === "INSERT" && (payload.new as any)?.direccion === "inbound") {
            playNotificationSound();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads_campana" },
        (payload) => {
          const tel = (payload.new as any)?.telefono;
          if (tel) refreshPhone(tel);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshPhone]);

  // Infinite scroll on viewport scroll
  useEffect(() => {
    const el = scrollRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const handleSelect = (row: typeof rows[number]) => {
    onSelectContact({
      id: row.id,
      nombre: row.nombre || "",
      telefono: row.telefono,
      pais: row.pais,
      estado: row.estado,
      bot_activo: row.bot_activo,
      archivado: row.archivado,
      tag_ids: row.tag_ids,
    } as LeadCampana);
    if (row.unread_count > 0) patchPhone(row.telefono, { unread_count: 0 });
  };

  const totalLabel = useMemo(() => (total != null ? `${rows.length}/${total}` : `${rows.length}`), [rows.length, total]);

  return (
    <div className="w-full md:w-80 border-r flex flex-col bg-card">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Contactos</h2>
          <span className="ml-auto text-xs text-muted-foreground">{totalLabel}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={filter} onValueChange={(v) => setFilter(v as InboxFilter)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unread">No leídos</SelectItem>
              <SelectItem value="bot_on">Bot activo</SelectItem>
              <SelectItem value="bot_off">Bot inactivo</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef}>
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm p-6">Sin contactos</p>
          ) : (
            rows.map((contact) => {
              const unread = contact.unread_count || 0;
              const isSelected = selectedContact?.telefono?.split("@")[0] === contact.telefono;
              return (
                <div
                  key={contact.id}
                  className={`group relative border-b transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-muted border-l-2 border-l-primary" : ""
                  }`}
                >
                  <button
                    onClick={() => handleSelect(contact)}
                    className="w-full text-left px-4 py-3 pr-10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                        {contact.archivado && <Archive className="h-3 w-3 text-muted-foreground" />}
                        {contact.nombre || "Sin nombre"}
                        {contact.pais && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium text-muted-foreground border-muted-foreground/30">
                            {contact.pais}
                          </Badge>
                        )}
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
                      {contact.last_message_text ? (
                        <>
                          <span className="opacity-60">
                            {contact.last_message_dir === "outbound" ? "Tú: " : ""}
                          </span>
                          {contact.last_message_text}
                        </>
                      ) : (
                        contact.telefono
                      )}
                    </p>
                    <TagChips tagIds={contact.tag_ids} allTags={allTags} />
                  </button>
                  <div className="absolute right-1 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ContactContextMenu
                      isAdmin={isAdmin}
                      contact={{
                        id: contact.id,
                        nombre: contact.nombre || "",
                        telefono: contact.telefono,
                        archivado: contact.archivado,
                        tag_ids: contact.tag_ids,
                      } as LeadCampana}
                      onChanged={() => refreshPhone(contact.telefono)}
                    />
                  </div>
                </div>
              );
            })
          )}
          {hasMore && rows.length > 0 && (
            <div className="flex items-center justify-center py-3">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <button
                  onClick={loadMore}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cargar más
                </button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

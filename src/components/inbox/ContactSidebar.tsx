import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Loader2, Bot, BotOff, Filter, Archive, Trash2, CheckSquare, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { LeadCampana, LeadTag } from "@/lib/supabase";
import { playNotificationSound } from "@/hooks/use-notification-sound";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ContactContextMenu } from "./ContactContextMenu";
import { TagChips } from "./TagsManager";
import { useInboxContacts, type InboxFilter, type DateFilter } from "@/hooks/use-inbox-contacts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { countryFlag } from "@/lib/countryFlag";
import { AiAgentBadge, AiAgentStripe } from "./AiAgentBadge";

function formatInboxTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Ayer";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Color de avatar determinista a partir del nombre/teléfono (WhatsApp-like).
const AVATAR_COLORS = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
  "#f43f5e", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [countries, setCountries] = useState<string[]>([]);
  const { isAdmin } = useIsAdmin();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [syncingIds, setSyncingIds] = useState(false);

  const syncIdContactos = async () => {
    setSyncingIds(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("sync-id-contacto");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error desconocido");
      toast({
        title: "IDs sincronizados",
        description: `Actualizados: ${data.updated} · Sin cambios: ${data.unchanged} · Sin match: ${data.unmatched}`,
      });
    } catch (e: any) {
      toast({ title: "Error al sincronizar", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSyncingIds(false);
    }
  };

  const { rows, loading, total, hasMore, loadMore, refreshPhone, patchPhone, removePhone } = useInboxContacts({
    search,
    filter,
    tagId: tagFilter,
    country: countryFilter,
    dateRange: dateFilter,
  });

  // Load distinct countries once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("leads_campana")
        .select("pais")
        .not("pais", "is", null)
        .limit(5000);
      if (cancelled || error || !data) return;
      const set = new Set<string>();
      for (const r of data as { pais: string | null }[]) {
        const p = (r.pais || "").trim();
        if (p) set.add(p);
      }
      setCountries(Array.from(set).sort((a, b) => a.localeCompare(b)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const phones = rows.filter((r) => selectedIds.has(r.id)).map((r) => r.telefono);
    const { error: msgErr } = await (supabase as any)
      .from("mensajes_whatsapp")
      .delete()
      .in("telefono", phones);
    if (msgErr) {
      toast({ title: "Error al borrar mensajes", description: msgErr.message, variant: "destructive" });
      setBulkDeleting(false);
      return;
    }
    const { error: leadErr } = await (supabase as any)
      .from("leads_campana")
      .delete()
      .in("id", ids);
    if (leadErr) {
      toast({ title: "Error al borrar contactos", description: leadErr.message, variant: "destructive" });
      setBulkDeleting(false);
      return;
    }
    phones.forEach((p) => removePhone(p));
    toast({ title: `${ids.length} contacto(s) eliminado(s)` });
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    exitSelection();
  };

  return (
    <div className="w-full md:w-80 border-r flex flex-col bg-card">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-bold leading-tight text-foreground">Reactivación de leads</h2>
            <p className="text-[11px] leading-none text-muted-foreground">Bandeja de mensajes</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{totalLabel}</span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={syncIdContactos}
              disabled={syncingIds}
              title="Sincronizar ID_CONTACTO desde Google Sheets (hoja 4)"
            >
              {syncingIds ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
          {isAdmin && (
            selectionMode ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitSelection} title="Cancelar selección">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectionMode(true)} title="Seleccionar para eliminar">
                <CheckSquare className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
        {selectionMode && (
          <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAllVisible}
              aria-label="Seleccionar todos"
            />
            <span className="text-xs text-muted-foreground flex-1">
              {selectedIds.size} seleccionado(s)
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              disabled={selectedIds.size === 0}
              onClick={() => setConfirmBulkDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
            </Button>
          </div>
        )}
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
              <SelectItem value="ai_initiated">Contactados por el agente</SelectItem>
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
        <div className="flex items-center gap-1.5">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="País" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquier fecha</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
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
              const checked = selectedIds.has(contact.id);
              return (
                <div
                  key={contact.id}
                  className={`group relative flex items-center gap-2.5 border-b px-3 py-2 transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-muted border-l-2 border-l-primary" : ""
                  } ${checked ? "bg-primary/5" : ""} ${selectionMode ? "pl-9" : ""}`}
                >
                  {contact.is_ai_initiated && !selectionMode && !isSelected && <AiAgentStripe />}
                  {selectionMode && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* Avatar */}
                  <button
                    onClick={() => (selectionMode ? toggleId(contact.id) : handleSelect(contact))}
                    className="relative shrink-0"
                    aria-label={contact.nombre || "Contacto"}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white ring-2 ${isSelected ? "ring-primary/40" : "ring-transparent"}`}
                      style={{ background: avatarColor(contact.nombre || contact.telefono) }}
                    >
                      {(contact.nombre?.trim()?.[0] || "#").toUpperCase()}
                    </span>
                    {!selectionMode && unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <button
                      onClick={() => (selectionMode ? toggleId(contact.id) : handleSelect(contact))}
                      className="flex min-w-0 flex-col overflow-hidden text-left"
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        {contact.archivado && <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <span className={`min-w-0 truncate text-sm text-foreground ${unread > 0 ? "font-bold" : "font-semibold"}`}>
                          {contact.nombre || "Sin nombre"}
                        </span>
                        {contact.pais && (
                          <Badge variant="outline" className="inline-flex h-4 max-w-16 shrink-0 items-center gap-0.5 overflow-hidden border-muted-foreground/30 px-1 text-[10px] font-medium text-muted-foreground">
                            <span aria-hidden className="text-[11px] leading-none">{countryFlag(contact.pais)}</span>
                            <span className="truncate">{contact.pais}</span>
                          </Badge>
                        )}
                        <span className={`ml-auto shrink-0 whitespace-nowrap pl-1 text-[10px] leading-none ${unread > 0 ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {formatInboxTime(contact.last_message_at)}
                        </span>
                      </div>
                      <span className={`mt-0.5 block w-full truncate text-xs leading-4 ${unread > 0 ? "font-medium text-foreground/80" : "text-muted-foreground"}`}>
                        {contact.last_message_text ? (
                          <>
                            <span className="opacity-60">{contact.last_message_dir === "outbound" ? "Tú: " : ""}</span>
                            {contact.last_message_text}
                          </>
                        ) : (
                          contact.telefono
                        )}
                      </span>
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {contact.is_ai_initiated && <AiAgentBadge compact />}
                      <TagChips tagIds={contact.tag_ids} allTags={allTags} />
                    </div>
                  </div>

                  {/* Meta: menú + bot */}
                  {!selectionMode && (
                    <div className="relative z-10 flex shrink-0 flex-col items-center gap-1 self-start pt-0.5">
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
                        onDeleted={() => removePhone(contact.telefono)}
                      />
                      {contact.bot_activo ? (
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <BotOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  )}
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

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} contacto(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los contactos seleccionados y todos sus mensajes de WhatsApp. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); bulkDelete(); }}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

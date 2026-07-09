import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Search, Loader2, CheckSquare, X, RefreshCw, Trash2, Zap } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/hooks/use-notification-sound";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { countryFlag } from "@/lib/countryFlag";
import { senalMeta } from "@/lib/acuse";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { TagChips } from "@/components/inbox/TagsManager";
import type { LeadTag } from "@/lib/supabase";
import {
  useAutomationContacts,
  type AutomationContactRow,
  type AutomationEstadoFilter,
  type AutomationDireccionFilter,
} from "@/hooks/use-automation-contacts";

export interface AutomationContact {
  telefono: string;
  nombre: string | null;
  pais: string | null;
  campaign_name: string | null;
  tag_ids?: string[] | null;
}

interface Props {
  selectedContact: AutomationContact | null;
  onSelectContact: (c: AutomationContact) => void;
  allTags: LeadTag[];
}

function relTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
}

function estadoColor(estado: string | null | undefined) {
  if (estado === "enviado") return "text-emerald-600 bg-emerald-500/15 border-emerald-500/30";
  if (estado === "respondido") return "text-blue-600 bg-blue-500/15 border-blue-500/30";
  if (estado === "fallido") return "text-rose-600 bg-rose-500/15 border-rose-500/30";
  if (estado === "enviando") return "text-amber-600 bg-amber-500/15 border-amber-500/30";
  return "text-muted-foreground bg-muted border-border";
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

export function AutomationSidebar({ selectedContact, onSelectContact, allTags }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);
  const [campaign, setCampaign] = useState("all");
  const [country, setCountry] = useState("all");
  const [estado, setEstado] = useState<AutomationEstadoFilter>("all");
  const [direccion, setDireccion] = useState<AutomationDireccionFilter>("all");
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { rows, loading, total, hasMore, loadMore, refreshPhone, removePhone } = useAutomationContacts({
    search,
    campaign,
    country,
    estado,
    direccion,
  });

  // Load filter options — intenta el RPC (una sola llamada); si aún no existe
  // (migración no aplicada) cae al método anterior de leer filas distintas.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("opciones_inbox_automatizacion");
      if (cancelled) return;
      if (!error && data) {
        setCampaigns(((data.campaigns as string[]) || []).slice());
        setCountries(((data.paises as string[]) || []).slice());
        return;
      }
      // Fallback
      const { data: rows } = await (supabase as any)
        .from("vista_inbox_automatizacion")
        .select("campaign_name, pais")
        .limit(5000);
      if (cancelled || !rows) return;
      const cs = new Set<string>();
      const ps = new Set<string>();
      for (const r of rows as { campaign_name: string | null; pais: string | null }[]) {
        if (r.campaign_name) cs.add(r.campaign_name);
        if (r.pais) ps.add(r.pais);
      }
      setCampaigns(Array.from(cs).sort());
      setCountries(Array.from(ps).sort());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime row updates — coalescemos ráfagas: acumulamos los teléfonos
  // tocados y refrescamos una vez cada ~400ms (una query por teléfono
  // único), en vez de disparar refreshPhone por cada evento entrante.
  const pendingPhonesRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handlePayload = (payload: any, isInbound: boolean) => {
      const tel = payload.new?.telefono ?? payload.old?.telefono;
      if (tel) {
        pendingPhonesRef.current.add(tel);
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => {
          const phones = Array.from(pendingPhonesRef.current);
          pendingPhonesRef.current.clear();
          phones.forEach((p) => refreshPhone(p));
        }, 400);
      }
      if (isInbound && payload.eventType === "INSERT" && payload.new?.direccion === "inbound") {
        playNotificationSound();
      }
    };

    const channel = supabase
      .channel("automation-row-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes_automatizacion" },
        (payload) => handlePayload(payload, true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_whatsapp" },
        (payload) => handlePayload(payload, true))
      .subscribe();
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [refreshPhone]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current?.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const totalLabel = useMemo(
    () => (total != null ? `${rows.length}/${total}` : `${rows.length}`),
    [rows.length, total],
  );

  const hasActiveFilters =
    searchInput.trim() !== "" ||
    campaign !== "all" ||
    country !== "all" ||
    estado !== "all" ||
    direccion !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setCampaign("all");
    setCountry("all");
    setEstado("all");
    setDireccion("all");
  };

  const handleSelect = (row: AutomationContactRow) => {
    onSelectContact({
      telefono: row.telefono,
      nombre: row.nombre,
      pais: row.pais,
      campaign_name: row.campaign_name,
      tag_ids: row.tag_ids,
    });
  };

  const togglePhone = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });
  };
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selectedPhones.has(r.telefono));
  const toggleSelectAllVisible = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => next.delete(r.telefono));
      else rows.forEach((r) => next.add(r.telefono));
      return next;
    });
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedPhones(new Set());
  };

  const syncIds = async () => {
    setSyncing(true);
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
      setSyncing(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedPhones.size === 0) return;
    setBulkDeleting(true);
    const phones = Array.from(selectedPhones);
    // mensajes_automatizacion no DELETE permitido via RLS; intentamos pero ignoramos errores
    const { error } = await (supabase as any)
      .from("mensajes_automatizacion")
      .delete()
      .in("telefono", phones);
    if (error) {
      toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" });
      setBulkDeleting(false);
      return;
    }
    phones.forEach((p) => removePhone(p));
    toast({ title: `${phones.length} conversación(es) eliminada(s)` });
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    exitSelection();
  };

  return (
    <div className="w-full md:w-80 border-r flex flex-col bg-card">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-bold leading-tight text-foreground">Oportunidades</h2>
            <p className="text-[11px] leading-none text-muted-foreground">Conversaciones del agente</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{totalLabel}</span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={syncIds}
              disabled={syncing}
              title="Sincronizar IDs"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
          {isAdmin && (
            selectionMode ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitSelection}>
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectionMode(true)}>
                <CheckSquare className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
        {selectionMode && (
          <div className="flex items-center gap-2 bg-muted/50 rounded px-2 py-1.5">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} />
            <span className="text-xs text-muted-foreground flex-1">{selectedPhones.size} seleccionado(s)</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              disabled={selectedPhones.size === 0}
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
        <Select value={campaign} onValueChange={setCampaign}>
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
        <div className="flex gap-1.5">
          <Select value={country} onValueChange={setCountry}>
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
          <Select value={estado} onValueChange={(v) => setEstado(v as AutomationEstadoFilter)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="respondido">Respondido</SelectItem>
              <SelectItem value="fallido">Fallido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={direccion} onValueChange={(v) => setDireccion(v as AutomationDireccionFilter)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Dirección" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las direcciones</SelectItem>
            <SelectItem value="inbound">Recibidos</SelectItem>
            <SelectItem value="outbound">Enviados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef}>
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            hasActiveFilters ? (
              <div className="text-center p-6 space-y-2">
                <p className="text-muted-foreground text-sm">Sin resultados para tu búsqueda o filtros</p>
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm p-6">Sin conversaciones</p>
            )
          ) : (
            rows.map((c) => {
              const isSelected = selectedContact?.telefono === c.telefono;
              const checked = selectedPhones.has(c.telefono);
              const unread = c.unread_count || 0;
              const last = (c.last_message_text || "").slice(0, 45);
              return (
                <div
                  key={c.telefono}
                  className={`group relative flex items-stretch border-b transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-muted border-l-2 border-l-primary" : ""
                  } ${checked ? "bg-primary/5" : ""}`}
                >
                  {selectionMode && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                      <Checkbox checked={checked} onCheckedChange={() => togglePhone(c.telefono)} />
                    </div>
                  )}
                  <button
                    onClick={() => (selectionMode ? togglePhone(c.telefono) : handleSelect(c))}
                    className={`flex-1 min-w-0 text-left py-2 pr-2 ${selectionMode ? "pl-10" : "pl-2"}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <span
                          className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white"
                          style={{ background: avatarColor(c.nombre || c.telefono) }}
                        >
                          {(c.nombre?.trim()?.[0] || "#").toUpperCase()}
                        </span>
                        {!selectionMode && unread > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                        {(() => {
                          const meta = senalMeta(c.senal);
                          if (!meta) return null;
                          return (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card"
                              style={{ background: meta.color }}
                              title={meta.label}
                              aria-label={meta.label}
                            />
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold text-foreground truncate flex-1">
                            {c.nombre || "Sin nombre"}
                          </span>
                          {c.pais && (
                            <span aria-hidden className="text-[11px] leading-none shrink-0">
                              {countryFlag(c.pais)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {relTime(c.last_message_at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{c.telefono}</div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {c.campaign_name && (
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] font-medium text-accent-foreground bg-accent/40 border-accent/40"
                            >
                              {c.campaign_name === "Verificar Disponibilidad antes de Reservar (importar entre '¿Hay Reserva?1' y 'Ejecutar Reserva')" || c.campaign_name === "Atención IA Sofía (Agendamiento ) [DEFINITIVO]" ? "SUPER Ad" : c.campaign_name}
                            </Badge>
                          )}
                          {c.ultimo_estado && (
                            <Badge
                              variant="outline"
                              className={`h-4 px-1 text-[9px] font-medium ${estadoColor(c.ultimo_estado)}`}
                            >
                              {c.ultimo_estado}
                            </Badge>
                          )}
                          {c.ultimo_dia != null && c.ultimo_dia > 0 && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px]">
                              Día {c.ultimo_dia}
                            </Badge>
                          )}
                          <TagChips tagIds={c.tag_ids} allTags={allTags} />
                        </div>
                        {last && (
                          <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                            <span className="opacity-60">
                              {c.last_message_dir === "outbound" ? "Tú: " : ""}
                            </span>
                            {last}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
          {hasMore && rows.length > 0 && (
            <div className="flex items-center justify-center py-3">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <button onClick={loadMore} className="text-xs text-muted-foreground hover:text-foreground">
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
            <AlertDialogTitle>¿Eliminar {selectedPhones.size} conversación(es)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los mensajes de automatización de los teléfonos seleccionados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                bulkDelete();
              }}
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

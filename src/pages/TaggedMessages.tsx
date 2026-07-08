import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadTag, LeadCampana } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tag, Search, Loader2, MessageSquare, Download } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { orderTags } from "@/lib/permanentTags";
import { ChatArea } from "@/components/inbox/ChatArea";
import { countryFlag } from "@/lib/countryFlag";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TaggedRow {
  id: string;
  nombre: string | null;
  telefono: string;
  pais: string | null;
  tag_ids: string[] | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_dir: string | null;
  unread_count: number;
}

const PAGE_SIZE = 50;

export default function TaggedMessages() {
  const navigate = useNavigate();
  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("all-excl-sigue");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 400);

  const [rows, setRows] = useState<TaggedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  const [openContactState, setOpenContactState] = useState<LeadCampana | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const refreshTags = async () => {
    const { data } = await (supabase as any)
      .from("lead_tags")
      .select("*")
      .order("nombre");
    setAllTags(orderTags((data || []) as LeadTag[]));
  };

  useEffect(() => {
    refreshTags();
  }, []);

  useEffect(() => {
    setPage(0);
    setRows([]);
    setHasMore(true);
  }, [search, tagFilter]);

  const sigueTagId = useMemo(() => {
    return allTags.find((t) =>
      (t.nombre ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() === "sigue en campana"
    )?.id ?? null;
  }, [allTags]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Si el filtro ARCHIVADOS está activo pero aún no se cargaron las etiquetas,
      // esperar — el efecto volverá a correr cuando sigueTagId cambie a su valor real.
      if (tagFilter === "all-excl-sigue" && sigueTagId === null) return;

      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = (supabase as any)
        .from("vista_inbox_contactos")
        .select(
          "id, nombre, telefono, pais, tag_ids, last_message_at, last_message_text, last_message_dir, unread_count",
          { count: "estimated" },
        )
        .not("tag_ids", "is", null);

      if (tagFilter === "all-excl-sigue") {
        q = q.not("tag_ids", "eq", "{}");
        if (sigueTagId) q = q.not("tag_ids", "cs", `{${sigueTagId}}`);
      } else if (tagFilter !== "all") {
        q = q.contains("tag_ids", [tagFilter]);
      } else {
        q = q.not("tag_ids", "eq", "{}");
      }

      if (search.trim()) {
        const s = search.trim().replace(/[,()]/g, " ");
        q = q.or(`nombre.ilike.%${s}%,telefono.ilike.%${s}%`);
      }

      q = q
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (cancelled) return;
      if (error) {
        console.error("[TaggedMessages]", error);
        setLoading(false);
        return;
      }
      const newRows = (data || []) as TaggedRow[];
      setRows((prev) => (page === 0 ? newRows : [...prev, ...newRows]));
      if (typeof count === "number") setTotal(count);
      setHasMore(newRows.length === PAGE_SIZE);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, search, tagFilter, sigueTagId]);

  const tagMap = useMemo(() => {
    const m = new Map<string, LeadTag>();
    allTags.forEach((t) => m.set(t.id, t));
    return m;
  }, [allTags]);

  const openContact = async (row: TaggedRow) => {
    setLoadingContact(true);
    const { data } = await (supabase as any)
      .from("leads_campana")
      .select("*")
      .eq("telefono", row.telefono)
      .maybeSingle();
    setLoadingContact(false);
    if (data) setOpenContactState(data as LeadCampana);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">EXPANSIÓN&nbsp; &nbsp;</h1>
        <span className="text-xs text-muted-foreground">
          {total != null ? `${rows.length}/${total}` : `${rows.length}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto flex items-center gap-1.5"
          onClick={() => navigate("/tagged/export")}
        >
          <Download className="h-3.5 w-3.5" />
          Descarga  segmentada vía etiquetas&nbsp;
        </Button>
      </div>

      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-excl-sigue">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                ARCHIVADOS
              </span>
            </SelectItem>
            <SelectItem value="all">Todas las etiquetas</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <ScrollArea className="h-[calc(100vh-15rem)]">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-16">
              No hay mensajes con etiquetas
            </div>
          ) : (
            rows.map((row) => {
              const tags = (row.tag_ids || [])
                .map((id) => tagMap.get(id))
                .filter(Boolean) as LeadTag[];
              if (tags.length === 0) return null;
              return (
                <button
                  key={row.id}
                  onClick={() => openContact(row)}
                  disabled={loadingContact}
                  className="w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                      {row.nombre || row.telefono}
                      {row.pais && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[10px] font-medium text-muted-foreground border-muted-foreground/30 inline-flex items-center gap-1"
                        >
                          <span aria-hidden className="text-[11px] leading-none">
                            {countryFlag(row.pais)}
                          </span>
                          {row.pais}
                        </Badge>
                      )}
                    </span>
                    {row.unread_count > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] flex items-center justify-center shrink-0">
                        {row.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    {row.last_message_text ? (
                      <>
                        <span className="opacity-60">
                          {row.last_message_dir === "outbound" ? "Tú: " : ""}
                        </span>
                        {row.last_message_text}
                      </>
                    ) : (
                      row.telefono
                    )}
                  </p>
                  {row.last_message_at && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(row.last_message_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
          {hasMore && rows.length > 0 && (
            <div className="flex items-center justify-center py-3">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cargar más
                </button>
              )}
            </div>
          )}
        </ScrollArea>
      </Card>

      <Sheet open={!!openContactState} onOpenChange={(o) => !o && setOpenContactState(null)}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-2xl lg:max-w-3xl flex flex-col"
        >
          {openContactState && (
            <ChatArea
              selectedContact={openContactState}
              onContactUpdate={(c) => setOpenContactState(c)}
              onBack={() => setOpenContactState(null)}
              allTags={allTags}
              onTagsRefresh={refreshTags}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

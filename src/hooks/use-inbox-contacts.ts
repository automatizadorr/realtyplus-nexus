import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InboxContactRow {
  id: string;
  nombre: string | null;
  telefono: string;
  pais: string | null;
  estado: string | null;
  bot_activo: boolean | null;
  archivado: boolean | null;
  tag_ids: string[] | null;
  last_message_at: string | null;
  unread_count: number;
  last_message_text: string | null;
  last_message_dir: string | null;
  first_message_dir: string | null;
  first_message_at: string | null;
  inbound_count: number | null;
  outbound_count: number | null;
  is_ai_initiated: boolean | null;
}

export type InboxFilter = "all" | "unread" | "bot_on" | "bot_off" | "archived" | "ai_initiated";
export type DateFilter = "all" | "today" | "7d" | "30d";

interface Params {
  search: string;
  filter: InboxFilter;
  tagId: string; // "all" or uuid
  country?: string; // "all" or country name
  dateRange?: DateFilter;
  pageSize?: number;
}

const SELECT_COLS =
  "id, nombre, telefono, pais, estado, bot_activo, archivado, tag_ids, last_message_at, unread_count, last_message_text, last_message_dir, first_message_dir, first_message_at, inbound_count, outbound_count, is_ai_initiated";

export function useInboxContacts({ search, filter, tagId, country = "all", pageSize = 50 }: Params) {
  const [rows, setRows] = useState<InboxContactRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const reqIdRef = useRef(0);

  // Reset page when filters/search change
  useEffect(() => {
    setPage(0);
    setRows([]);
    setHasMore(true);
  }, [search, filter, tagId, country]);

  const fetchPage = useCallback(
    async (pageToFetch: number, replace: boolean) => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      const from = pageToFetch * pageSize;
      const to = from + pageSize - 1;

      let q = (supabase as any)
        .from("vista_inbox_contactos")
        .select(SELECT_COLS, { count: "estimated" });

      // Archived split
      if (filter === "archived") q = q.eq("archivado", true);
      else q = q.or("archivado.is.null,archivado.eq.false");

      if (filter === "unread") q = q.gt("unread_count", 0);
      else if (filter === "bot_on") q = q.eq("bot_activo", true);
      else if (filter === "bot_off") q = q.eq("bot_activo", false);

      if (tagId !== "all") q = q.contains("tag_ids", [tagId]);
      if (country && country !== "all") q = q.eq("pais", country);

      if (search.trim()) {
        const s = search.trim().replace(/[,()]/g, " ");
        q = q.or(`nombre.ilike.%${s}%,telefono.ilike.%${s}%`);
      }

      q = q
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (myReq !== reqIdRef.current) return; // stale
      if (error) {
        console.error("[useInboxContacts]", error);
        setLoading(false);
        return;
      }
      const newRows = (data || []) as InboxContactRow[];
      setRows((prev) => (replace ? newRows : [...prev, ...newRows]));
      if (typeof count === "number") setTotal(count);
      setHasMore(newRows.length === pageSize);
      setLoading(false);
    },
    [search, filter, tagId, country, pageSize],
  );

  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, false);
  }, [page, loading, hasMore, fetchPage]);

  // Refresh a single phone row (used by realtime)
  const refreshPhone = useCallback(
    async (phoneRaw: string) => {
      const phoneBase = (phoneRaw || "").split("@")[0];
      if (!phoneBase) return;
      const { data } = await (supabase as any)
        .from("vista_inbox_contactos")
        .select(SELECT_COLS)
        .eq("telefono", phoneBase)
        .maybeSingle();
      if (!data) return;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.telefono === data.telefono);
        if (idx === -1) {
          // new row -> prepend (sorted by last_message_at desc)
          return [data as InboxContactRow, ...prev];
        }
        const next = prev.slice();
        next[idx] = data as InboxContactRow;
        // re-sort just in case last_message_at changed
        next.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
        return next;
      });
    },
    [],
  );

  // Optimistic local mutation (e.g., after marking as read)
  const patchPhone = useCallback((phoneRaw: string, patch: Partial<InboxContactRow>) => {
    const phoneBase = (phoneRaw || "").split("@")[0];
    setRows((prev) => prev.map((r) => (r.telefono === phoneBase ? { ...r, ...patch } : r)));
  }, []);

  const removePhone = useCallback((phoneRaw: string) => {
    const phoneBase = (phoneRaw || "").split("@")[0];
    setRows((prev) => prev.filter((r) => r.telefono !== phoneBase));
  }, []);

  return { rows, loading, page, total, hasMore, loadMore, refreshPhone, patchPhone, removePhone };
}

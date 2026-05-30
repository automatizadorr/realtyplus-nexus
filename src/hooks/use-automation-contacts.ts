import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationContactRow {
  telefono: string;
  nombre: string | null;
  pais: string | null;
  campaign_name: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_dir: string | null;
  unread_count: number;
  ultimo_estado: string | null;
  ultimo_dia: number | null;
  total_mensajes: number | null;
}

export type AutomationEstadoFilter = "all" | "enviado" | "respondido" | "fallido";
export type AutomationDireccionFilter = "all" | "inbound" | "outbound";

interface Params {
  search: string;
  campaign: string; // "all" or name
  country: string; // "all" or name
  estado: AutomationEstadoFilter;
  direccion: AutomationDireccionFilter;
  pageSize?: number;
}

const SELECT_COLS =
  "telefono, nombre, pais, campaign_name, last_message_at, last_message_text, last_message_dir, unread_count, ultimo_estado, ultimo_dia, total_mensajes";

export function useAutomationContacts({
  search,
  campaign,
  country,
  estado,
  direccion,
  pageSize = 30,
}: Params) {
  const [rows, setRows] = useState<AutomationContactRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    setPage(0);
    setRows([]);
    setHasMore(true);
  }, [search, campaign, country, estado, direccion]);

  const fetchPage = useCallback(
    async (pageToFetch: number, replace: boolean) => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      const from = pageToFetch * pageSize;
      const to = from + pageSize - 1;

      let q = (supabase as any)
        .from("vista_inbox_automatizacion")
        .select(SELECT_COLS, { count: "estimated" });

      if (campaign !== "all") q = q.eq("campaign_name", campaign);
      if (country !== "all") q = q.eq("pais", country);
      if (estado !== "all") q = q.eq("ultimo_estado", estado);
      if (direccion !== "all") q = q.eq("last_message_dir", direccion);

      if (search.trim()) {
        const s = search.trim().replace(/[,()]/g, " ");
        q = q.or(`nombre.ilike.%${s}%,telefono.ilike.%${s}%`);
      }

      q = q
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (myReq !== reqIdRef.current) return;
      if (error) {
        console.error("[useAutomationContacts]", error);
        setLoading(false);
        return;
      }
      const newRows = (data || []) as AutomationContactRow[];
      setRows((prev) => (replace ? newRows : [...prev, ...newRows]));
      if (typeof count === "number") setTotal(count);
      setHasMore(newRows.length === pageSize);
      setLoading(false);
    },
    [search, campaign, country, estado, direccion, pageSize],
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

  const refreshPhone = useCallback(async (phoneRaw: string) => {
    const phoneBase = (phoneRaw || "").split("@")[0];
    if (!phoneBase) return;
    const { data } = await (supabase as any)
      .from("vista_inbox_automatizacion")
      .select(SELECT_COLS)
      .eq("telefono", phoneBase)
      .maybeSingle();
    if (!data) return;
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.telefono === data.telefono);
      const next = idx === -1 ? [data as AutomationContactRow, ...prev] : prev.slice();
      if (idx !== -1) next[idx] = data as AutomationContactRow;
      next.sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
      return next;
    });
  }, []);

  const patchPhone = useCallback((phoneRaw: string, patch: Partial<AutomationContactRow>) => {
    const phoneBase = (phoneRaw || "").split("@")[0];
    setRows((prev) => prev.map((r) => (r.telefono === phoneBase ? { ...r, ...patch } : r)));
  }, []);

  const removePhone = useCallback((phoneRaw: string) => {
    const phoneBase = (phoneRaw || "").split("@")[0];
    setRows((prev) => prev.filter((r) => r.telefono !== phoneBase));
  }, []);

  return { rows, loading, page, total, hasMore, loadMore, refreshPhone, patchPhone, removePhone };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Tag, Users, MessageSquare, ArrowLeft, FileText, FileSpreadsheet, ExternalLink, Send, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { orderTags } from "@/lib/permanentTags";
import { motion } from "framer-motion";
import { AnimatedNumber, kpiGrid, kpiItem } from "@/components/AnimatedNumber";

interface LeadTag { id: string; nombre: string; color: string; es_permanente?: boolean | null; }

type TagFull = { id: string; nombre: string; color: string; es_permanente?: boolean | null };

function orderedOutputTags(tagsFull: TagFull[], byTag: Map<string, any[]>, tagFilter: string): TagFull[] {
  if (tagFilter !== "all") {
    const t = tagsFull.find((x) => x.id === tagFilter);
    return t ? [t] : [];
  }
  const permanentes = orderTags(tagsFull.filter((t) => t.es_permanente));
  const extras = tagsFull
    .filter((t) => !t.es_permanente && byTag.has(t.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return [...permanentes, ...extras];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function yesNo(val: boolean | null): string {
  if (val === null || val === undefined) return "";
  return val ? "Sí" : "No";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const normPhone = (t?: string | null) => (t ?? "").split("@")[0].replace(/\D/g, "");

const msgTime = (m: any) => {
  const t = m?.created_at ? new Date(m.created_at).getTime() : NaN;
  return Number.isNaN(t) ? Infinity : t;
};

async function fetchMsgs(table: "mensajes_whatsapp" | "mensajes_automatizacion", phones: string[]) {
  const clean = [...new Set(phones.map((p) => normPhone(p)).filter(Boolean))];
  if (clean.length === 0) return [];
  const out: any[] = [];
  const CHUNK = 40;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const batch = clean.slice(i, i + CHUNK);
    const orFilter = batch
      .flatMap((p) => [`telefono.eq.${p}`, `telefono.like.${p}@%`])
      .join(",");
    const { data, error } = await (supabase as any).from(table).select("*").or(orFilter);
    if (error) throw error;
    if (data) out.push(...data);
  }
  return out;
}

function buildMsgsByPhone(leads: any[], msgsWA: any[], msgsAuto: any[]) {
  const all = [
    ...msgsWA.map((m: any)  => ({ ...m, _canal: "WhatsApp" })),
    ...msgsAuto.map((m: any) => ({ ...m, _canal: m.canal ?? "Auto" })),
  ];

  const seen = new Set<string>();
  const deduped = all.filter((m: any) => {
    const key = `${normPhone(m.telefono)}|${m.direccion}|${m.created_at ?? ""}|${(m.contenido ?? "").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => msgTime(a) - msgTime(b));

  const byPhone = new Map<string, any[]>();
  for (const l of leads) byPhone.set(normPhone(l.telefono), []);
  for (const m of deduped) {
    const arr = byPhone.get(normPhone(m.telefono));
    if (arr) arr.push(m);
  }
  return byPhone;
}

async function fetchData(tagFilter: string) {
  const { data: tags } = await supabase.from("lead_tags").select("id, nombre, color, es_permanente");
  const tagsFull = (tags ?? []) as TagFull[];
  const tagMap = new Map<string, { nombre: string; color: string }>(
    tagsFull.map((t) => [t.id, { nombre: t.nombre, color: t.color }])
  );

  let leadsQuery = supabase
    .from("leads_campana").select("*")
    .not("tag_ids", "is", null).neq("tag_ids", "{}" as any);
  if (tagFilter !== "all") leadsQuery = leadsQuery.contains("tag_ids", [tagFilter]);
  const { data: leads, error: leadsErr } = await leadsQuery;
  if (leadsErr) throw leadsErr;
  if (!leads || leads.length === 0) throw new Error("Sin leads etiquetados con el filtro seleccionado.");

  const phones = leads.map((l) => l.telefono);
  const [msgsWA, msgsAuto] = await Promise.all([
    fetchMsgs("mensajes_whatsapp", phones),
    fetchMsgs("mensajes_automatizacion", phones),
  ]);

  return { tagMap, tagsFull, leads, phones, msgsWA, msgsAuto };
}

// ── Helpers archivados ────────────────────────────────────────────────────────
const normTagName = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function getSigueId(tagsFull: TagFull[]): string | null {
  return tagsFull.find((t) => normTagName(t.nombre) === "sigue en campana")?.id ?? null;
}

function filterArchivados(leads: any[], sigueId: string | null): any[] {
  if (!sigueId) return leads;
  return leads.filter((l: any) => !(l.tag_ids ?? []).includes(sigueId));
}

export default function TaggedExport() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Tab activo ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"expansion" | "archivados">("expansion");

  // ── Estado Expansión ──────────────────────────────────────────────────────
  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("all-excl-sigue");
  const [loadingStats, setLoadingStats] = useState(false);
  const [generatingXlsx, setGeneratingXlsx] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);
  const [sendingN8n, setSendingN8n] = useState(false);
  const [statsLeads, setStatsLeads] = useState<number | null>(null);
  const [statsMsgs, setStatsMsgs] = useState<number | null>(null);

  // ── Estado Archivados ─────────────────────────────────────────────────────
  const [tagFilterA, setTagFilterA] = useState<string>("all");
  const [loadingStatsA, setLoadingStatsA] = useState(false);
  const [statsLeadsA, setStatsLeadsA] = useState<number | null>(null);
  const [statsMsgsA, setStatsMsgsA] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color, es_permanente").order("nombre")
      .then(({ data }) => { if (data) setAllTags(orderTags(data as LeadTag[])); });
  }, []);

  // Stats Expansión
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        let q = supabase.from("leads_campana")
          .select("id, telefono", { count: "exact" })
          .not("tag_ids", "is", null).neq("tag_ids", "{}" as any);
        if (tagFilter !== "all" && tagFilter !== "all-excl-sigue") q = q.contains("tag_ids", [tagFilter]);
        const { data: rawLeadsStats } = await q;
        let leadsStats = rawLeadsStats ?? [];
        if (tagFilter === "all-excl-sigue") {
          const { data: tgs } = await supabase.from("lead_tags").select("id, nombre");
          const sId = getSigueId((tgs ?? []) as TagFull[]);
          leadsStats = filterArchivados(leadsStats, sId);
        }
        setStatsLeads(leadsStats.length);
        if (leadsStats.length > 0) {
          const phones = leadsStats.map((l: any) => l.telefono);
          const [{ count: c1 }, { count: c2 }] = await Promise.all([
            supabase.from("mensajes_whatsapp").select("id", { count: "exact", head: true }).in("telefono", phones),
            supabase.from("mensajes_automatizacion").select("id", { count: "exact", head: true }).in("telefono", phones),
          ]);
          setStatsMsgs((c1 ?? 0) + (c2 ?? 0));
        } else setStatsMsgs(0);
      } finally { setLoadingStats(false); }
    };
    fetchStats();
  }, [tagFilter]);

  // Stats Archivados
  useEffect(() => {
    const fetchStatsA = async () => {
      setLoadingStatsA(true);
      try {
        const { data: tags } = await supabase.from("lead_tags").select("id, nombre");
        const sigueId = getSigueId((tags ?? []) as TagFull[]);

        let q = supabase.from("leads_campana")
          .select("id, telefono, tag_ids")
          .not("tag_ids", "is", null).neq("tag_ids", "{}" as any);
        if (tagFilterA !== "all") q = q.contains("tag_ids", [tagFilterA]);
        const { data: leads } = await q;

        const archivados = filterArchivados(leads ?? [], sigueId);
        setStatsLeadsA(archivados.length);

        if (archivados.length > 0) {
          const phones = archivados.map((l: any) => l.telefono);
          const [{ count: c1 }, { count: c2 }] = await Promise.all([
            supabase.from("mensajes_whatsapp").select("id", { count: "exact", head: true }).in("telefono", phones),
            supabase.from("mensajes_automatizacion").select("id", { count: "exact", head: true }).in("telefono", phones),
          ]);
          setStatsMsgsA((c1 ?? 0) + (c2 ?? 0));
        } else setStatsMsgsA(0);
      } finally { setLoadingStatsA(false); }
    };
    fetchStatsA();
  }, [tagFilterA]);

  // ── HTML VISUAL ────────────────────────────────────────────────────────────
  const handleOpenHtml = async () => {
    setGeneratingHtml(true);
    try {
      const isArch = activeTab === "archivados";
      const rawFilter = isArch ? tagFilterA : tagFilter;
      const fetchFilter = rawFilter === "all-excl-sigue" ? "all" : rawFilter;
      const exclSigue = isArch || rawFilter === "all-excl-sigue";
      const { tagMap, tagsFull, leads: rawLeads, msgsWA, msgsAuto } = await fetchData(fetchFilter);
      const sigueId = getSigueId(tagsFull);
      const leads = exclSigue ? filterArchivados(rawLeads, sigueId) : rawLeads;
      if (!leads.length) throw new Error("Sin leads con el filtro seleccionado.");

      const msgsByPhone = buildMsgsByPhone(leads, msgsWA, msgsAuto);
      const totalMsgs = [...msgsByPhone.values()].reduce((a, arr) => a + arr.length, 0);

      const esc = (s: string) => (s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      const fmtTs = (iso: string | null) => {
        if (!iso) return "";
        const d = new Date(iso);
        return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
          + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      };
      const fmtDate = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

      const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

      const totalLeads   = leads.length;
      const respondieron = leads.filter((l: any) => l.ha_respondido).length;
      const sinResp      = leads.filter((l: any) => !l.ha_respondido && !l.archivado).length;
      const tasa         = totalLeads > 0 ? Math.round(respondieron / totalLeads * 100) : 0;
      const multiTag     = leads.filter((l: any) => (l.tag_ids ?? []).length > 1).length;

      const buildLeadCard = (l: any, currentTag?: { nombre: string; color: string }) => {
        const msgs      = msgsByPhone.get(normPhone(l.telefono)) ?? [];
        const enviados  = msgs.filter((m: any) => m.direccion === "outbound").length;
        const recibidos = msgs.filter((m: any) => m.direccion === "inbound").length;
        const ultimoMsg = msgs.at(-1);

        const otrasEtqs = (l.tag_ids ?? []).map((id: string) => {
          const t = tagMap.get(id);
          return t ? `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${t.nombre}</span>` : "";
        }).join("");

        const bubbles = msgs.map((m: any) => {
          const esBot     = m.direccion === "outbound";
          const esWhats   = (m._canal ?? "").toLowerCase() === "whatsapp";
          const canalBadge = esWhats ? "" : `<span class="canal-badge">${esc(m._canal)}</span>`;
          const txt       = esc((m.contenido ?? "").trim());
          return `<div class="brow ${esBot ? "out" : "in"}">
            <div class="bub ${esBot ? "bout" : "bin"}">
              ${canalBadge}
              <div class="btxt">${txt || "<em style='opacity:.4'>Media</em>"}</div>
              <div class="bts">${fmtTs(m.created_at)}</div>
            </div></div>`;
        }).join("");

        return `<details class="lead-block">
          <summary class="lead-summary">
            <div class="lavatar">${(l.nombre ?? "?")[0].toUpperCase()}</div>
            <div class="linfo">
              <div class="lname">
                ${esc(l.nombre ?? "Sin nombre")}
                ${currentTag ? `<span class="tag-chip" style="background:${currentTag.color}22;color:${currentTag.color};border:1px solid ${currentTag.color}55;font-size:10px;margin-left:6px;vertical-align:middle">${esc(currentTag.nombre)}</span>` : ""}
              </div>
              <div class="lmeta">📱 ${esc(l.telefono ?? "")}${l.pais ? ` &nbsp;·&nbsp; 🌍 ${esc(l.pais)}` : ""}${l.email ? ` &nbsp;·&nbsp; ✉ ${esc(l.email)}` : ""}</div>
              <div class="lbadges">
                <span class="ebadge">${esc(l.estado ?? "sin estado")}</span>
                ${l.id_contacto ? `<span class="idbadge">ID ${esc(l.id_contacto)}</span>` : ""}
                ${l.bot_activo  ? `<span class="botbadge">🤖 Bot</span>` : ""}
                ${l.ha_respondido ? `<span class="respbadge">✅ Respondió</span>` : ""}
              </div>
            </div>
            <div class="lstats">
              <div class="stat"><b style="color:#22c55e">${enviados}</b><small>Env</small></div>
              <div class="stat"><b style="color:#3b82f6">${recibidos}</b><small>Rec</small></div>
              <div class="stat"><b>${msgs.length}</b><small>Total</small></div>
              <div class="stat"><b>${l.puntuacion ?? "—"}</b><small>Punt</small></div>
            </div>
            <span class="arrow">›</span>
          </summary>
          <div class="lead-body">
            ${otrasEtqs ? `<div class="etqs-row">${otrasEtqs}</div>` : ""}
            <div class="dates-row">
              Último contacto: <b>${fmtDate(l.ultimo_contacto_at)}</b>
              ${l.fecha_respuesta ? ` &nbsp;·&nbsp; Respuesta: <b>${fmtDate(l.fecha_respuesta)}</b>` : ""}
              ${l.fecha_proximo_contacto ? ` &nbsp;·&nbsp; Próximo: <b>${fmtDate(l.fecha_proximo_contacto)}</b>` : ""}
              ${l.origen ? ` &nbsp;·&nbsp; Origen: <b>${esc(l.origen)}</b>` : ""}
              ${l.dias_reales != null ? ` &nbsp;·&nbsp; Días: <b>${l.dias_reales}</b>` : ""}
            </div>
            ${msgs.length > 0
              ? `<div class="chat-hdr"><span>💬 ${msgs.length} mensajes</span>${ultimoMsg ? `<span>Último: ${fmtTs(ultimoMsg.created_at)}</span>` : ""}</div>
                 <div class="chat-area">${bubbles}</div>`
              : `<div class="no-msgs">Sin mensajes registrados</div>`}
          </div>
        </details>`;
      };

      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      const orderedTags = orderedOutputTags(tagsFull, byTag, fetchFilter)
        .filter((t) => !exclSigue || t.id !== sigueId);

      const tagSections = orderedTags.map((tag) => {
        const tLeads = byTag.get(tag.id) ?? [];
        const tResp  = tLeads.filter((l: any) => l.ha_respondido).length;
        const tTasa  = tLeads.length ? Math.round(tResp / tLeads.length * 100) : 0;
        const tMsgs  = tLeads.reduce((acc: number, l: any) => acc + (msgsByPhone.get(normPhone(l.telefono))?.length ?? 0), 0);
        const cards  = tLeads.length
          ? tLeads.map((l: any) => buildLeadCard(l, tag)).join("")
          : `<div class="no-msgs">Sin leads en esta etiqueta</div>`;

        return `<details class="tag-section" ${tLeads.length ? "open" : ""}>
          <summary class="tag-summary" style="border-left:4px solid ${tag.color}">
            <span class="tag-dot" style="background:${tag.color}"></span>
            <span class="tag-title">${esc(tag.nombre)}</span>
            <span class="tag-pill" style="background:${tag.color}22;color:${tag.color}">${tLeads.length} ${tLeads.length === 1 ? "lead" : "leads"}</span>
            <span class="tag-pill2">${tResp} ${tResp === 1 ? "respondió" : "respondieron"} &nbsp;·&nbsp; ${tTasa}%</span>
            <span class="tag-pill2">${tMsgs} mensajes</span>
            <span class="tag-arrow">▾</span>
          </summary>
          <div class="tag-body">${cards}</div>
        </details>`;
      }).join("");

      const pageTitle = isArch ? "📦 Leads Archivados" : exclSigue ? "📋 Leads Etiquetados (excl. Sigue en campaña)" : "📋 Leads Etiquetados";
      const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${isArch ? "Archivados" : "Etiquetados"} — ${today}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e2e8f0;font-size:13px;line-height:1.5}
.ph{background:linear-gradient(135deg,#1a0e3a,#0f1117);border-bottom:1px solid #7c3aed;padding:20px 28px}
.ph h1{font-size:20px;font-weight:700;color:#a78bfa}.ph p{color:#94a3b8;font-size:11px;margin-top:3px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 28px}
.kpi{background:#1a1d27;border:1px solid #2e3250;border-radius:8px;padding:14px;text-align:center}
.kpi b{display:block;font-size:24px;color:#a78bfa}.kpi small{font-size:10px;color:#94a3b8}
.main{padding:0 28px 40px}
.tag-section{background:#1a1d27;border:1px solid #2e3250;border-radius:12px;margin-bottom:16px;overflow:hidden}
.tag-summary{display:flex;align-items:center;gap:10px;padding:14px 18px;cursor:pointer;user-select:none;list-style:none;background:#1e2235}
.tag-summary::-webkit-details-marker{display:none}
.tag-summary:hover{background:#252a40}
.tag-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.tag-title{font-size:15px;font-weight:700;flex:1}
.tag-pill{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.tag-pill2{font-size:11px;color:#94a3b8}
.tag-arrow{font-size:18px;color:#7c3aed;transition:transform .2s;margin-left:auto}
details[open] .tag-arrow{transform:rotate(90deg)}
details[open] .arrow{transform:rotate(90deg)}
.tag-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.lead-block{background:#13162a;border:1px solid #2e3250;border-radius:10px;overflow:hidden}
.lead-summary{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;user-select:none;list-style:none}
.lead-summary::-webkit-details-marker{display:none}
.lead-summary:hover{background:#1a1f35}
.lavatar{width:38px;height:38px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0}
.linfo{flex:1;min-width:0}
.lname{font-size:13px;font-weight:700}.lmeta{font-size:11px;color:#94a3b8;margin-top:2px}
.lbadges{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.ebadge{background:#2e3250;color:#94a3b8;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600}
.idbadge{background:#1e1b4b;color:#a78bfa;padding:1px 7px;border-radius:4px;font-size:10px}
.botbadge{background:#14532d;color:#86efac;padding:1px 7px;border-radius:4px;font-size:10px}
.respbadge{background:#14532d;color:#86efac;padding:1px 7px;border-radius:4px;font-size:10px}
.lstats{display:flex;gap:12px;flex-shrink:0;text-align:center}
.stat b{display:block;font-size:16px;font-weight:700}.stat small{font-size:10px;color:#64748b}
.arrow{font-size:16px;color:#4b5563;transition:transform .2s}
.lead-body{border-top:1px solid #2e3250}
.etqs-row{display:flex;flex-wrap:wrap;gap:5px;padding:8px 14px;border-bottom:1px solid #2e3250}
.tag-chip{padding:2px 9px;border-radius:20px;font-size:10px;font-weight:600}
.dates-row{padding:7px 14px;font-size:11px;color:#4b5563;border-bottom:1px solid #2e3250}
.dates-row b{color:#94a3b8}
.no-msgs{padding:12px 14px;color:#374151;font-style:italic;font-size:12px}
.chat-hdr{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#128C7E;color:#fff;font-size:11px;font-weight:600}
.chat-area{background:#0b1a12;padding:12px 14px;max-height:420px;overflow-y:auto}
.brow{display:flex;margin-bottom:7px}
.brow.out{justify-content:flex-end}.brow.in{justify-content:flex-start}
.bub{max-width:72%;padding:7px 11px;border-radius:11px;word-break:break-word}
.bout{background:#005C4B;color:#e9feee;border-bottom-right-radius:2px}
.bin{background:#1f2c34;color:#e2e8f0;border-bottom-left-radius:2px}
.btxt{font-size:12px;line-height:1.5}
.bts{font-size:10px;opacity:.55;text-align:right;margin-top:3px}
.canal-badge{display:inline-block;background:rgba(255,255,255,.12);border-radius:3px;padding:0 4px;font-size:9px;margin-bottom:3px}
@media(max-width:600px){
  .kpis{grid-template-columns:repeat(2,1fr)}.main,.kpis{padding-left:14px;padding-right:14px}
  .lead-summary{flex-wrap:wrap}.lstats{width:100%;justify-content:space-around;margin-top:8px}
  .bub{max-width:88%}
}
</style></head><body>
<div class="ph">
  <h1>${pageTitle}</h1>
  <p>Generado el ${today} &nbsp;·&nbsp; ${totalLeads} leads únicos &nbsp;·&nbsp; ${totalMsgs} mensajes &nbsp;·&nbsp; ${byTag.size} etiquetas</p>
  ${multiTag > 0 ? `<p style="margin-top:5px;color:#64748b;font-size:10px">ℹ️ ${multiTag} ${multiTag === 1 ? "lead está" : "leads están"} en varias etiquetas: aparecen en cada sección.</p>` : ""}
</div>
<div class="kpis">
  <div class="kpi"><b>${totalLeads}</b><small>Total leads</small></div>
  <div class="kpi"><b style="color:#22c55e">${respondieron}</b><small>Respondieron</small></div>
  <div class="kpi"><b style="color:#f97316">${sinResp}</b><small>Sin respuesta</small></div>
  <div class="kpi"><b>${tasa}%</b><small>Tasa respuesta</small></div>
</div>
<div class="main">${tagSections}</div>
<div style="text-align:center;padding:16px;color:#374151;font-size:10px">RealtyPlus Nexus · AI-MaX Intelligence · ${today}</div>
</body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast({ title: "Reporte abierto", description: `${byTag.size} etiquetas · ${totalLeads} leads · ${totalMsgs} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingHtml(false);
    }
  };

  // ── ENVÍO A N8N ───────────────────────────────────────────────────────────
  const handleSendN8n = async () => {
    setSendingN8n(true);
    try {
      const fetchFilterN8n = tagFilter === "all-excl-sigue" ? "all" : tagFilter;
      const { tagMap, tagsFull, leads, msgsWA, msgsAuto } = await fetchData(fetchFilterN8n);

      const normTag = (s: string) =>
        (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const sigueId = tagsFull.find((t) => normTag(t.nombre) === "sigue en campana")?.id ?? null;
      const leadsEnviar = sigueId
        ? leads.filter((l: any) => !(l.tag_ids ?? []).includes(sigueId))
        : leads;
      if (leadsEnviar.length === 0) {
        toast({ title: "Nada que enviar", description: "Todos los leads del filtro están en 'Sigue en campaña' (no van a expansión)." });
        return;
      }

      const msgsByPhone = buildMsgsByPhone(leadsEnviar, msgsWA, msgsAuto);
      const totalMsgs = [...msgsByPhone.values()].reduce((a, arr) => a + arr.length, 0);

      const byTag = new Map<string, any[]>();
      for (const l of leadsEnviar) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      const orderedTags = orderedOutputTags(tagsFull, byTag, fetchFilterN8n).filter((t) => t.id !== sigueId);
      const etiquetas = orderedTags.map((tag) => {
        const tLeads    = byTag.get(tag.id) ?? [];
        const tResp     = tLeads.filter((l: any) => l.ha_respondido).length;
        const tasaResp  = tLeads.length ? Math.round(tResp / tLeads.length * 100) : 0;

        const leadsPayload = tLeads.map((l: any) => {
          const msgs = msgsByPhone.get(normPhone(l.telefono)) ?? [];
          return {
            id_contacto:          l.id_contacto ?? null,
            nombre:               l.nombre ?? "",
            telefono:             l.telefono ?? "",
            email:                l.email ?? null,
            pais:                 l.pais ?? null,
            estado:               l.estado ?? null,
            bot_activo:           l.bot_activo ?? null,
            ha_respondido:        l.ha_respondido ?? null,
            archivado:            l.archivado ?? null,
            puntuacion:           l.puntuacion ?? null,
            dias_reales:          l.dias_reales ?? null,
            origen:               l.origen ?? null,
            ultimo_contacto_at:   l.ultimo_contacto_at ?? null,
            fecha_respuesta:      l.fecha_respuesta ?? null,
            fecha_proximo_contacto: l.fecha_proximo_contacto ?? null,
            etiquetas:            (l.tag_ids ?? []).map((id: string) => tagMap.get(id)?.nombre ?? id),
            mensajes_enviados:    msgs.filter((m: any) => m.direccion === "outbound").length,
            mensajes_recibidos:   msgs.filter((m: any) => m.direccion === "inbound").length,
            total_mensajes:       msgs.length,
            conversacion:         msgs.map((m: any) => ({
              fecha:      m.created_at ?? null,
              direccion:  m.direccion ?? null,
              canal:      m._canal ?? null,
              contenido:  m.contenido ?? null,
              autor:      m.autor ?? (m.direccion === "outbound" ? "Bot" : "Cliente"),
              estado_envio: m.estado_envio ?? null,
            })),
          };
        });

        return {
          id:             tag.id,
          nombre:         tag.nombre,
          color:          tag.color,
          es_permanente:  !!tag.es_permanente,
          total_leads:    tLeads.length,
          respondieron:   tResp,
          tasa_respuesta: tasaResp,
          leads:          leadsPayload,
        };
      });

      const payload = {
        timestamp:      new Date().toISOString(),
        filtro:         tagFilter === "all" ? "todas" : (tagMap.get(tagFilter)?.nombre ?? tagFilter),
        total_leads:    leadsEnviar.length,
        total_mensajes: totalMsgs,
        total_etiquetas: etiquetas.length,
        total_etiquetas_con_leads: byTag.size,
        etiquetas,
      };

      const { error: whErr } = await supabase.functions.invoke("send-n8n-webhook", {
        body: { target: "expansion", payload },
      });
      if (whErr) throw whErr;

      toast({
        title: "Enviado a n8n ✓",
        description: `${leadsEnviar.length} leads · ${totalMsgs} mensajes · ${byTag.size} etiquetas enviados a /expansion`,
      });
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSendingN8n(false);
    }
  };

  // ── EXCEL ─────────────────────────────────────────────────────────────────
  const handleExcel = async () => {
    setGeneratingXlsx(true);
    try {
      const isArch = activeTab === "archivados";
      const rawFilter = isArch ? tagFilterA : tagFilter;
      const fetchFilter = rawFilter === "all-excl-sigue" ? "all" : rawFilter;
      const exclSigue = isArch || rawFilter === "all-excl-sigue";
      const { tagMap, tagsFull, leads: rawLeads, msgsWA, msgsAuto } = await fetchData(fetchFilter);
      const sigueId = getSigueId(tagsFull);
      const leads = exclSigue ? filterArchivados(rawLeads, sigueId) : rawLeads;
      if (!leads.length) throw new Error("Sin leads con el filtro seleccionado.");

      const msgsByPhone = buildMsgsByPhone(leads, msgsWA, msgsAuto);
      const msgStats = new Map<string, { enviados: number; recibidos: number; ultimoMsg: string; ultimaFecha: string }>();
      for (const [phone, msgs] of msgsByPhone) {
        const enviados  = msgs.filter((m: any) => m.direccion === "outbound").length;
        const recibidos = msgs.filter((m: any) => m.direccion === "inbound").length;
        const last = msgs.at(-1);
        msgStats.set(phone, {
          enviados, recibidos,
          ultimoMsg: (last?.contenido ?? "").slice(0, 80),
          ultimaFecha: last?.created_at ?? "",
        });
      }

      const rows = leads.map((l) => {
        const etiquetas = (l.tag_ids ?? []).map((id: string) => tagMap.get(id)?.nombre ?? id).join(", ");
        const etiquetasIds = (l.tag_ids ?? []).join(", ");
        const s = msgStats.get(normPhone(l.telefono)) ?? { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" };
        const telDigits = normPhone(l.telefono);
        const telE164 = telDigits ? `+${telDigits}` : "";
        const telWa = telDigits ? `https://wa.me/${telDigits}` : "";
        return {
          "ID Lead":            l.id ?? "",
          "ID Contacto":        l.id_contacto ?? "",
          "Nombre":             l.nombre ?? "",
          "Teléfono":           l.telefono ?? "",
          "Teléfono (E.164)":   telE164,
          "Teléfono (dígitos)": telDigits,
          "WhatsApp Link":      telWa,
          "Email":              l.email ?? "",
          "País":               l.pais ?? "",
          "Timezone":           l.timezone ?? "",
          "Estado":             l.estado ?? "",
          "Motivo Cierre":      l.motivo_cierre ?? "",
          "Etiquetas":          etiquetas,
          "Etiquetas (IDs)":    etiquetasIds,
          "Bot Activo":         yesNo(l.bot_activo),
          "Archivado":          yesNo(l.archivado),
          "Ha Respondido":      yesNo(l.ha_respondido),
          "Puntuación":         l.puntuacion ?? "",
          "Fase Secuencia":     l.fase_secuencia ?? "",
          "Días Reales":        l.dias_reales ?? "",
          "Origen":             l.origen ?? "",
          "Franquiciado ID":    l.franquiciado_id ?? "",
          "Creado":             formatDate(l.created_at),
          "Actualizado":        formatDate(l.updated_at),
          "Último Contacto":    formatDate(l.ultimo_contacto_at),
          "Fecha Respuesta":    formatDate(l.fecha_respuesta),
          "Próximo Contacto":   formatDate(l.fecha_proximo_contacto),
          "Msgs Enviados":      s.enviados,
          "Msgs Recibidos":     s.recibidos,
          "Msgs Total":         s.enviados + s.recibidos,
          "Último Mensaje":     s.ultimoMsg,
          "Fecha Último Msg":   formatDate(s.ultimaFecha),
        };
      });

      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }
      const tagsForResumen = orderedOutputTags(tagsFull, byTag, fetchFilter)
        .filter((t) => !exclSigue || t.id !== sigueId);
      const resumen = tagsForResumen.map((tag) => {
        const tLeads = byTag.get(tag.id) ?? [];
        const tResp  = tLeads.filter((l: any) => l.ha_respondido).length;
        const tMsgs  = tLeads.reduce((acc: number, l: any) => {
          const s = msgStats.get(normPhone(l.telefono));
          return acc + (s ? s.enviados + s.recibidos : 0);
        }, 0);
        return {
          "Etiqueta":     tag.nombre,
          "Permanente":   tag.es_permanente ? "Sí" : "No",
          "Leads":        tLeads.length,
          "Respondieron": tResp,
          "Tasa %":       tLeads.length ? Math.round(tResp / tLeads.length * 100) : 0,
          "Mensajes":     tMsgs,
        };
      });

      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const wsResumen = XLSX.utils.json_to_sheet(resumen);
      wsResumen["!cols"] = [28, 11, 8, 13, 8, 10].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Etiquetas");

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [36,14,28,16,18,16,28,32,14,10,14,18,30,30,11,11,14,11,11,11,14,36,18,18,18,18,18,12,12,12,40,20].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws, isArch ? "Leads Archivados" : "Leads Etiquetados");

      const today = new Date().toISOString().slice(0, 10);
      const label = rawFilter === "all" ? (isArch ? "archivados" : "todos")
        : rawFilter === "all-excl-sigue" ? "excl-sigue"
        : (tagMap.get(rawFilter)?.nombre ?? "filtro");
      XLSX.writeFile(wb, `leads-${label}-${today}.xlsx`);
      toast({ title: "Excel descargado", description: `${leads.length} leads exportados.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setGeneratingXlsx(false); }
  };

  // ── WORD ──────────────────────────────────────────────────────────────────
  const handleDocx = async () => {
    setGeneratingDocx(true);
    try {
      const isArch = activeTab === "archivados";
      const rawFilter = isArch ? tagFilterA : tagFilter;
      const fetchFilter = rawFilter === "all-excl-sigue" ? "all" : rawFilter;
      const exclSigue = isArch || rawFilter === "all-excl-sigue";
      const { tagMap, tagsFull, leads: rawLeads, msgsWA, msgsAuto } = await fetchData(fetchFilter);
      const sigueId = getSigueId(tagsFull);
      const leads = exclSigue ? filterArchivados(rawLeads, sigueId) : rawLeads;
      if (!leads.length) throw new Error("Sin leads con el filtro seleccionado.");

      const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Packer } = await import("docx");

      const msgsByPhone = buildMsgsByPhone(leads, msgsWA, msgsAuto);

      const divider = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "7C3AED" } },
        spacing: { before: 200, after: 200 },
      });

      const children: InstanceType<typeof Paragraph>[] = [];

      children.push(new Paragraph({
        text: isArch ? "Conversaciones — Leads Archivados" : "Conversaciones — Leads Etiquetados",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }));

      const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
      children.push(new Paragraph({
        children: [new TextRun({ text: `Generado el ${today}`, italics: true, color: "888888", size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }));

      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      const renderLead = (lead: any) => {
        const etiquetas = (lead.tag_ids ?? []).map((id: string) => tagMap.get(id)?.nombre ?? id).join("  ·  ");
        const msgs = msgsByPhone.get(normPhone(lead.telefono)) ?? [];

        children.push(new Paragraph({
          children: [new TextRun({ text: lead.nombre ?? "Sin nombre", bold: true, size: 26, color: "7C3AED" })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 60 },
        }));

        children.push(new Paragraph({
          children: [
            new TextRun({ text: `📱 ${lead.telefono ?? ""}`, size: 20 }),
            new TextRun({ text: `  |  🌍 ${lead.pais ?? ""}`, size: 20 }),
            lead.email ? new TextRun({ text: `  |  ✉ ${lead.email}`, size: 20 }) : new TextRun(""),
            new TextRun({ text: `  |  Estado: ${lead.estado ?? "—"}`, size: 20 }),
          ],
          spacing: { after: 60 },
        }));

        if (etiquetas) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `🏷  ${etiquetas}`, size: 20, italics: true, color: "555555" })],
            spacing: { after: 200 },
          }));
        }

        if (msgs.length === 0) {
          children.push(new Paragraph({
            children: [new TextRun({ text: "Sin mensajes registrados.", italics: true, color: "AAAAAA", size: 20 })],
            spacing: { after: 200 },
          }));
        } else {
          for (const m of msgs) {
            const esBot    = m.direccion === "outbound";
            const quien    = esBot ? "BOT" : "CLIENTE";
            const hora     = formatDate(m.created_at);
            const canal    = m._canal ? ` [${m._canal}]` : "";
            const contenido = (m.contenido ?? "").trim();

            children.push(new Paragraph({
              children: [
                new TextRun({ text: `[${hora}]${canal}  ${quien}:  `, bold: true, size: 20, color: esBot ? "2563EB" : "16A34A" }),
              ],
              spacing: { before: 120, after: 40 },
            }));

            const lineas = contenido.match(/.{1,120}(\s|$)/g) ?? [contenido];
            for (const linea of lineas) {
              children.push(new Paragraph({
                children: [new TextRun({ text: linea.trim(), size: 20 })],
                indent: { left: 400 },
                spacing: { after: 20 },
              }));
            }
          }
        }

        children.push(divider);
      };

      const orderedTags = orderedOutputTags(tagsFull, byTag, fetchFilter)
        .filter((t) => !exclSigue || t.id !== sigueId);

      for (const tag of orderedTags) {
        children.push(new Paragraph({
          children: [new TextRun({ text: tag.nombre.toUpperCase(), bold: true, size: 30, color: tag.color.replace("#", "") })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 500, after: 120 },
        }));

        const tLeads = byTag.get(tag.id) ?? [];
        if (!tLeads.length) {
          children.push(new Paragraph({
            children: [new TextRun({ text: "Sin leads en esta etiqueta.", italics: true, color: "AAAAAA", size: 20 })],
            spacing: { after: 200 },
          }));
          continue;
        }
        for (const lead of tLeads) renderLead(lead);
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const label = rawFilter === "all" ? (isArch ? "archivados" : "todos")
        : rawFilter === "all-excl-sigue" ? "excl-sigue"
        : (tagMap.get(rawFilter)?.nombre ?? rawFilter);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `conversaciones-${label}-${dateStr}.docx`);

      const totalMsgs = [...msgsByPhone.values()].reduce((acc, arr) => acc + arr.length, 0);
      toast({ title: "Word descargado", description: `${leads.length} leads · ${totalMsgs} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setGeneratingDocx(false); }
  };

  const isLoading = generatingXlsx || generatingDocx || generatingHtml || sendingN8n;

  // Tags sin "Sigue en campaña" para el select de Archivados
  const sigueTagId = allTags.find((t) => normTagName(t.nombre) === "sigue en campana")?.id;
  const archivadosTags = sigueTagId ? allTags.filter((t) => t.id !== sigueTagId) : allTags;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tagged")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">Reactivación</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Download className="h-6 w-6 text-accent" />
            Exportar etiquetados
          </h1>
          <p className="text-sm text-muted-foreground">
            Expansión · Archivados · Excel · Word · HTML · n8n
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "expansion" | "archivados")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expansion" className="flex items-center gap-1.5">
            <Send className="h-4 w-4" />
            Expansión
          </TabsTrigger>
          <TabsTrigger value="archivados" className="flex items-center gap-1.5">
            <Archive className="h-4 w-4" />
            Archivados
          </TabsTrigger>
        </TabsList>

        {/* ── TAB EXPANSIÓN ── */}
        <TabsContent value="expansion" className="mt-4 space-y-6">
          {/* Filtro */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/20">
                  <Tag className="h-4 w-4" />
                </span>
                Filtrar por etiqueta
              </CardTitle>
              <CardDescription>Exporta todos los leads o filtra por una etiqueta específica</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar etiqueta..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-excl-sigue">
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                      ARCHIVADOS
                    </span>
                  </SelectItem>
                  <SelectItem value="all">Todas las etiquetas</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Stats */}
          <motion.div variants={kpiGrid} initial="hidden" animate="show" className="grid grid-cols-2 gap-4">
            {[
              { label: "Leads", value: statsLeads, icon: Users, wrap: "from-primary/20 to-primary/5 text-primary ring-primary/25", bar: "from-primary/70 to-primary" },
              { label: "Mensajes", value: statsMsgs, icon: MessageSquare, wrap: "from-accent/20 to-accent/5 text-accent ring-accent/25", bar: "from-accent/70 to-accent" },
            ].map((s) => (
              <motion.div key={s.label} variants={kpiItem}>
                <Card className="relative overflow-hidden border-border/60">
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.bar}`} aria-hidden="true" />
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ${s.wrap}`}>
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      {loadingStats ? (
                        <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <p className="text-2xl font-bold tabular-nums">
                          {s.value == null ? "—" : <AnimatedNumber value={s.value} />}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Botones */}
          <motion.div variants={kpiGrid} initial="hidden" animate="show" className="grid grid-cols-1 gap-3">
            {[
              {
                title: "Leads Etiquetados (.xlsx)",
                desc: "Un lead por fila — ID, nombre, teléfono, email, país, estado, etiquetas, métricas de conversación y fechas clave.",
                icon: FileSpreadsheet, onClick: handleExcel, busy: generatingXlsx, label: "Descargar Excel",
                wrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/25", bar: "from-emerald-400 to-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700",
              },
              {
                title: "Conversaciones (.docx)",
                desc: "Un documento Word por filtro — cada lead con su ficha y conversación completa en formato chat, ordenada cronológicamente.",
                icon: FileText, onClick: handleDocx, busy: generatingDocx, label: "Descargar Word",
                wrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/25", bar: "from-blue-400 to-blue-600", btn: "bg-blue-600 hover:bg-blue-700",
              },
              {
                title: "Reporte Visual en Navegador (.html)",
                desc: "Abre todos los leads etiquetados con sus datos completos y conversaciones en estilo WhatsApp — burbujas, colores, timestamps.",
                icon: ExternalLink, onClick: handleOpenHtml, busy: generatingHtml, label: "Ver en Navegador",
                wrap: "from-orange-500/20 to-orange-500/5 text-orange-600 ring-orange-500/25", bar: "from-orange-400 to-orange-600", btn: "bg-orange-600 hover:bg-orange-700",
              },
              {
                title: "Enviar a n8n · /expansion",
                desc: "Envía todos los datos mapeados y depurados al webhook de expansión: leads por etiqueta, conversaciones completas, métricas y fechas.",
                icon: Send, onClick: handleSendN8n, busy: sendingN8n, label: "Enviar a n8n",
                wrap: "from-violet-500/20 to-violet-500/5 text-violet-600 ring-violet-500/25", bar: "from-violet-400 to-violet-600", btn: "bg-violet-600 hover:bg-violet-700",
              },
            ].map((f) => (
              <motion.div key={f.title} variants={kpiItem}>
                <Card className="relative overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${f.bar}`} aria-hidden="true" />
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${f.wrap}`}>
                        <f.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{f.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                    <Button
                      className={`w-full text-white ${f.btn}`}
                      onClick={f.onClick}
                      disabled={isLoading || statsLeads === 0}
                    >
                      {f.busy
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
                        : <><f.icon className="mr-2 h-4 w-4" />{f.label}</>}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {statsLeads === 0 && !loadingStats && (
            <p className="text-center text-sm text-muted-foreground">
              No hay leads etiquetados con el filtro seleccionado.
            </p>
          )}
        </TabsContent>

        {/* ── TAB ARCHIVADOS ── */}
        <TabsContent value="archivados" className="mt-4 space-y-6">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Leads clasificados con situaciones 1–5 — todos los gestionados excepto{" "}
              <em>Sigue en campaña</em>. Usa las descargas para revisión interna o archivo.
            </p>
          </div>

          {/* Filtro Archivados */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 ring-1 ring-amber-500/20">
                  <Tag className="h-4 w-4" />
                </span>
                Filtrar archivados
              </CardTitle>
              <CardDescription>Exporta todos los archivados o filtra por situación</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={tagFilterA} onValueChange={setTagFilterA}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar situación..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas (excl. Sigue en campaña)</SelectItem>
                  {archivadosTags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Stats Archivados */}
          <motion.div variants={kpiGrid} initial="hidden" animate="show" className="grid grid-cols-2 gap-4">
            {[
              { label: "Archivados", value: statsLeadsA, icon: Archive, wrap: "from-amber-500/20 to-amber-500/5 text-amber-600 ring-amber-500/25", bar: "from-amber-400 to-amber-600" },
              { label: "Mensajes", value: statsMsgsA, icon: MessageSquare, wrap: "from-accent/20 to-accent/5 text-accent ring-accent/25", bar: "from-accent/70 to-accent" },
            ].map((s) => (
              <motion.div key={s.label} variants={kpiItem}>
                <Card className="relative overflow-hidden border-border/60">
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.bar}`} aria-hidden="true" />
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ${s.wrap}`}>
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      {loadingStatsA ? (
                        <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <p className="text-2xl font-bold tabular-nums">
                          {s.value == null ? "—" : <AnimatedNumber value={s.value} />}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Botones Archivados */}
          <motion.div variants={kpiGrid} initial="hidden" animate="show" className="grid grid-cols-1 gap-3">
            {[
              {
                title: "Archivados (.xlsx)",
                desc: "Un lead por fila con situación, estado, métricas de conversación y fechas — sin los que siguen en campaña.",
                icon: FileSpreadsheet, onClick: handleExcel, busy: generatingXlsx, label: "Descargar Excel",
                wrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/25", bar: "from-emerald-400 to-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700",
              },
              {
                title: "Conversaciones archivadas (.docx)",
                desc: "Word con la ficha y conversación completa de cada lead archivado, agrupado por situación.",
                icon: FileText, onClick: handleDocx, busy: generatingDocx, label: "Descargar Word",
                wrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/25", bar: "from-blue-400 to-blue-600", btn: "bg-blue-600 hover:bg-blue-700",
              },
              {
                title: "Reporte Visual Archivados (.html)",
                desc: "Vista en navegador con todos los archivados agrupados por situación, conversaciones en estilo WhatsApp.",
                icon: ExternalLink, onClick: handleOpenHtml, busy: generatingHtml, label: "Ver en Navegador",
                wrap: "from-orange-500/20 to-orange-500/5 text-orange-600 ring-orange-500/25", bar: "from-orange-400 to-orange-600", btn: "bg-orange-600 hover:bg-orange-700",
              },
            ].map((f) => (
              <motion.div key={f.title} variants={kpiItem}>
                <Card className="relative overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${f.bar}`} aria-hidden="true" />
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${f.wrap}`}>
                        <f.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{f.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                    <Button
                      className={`w-full text-white ${f.btn}`}
                      onClick={f.onClick}
                      disabled={isLoading || statsLeadsA === 0}
                    >
                      {f.busy
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
                        : <><f.icon className="mr-2 h-4 w-4" />{f.label}</>}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {statsLeadsA === 0 && !loadingStatsA && (
            <p className="text-center text-sm text-muted-foreground">
              No hay leads archivados con el filtro seleccionado.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  Document, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Packer,
} from "docx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Tag, Users, MessageSquare, ArrowLeft, FileText, FileSpreadsheet, ExternalLink, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { orderTags } from "@/lib/permanentTags";

interface LeadTag { id: string; nombre: string; color: string; es_permanente?: boolean | null; }

type TagFull = { id: string; nombre: string; color: string; es_permanente?: boolean | null };

// Lista de etiquetas en ORDEN FIJO para cualquier método de extracción:
//  - filtro "all": todas las permanentes (orden canónico, incluso con 0 leads)
//    + las no permanentes que tengan leads (alfabético).
//  - filtro por una etiqueta: solo esa.
// Garantiza que Excel, Word, HTML y webhook compartan la misma estructura.
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

// ── Fetch datos comunes (leads + tags + mensajes) ─────────────────────────────
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

  const { data: msgsWA } = await supabase
    .from("mensajes_whatsapp").select("*")
    .in("telefono", phones).order("created_at", { ascending: true });

  const { data: msgsAuto } = await supabase
    .from("mensajes_automatizacion").select("*")
    .in("telefono", phones).order("created_at", { ascending: true });

  return { tagMap, tagsFull, leads, phones, msgsWA: msgsWA ?? [], msgsAuto: msgsAuto ?? [] };
}

export default function TaggedExport() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [loadingStats, setLoadingStats] = useState(false);
  const [generatingXlsx, setGeneratingXlsx] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);
  const [sendingN8n, setSendingN8n] = useState(false);
  const [statsLeads, setStatsLeads] = useState<number | null>(null);
  const [statsMsgs, setStatsMsgs] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color, es_permanente").order("nombre")
      .then(({ data }) => { if (data) setAllTags(orderTags(data as LeadTag[])); });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        let q = supabase.from("leads_campana")
          .select("id, telefono", { count: "exact" })
          .not("tag_ids", "is", null).neq("tag_ids", "{}" as any);
        if (tagFilter !== "all") q = q.contains("tag_ids", [tagFilter]);
        const { data: leads, count } = await q;
        setStatsLeads(count ?? 0);
        if (leads && leads.length > 0) {
          const phones = leads.map((l) => l.telefono);
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

  // ── HTML VISUAL: agrupa por etiqueta, acordeón, conversaciones WhatsApp ──
  const handleOpenHtml = async () => {
    setGeneratingHtml(true);
    try {
      const { tagMap, tagsFull, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

      // Mensajes por teléfono, orden cronológico
      const msgsByPhone = new Map<string, any[]>();
      for (const l of leads) msgsByPhone.set(l.telefono, []);
      const allMsgs = [
        ...msgsWA.map((m: any)  => ({ ...m, _canal: "WhatsApp" })),
        ...msgsAuto.map((m: any) => ({ ...m, _canal: m.canal ?? "Auto" })),
      ].sort((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1);
      for (const m of allMsgs) {
        const arr = msgsByPhone.get(m.telefono);
        if (arr) arr.push(m);
      }

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

      // KPIs globales
      const totalLeads   = leads.length;
      const respondieron = leads.filter((l: any) => l.ha_respondido).length;
      const sinResp      = leads.filter((l: any) => !l.ha_respondido && !l.archivado).length;
      const tasa         = totalLeads > 0 ? Math.round(respondieron / totalLeads * 100) : 0;

      // ── Helper: tarjeta de un lead ────────────────────────────────────────
      const buildLeadCard = (l: any, currentTag?: { nombre: string; color: string }) => {
        const msgs      = msgsByPhone.get(l.telefono) ?? [];
        const enviados  = msgs.filter((m: any) => m.direccion === "outbound").length;
        const recibidos = msgs.filter((m: any) => m.direccion === "inbound").length;
        const ultimoMsg = msgs.at(-1);

        const otrasEtqs = (l.tag_ids ?? []).map((id: string) => {
          const t = tagMap.get(id);
          return t ? `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${t.nombre}</span>` : "";
        }).join("");

        const bubbles = msgs.map((m: any) => {
          const esBot     = m.direccion === "outbound";
          const canalBadge = m._canal !== "WhatsApp" ? `<span class="canal-badge">${esc(m._canal)}</span>` : "";
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

      // ── Agrupar leads por etiqueta ────────────────────────────────────────
      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      // Orden fijo: permanentes primero (aunque tengan 0 leads), luego extras con leads
      const orderedTags = orderedOutputTags(tagsFull, byTag, tagFilter);
      const tagSections = orderedTags.map((tag) => {
        const tLeads = byTag.get(tag.id) ?? [];
        const tResp  = tLeads.filter((l: any) => l.ha_respondido).length;
        const tTasa  = tLeads.length ? Math.round(tResp / tLeads.length * 100) : 0;
        const tMsgs  = tLeads.reduce((acc: number, l: any) => acc + (msgsByPhone.get(l.telefono)?.length ?? 0), 0);
        const cards  = tLeads.length
          ? tLeads.map((l: any) => buildLeadCard(l, tag)).join("")
          : `<div class="no-msgs">Sin leads en esta etiqueta</div>`;

        return `<details class="tag-section" ${tLeads.length ? "open" : ""}>
          <summary class="tag-summary" style="border-left:4px solid ${tag.color}">
            <span class="tag-dot" style="background:${tag.color}"></span>
            <span class="tag-title">${esc(tag.nombre)}</span>
            <span class="tag-pill" style="background:${tag.color}22;color:${tag.color}">${tLeads.length} leads</span>
            <span class="tag-pill2">${tResp} respondieron &nbsp;·&nbsp; ${tTasa}%</span>
            <span class="tag-pill2">${tMsgs} mensajes</span>
            <span class="tag-arrow">▾</span>
          </summary>
          <div class="tag-body">${cards}</div>
        </details>`;
      }).join("");

      // ── HTML final ────────────────────────────────────────────────────────
      const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Etiquetados — ${today}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e2e8f0;font-size:13px;line-height:1.5}
/* PAGE HEADER */
.ph{background:linear-gradient(135deg,#1a0e3a,#0f1117);border-bottom:1px solid #7c3aed;padding:20px 28px}
.ph h1{font-size:20px;font-weight:700;color:#a78bfa}.ph p{color:#94a3b8;font-size:11px;margin-top:3px}
/* KPIS */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 28px}
.kpi{background:#1a1d27;border:1px solid #2e3250;border-radius:8px;padding:14px;text-align:center}
.kpi b{display:block;font-size:24px;color:#a78bfa}.kpi small{font-size:10px;color:#94a3b8}
/* TAG SECTION */
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
/* LEAD CARD */
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
/* LEAD BODY */
.lead-body{border-top:1px solid #2e3250}
.etqs-row{display:flex;flex-wrap:wrap;gap:5px;padding:8px 14px;border-bottom:1px solid #2e3250}
.tag-chip{padding:2px 9px;border-radius:20px;font-size:10px;font-weight:600}
.dates-row{padding:7px 14px;font-size:11px;color:#4b5563;border-bottom:1px solid #2e3250}
.dates-row b{color:#94a3b8}
.no-msgs{padding:12px 14px;color:#374151;font-style:italic;font-size:12px}
/* CHAT */
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
  <h1>📋 Leads Etiquetados</h1>
  <p>Generado el ${today} &nbsp;·&nbsp; ${totalLeads} leads &nbsp;·&nbsp; ${allMsgs.length} mensajes &nbsp;·&nbsp; ${byTag.size} etiquetas</p>
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
      toast({ title: "Reporte abierto", description: `${byTag.size} etiquetas · ${totalLeads} leads · ${allMsgs.length} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingHtml(false);
    }
  };

  // ── ENVÍO A N8N: payload estructurado al webhook /expansion ─────────────

  const handleSendN8n = async () => {
    setSendingN8n(true);
    try {
      const { tagMap, tagsFull, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

      // Mensajes por teléfono, orden cronológico
      const msgsByPhone = new Map<string, any[]>();
      for (const l of leads) msgsByPhone.set(l.telefono, []);
      const allMsgs = [
        ...msgsWA.map((m: any)  => ({ ...m, _canal: "WhatsApp" })),
        ...msgsAuto.map((m: any) => ({ ...m, _canal: m.canal ?? "Auto" })),
      ].sort((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1);
      for (const m of allMsgs) {
        const arr = msgsByPhone.get(m.telefono);
        if (arr) arr.push(m);
      }

      // Agrupar leads por etiqueta
      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      const orderedTags = orderedOutputTags(tagsFull, byTag, tagFilter);
      const etiquetas = orderedTags.map((tag) => {
        const tLeads    = byTag.get(tag.id) ?? [];
        const tResp     = tLeads.filter((l: any) => l.ha_respondido).length;
        const tasaResp  = tLeads.length ? Math.round(tResp / tLeads.length * 100) : 0;

        const leadsPayload = tLeads.map((l: any) => {
          const msgs = msgsByPhone.get(l.telefono) ?? [];
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
        total_leads:    leads.length,
        total_mensajes: allMsgs.length,
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
        description: `${leads.length} leads · ${allMsgs.length} mensajes · ${byTag.size} etiquetas enviados a /expansion`,
      });
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSendingN8n(false);
    }
  };

  // ── EXCEL: solo hoja de leads con métricas ────────────────────────────────
  const handleExcel = async () => {
    setGeneratingXlsx(true);
    try {
      const { tagMap, tagsFull, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

      const msgStats = new Map<string, { enviados: number; recibidos: number; ultimoMsg: string; ultimaFecha: string }>();
      for (const l of leads) msgStats.set(l.telefono, { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" });
      for (const m of [...msgsWA, ...msgsAuto]) {
        const s = msgStats.get(m.telefono); if (!s) continue;
        if (m.direccion === "outbound") s.enviados++; else s.recibidos++;
        if (!s.ultimaFecha || m.created_at > s.ultimaFecha) {
          s.ultimaFecha = m.created_at ?? "";
          s.ultimoMsg = (m.contenido ?? "").slice(0, 80);
        }
      }

      const rows = leads.map((l) => {
        const etiquetas = (l.tag_ids ?? []).map((id: string) => tagMap.get(id)?.nombre ?? id).join(", ");
        const s = msgStats.get(l.telefono) ?? { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" };
        return {
          "ID Contacto":       l.id_contacto ?? "",
          "Nombre":            l.nombre ?? "",
          "Teléfono":          l.telefono ?? "",
          "Email":             l.email ?? "",
          "País":              l.pais ?? "",
          "Estado":            l.estado ?? "",
          "Etiquetas":         etiquetas,
          "Bot Activo":        yesNo(l.bot_activo),
          "Archivado":         yesNo(l.archivado),
          "Ha Respondido":     yesNo(l.ha_respondido),
          "Puntuación":        l.puntuacion ?? "",
          "Días Reales":       l.dias_reales ?? "",
          "Origen":            l.origen ?? "",
          "Último Contacto":   formatDate(l.ultimo_contacto_at),
          "Fecha Respuesta":   formatDate(l.fecha_respuesta),
          "Próximo Contacto":  formatDate(l.fecha_proximo_contacto),
          "Msgs Enviados":     s.enviados,
          "Msgs Recibidos":    s.recibidos,
          "Último Mensaje":    s.ultimoMsg,
          "Fecha Último Msg":  formatDate(s.ultimaFecha),
        };
      });

      // Hoja resumen: todas las etiquetas en orden fijo (permanentes incluidas con 0)
      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }
      const resumen = orderedOutputTags(tagsFull, byTag, tagFilter).map((tag) => {
        const tLeads = byTag.get(tag.id) ?? [];
        const tResp  = tLeads.filter((l: any) => l.ha_respondido).length;
        const tMsgs  = tLeads.reduce((acc: number, l: any) => {
          const s = msgStats.get(l.telefono);
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

      const wb = XLSX.utils.book_new();

      const wsResumen = XLSX.utils.json_to_sheet(resumen);
      wsResumen["!cols"] = [28, 11, 8, 13, 8, 10].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Etiquetas");

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [14,28,16,32,12,14,30,11,11,14,11,11,16,20,20,20,14,14,40,20].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws, "Leads Etiquetados");

      const today = new Date().toISOString().slice(0, 10);
      const label = tagFilter === "all" ? "todos" : (tagMap.get(tagFilter)?.nombre ?? tagFilter);
      XLSX.writeFile(wb, `leads-etiquetados-${label}-${today}.xlsx`);
      toast({ title: "Excel descargado", description: `${leads.length} leads exportados.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setGeneratingXlsx(false); }
  };

  // ── WORD: conversaciones agrupadas por lead ───────────────────────────────
  const handleDocx = async () => {
    setGeneratingDocx(true);
    try {
      const { tagMap, tagsFull, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

      // Agrupar todos los mensajes por teléfono, ordenados cronológicamente
      const msgsByPhone = new Map<string, any[]>();
      for (const l of leads) msgsByPhone.set(l.telefono, []);
      const allMsgs = [
        ...msgsWA.map((m) => ({ ...m, canal: "WhatsApp" })),
        ...msgsAuto.map((m) => ({ ...m, canal: m.canal ?? "Auto" })),
      ].sort((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1);
      for (const m of allMsgs) {
        const arr = msgsByPhone.get(m.telefono);
        if (arr) arr.push(m);
      }

      const divider = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "7C3AED" } },
        spacing: { before: 200, after: 200 },
      });

      const children: Paragraph[] = [];

      // Título del documento
      children.push(new Paragraph({
        text: "Conversaciones — Leads Etiquetados",
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

      // Agrupar por etiqueta (un lead puede aparecer bajo varias)
      const byTag = new Map<string, any[]>();
      for (const l of leads) {
        for (const tid of (l.tag_ids ?? [])) {
          if (!byTag.has(tid)) byTag.set(tid, []);
          byTag.get(tid)!.push(l);
        }
      }

      // Renderiza la ficha + conversación de un lead
      const renderLead = (lead: any) => {
        const etiquetas = (lead.tag_ids ?? []).map((id: string) => tagMap.get(id)?.nombre ?? id).join("  ·  ");
        const msgs = msgsByPhone.get(lead.telefono) ?? [];

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
            const canal    = m.canal ? ` [${m.canal}]` : "";
            const contenido = (m.contenido ?? "").trim();

            children.push(new Paragraph({
              children: [
                new TextRun({ text: `[${hora}]${canal}  ${quien}:  `, bold: true, size: 20, color: esBot ? "2563EB" : "16A34A" }),
              ],
              spacing: { before: 120, after: 40 },
            }));

            // Dividir mensajes largos en párrafos de 120 chars para legibilidad
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

      // Recorrer las etiquetas en orden fijo; cada una es una sección con título
      const orderedTags = orderedOutputTags(tagsFull, byTag, tagFilter);
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
      const label = tagFilter === "all" ? "todos" : (tagMap.get(tagFilter)?.nombre ?? tagFilter);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `conversaciones-${label}-${dateStr}.docx`);

      const totalMsgs = [...msgsByPhone.values()].reduce((acc, arr) => acc + arr.length, 0);
      toast({ title: "Word descargado", description: `${leads.length} leads · ${totalMsgs} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setGeneratingDocx(false); }
  };

  const isLoading = generatingXlsx || generatingDocx || generatingHtml || sendingN8n;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tagged")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Download className="h-6 w-6 text-violet-400" />
            Exportar Etiquetados
          </h1>
          <p className="text-sm text-muted-foreground">
            Excel con datos de leads · Word con conversaciones completas
          </p>
        </div>
      </div>

      {/* Filtro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-violet-400" />
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
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Users className="h-8 w-8 text-violet-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Leads</p>
              {loadingStats ? <Loader2 className="h-4 w-4 animate-spin mt-1" />
                : <p className="text-2xl font-bold">{statsLeads ?? "—"}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-violet-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Mensajes</p>
              {loadingStats ? <Loader2 className="h-4 w-4 animate-spin mt-1" />
                : <p className="text-2xl font-bold">{statsMsgs ?? "—"}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botones de descarga */}
      <div className="grid grid-cols-1 gap-3">

        <Card className="border-violet-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3 mb-3">
              <FileSpreadsheet className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Leads Etiquetados (.xlsx)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Un lead por fila — ID, nombre, teléfono, email, país, estado, etiquetas, métricas de conversación y fechas clave.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-green-700 hover:bg-green-800 text-white"
              onClick={handleExcel}
              disabled={isLoading || statsLeads === 0}
            >
              {generatingXlsx
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando...</>
                : <><FileSpreadsheet className="h-4 w-4 mr-2" />Descargar Excel</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-violet-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3 mb-3">
              <FileText className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Conversaciones (.docx)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Un documento Word por filtro — cada lead con su ficha y conversación completa en formato chat, ordenada cronológicamente.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              onClick={handleDocx}
              disabled={isLoading || statsLeads === 0}
            >
              {generatingDocx
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando...</>
                : <><FileText className="h-4 w-4 mr-2" />Descargar Word</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-violet-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3 mb-3">
              <ExternalLink className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Reporte Visual en Navegador (.html)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Abre todos los leads etiquetados con sus datos completos y conversaciones en estilo WhatsApp — burbujas, colores, timestamps.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-orange-700 hover:bg-orange-800 text-white"
              onClick={handleOpenHtml}
              disabled={isLoading || statsLeads === 0}
            >
              {generatingHtml
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando...</>
                : <><ExternalLink className="h-4 w-4 mr-2" />Ver en Navegador</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-violet-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3 mb-3">
              <Send className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Enviar a n8n — <span className="text-violet-400">/expansion</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envía todos los datos mapeados y depurados al webhook de expansión: leads por etiqueta, conversaciones completas, métricas y fechas.
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-violet-700 hover:bg-violet-800 text-white"
              onClick={handleSendN8n}
              disabled={isLoading || statsLeads === 0}
            >
              {sendingN8n
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
                : <><Send className="h-4 w-4 mr-2" />Enviar a n8n</>}
            </Button>
          </CardContent>
        </Card>

      </div>

      {statsLeads === 0 && !loadingStats && (
        <p className="text-center text-sm text-muted-foreground">
          No hay leads etiquetados con el filtro seleccionado.
        </p>
      )}
    </div>
  );
}

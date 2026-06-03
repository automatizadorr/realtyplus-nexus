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
import { Loader2, Download, Tag, Users, MessageSquare, ArrowLeft, FileText, FileSpreadsheet, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface LeadTag { id: string; nombre: string; color: string; }

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
  const { data: tags } = await supabase.from("lead_tags").select("id, nombre, color");
  const tagMap = new Map<string, string>((tags ?? []).map((t) => [t.id, t.nombre]));

  let leadsQuery = supabase
    .from("leads_campana").select("*")
    .not("tag_ids", "is", null).neq("tag_ids", "{}");
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

  return { tagMap, leads, phones, msgsWA: msgsWA ?? [], msgsAuto: msgsAuto ?? [] };
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
  const [statsLeads, setStatsLeads] = useState<number | null>(null);
  const [statsMsgs, setStatsMsgs] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color").order("nombre")
      .then(({ data }) => { if (data) setAllTags(data); });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        let q = supabase.from("leads_campana")
          .select("id, telefono", { count: "exact" })
          .not("tag_ids", "is", null).neq("tag_ids", "{}");
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

  // ── HTML VISUAL: carga datos reales y abre reporte WhatsApp-style ────────
  const handleOpenHtml = async () => {
    setGeneratingHtml(true);
    try {
      const { tagMap, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

      // Agrupar mensajes por teléfono, orden cronológico
      const msgsByPhone = new Map<string, any[]>();
      for (const l of leads) msgsByPhone.set(l.telefono, []);
      const allMsgs = [
        ...msgsWA.map((m) => ({ ...m, _canal: "WhatsApp" })),
        ...msgsAuto.map((m) => ({ ...m, _canal: m.canal ?? "Auto" })),
      ].sort((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1);
      for (const m of allMsgs) {
        const arr = msgsByPhone.get(m.telefono);
        if (arr) arr.push(m);
      }

      const fmtTs = (iso: string | null) => {
        if (!iso) return "";
        const d = new Date(iso);
        return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })
          + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      };

      const fmtDate = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

      const totalLeads   = leads.length;
      const respondieron = leads.filter(l => l.ha_respondido).length;
      const sinResp      = leads.filter(l => !l.ha_respondido && !l.archivado).length;
      const tasa         = totalLeads > 0 ? Math.round(respondieron / totalLeads * 100) : 0;
      const today        = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

      const escHtml = (s: string) => s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      // ── Construir sección de cada lead ───────────────────────────────────
      const leadSections = leads.map((l) => {
        const etiquetas = (l.tag_ids ?? []).map((id: string) => {
          const t = tagMap.get(id);
          return t ? `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}66">${t.nombre}</span>` : "";
        }).join("");

        const msgs = msgsByPhone.get(l.telefono) ?? [];
        const enviados  = msgs.filter(m => m.direccion === "outbound").length;
        const recibidos = msgs.filter(m => m.direccion === "inbound").length;
        const ultimoMsg = msgs.at(-1);

        const bubbles = msgs.map((m) => {
          const esBot   = m.direccion === "outbound";
          const ts      = fmtTs(m.created_at);
          const canal   = m._canal !== "WhatsApp" ? `<span class="canal-badge">${escHtml(m._canal)}</span>` : "";
          const contenido = escHtml((m.contenido ?? "").trim());
          return `
            <div class="bubble-row ${esBot ? "out" : "in"}">
              <div class="bubble ${esBot ? "bubble-out" : "bubble-in"}">
                ${canal}
                <div class="bubble-text">${contenido || "<em style='opacity:.5'>Media / sin texto</em>"}</div>
                <div class="bubble-ts">${ts}</div>
              </div>
            </div>`;
        }).join("");

        return `
          <div class="lead-block">
            <div class="lead-header">
              <div class="lead-avatar">${(l.nombre ?? "?")[0].toUpperCase()}</div>
              <div class="lead-info">
                <div class="lead-name">${escHtml(l.nombre ?? "Sin nombre")}</div>
                <div class="lead-meta">
                  📱 ${escHtml(l.telefono ?? "")}
                  ${l.email ? ` &nbsp;·&nbsp; ✉ ${escHtml(l.email)}` : ""}
                  ${l.pais  ? ` &nbsp;·&nbsp; 🌍 ${escHtml(l.pais)}`  : ""}
                </div>
                <div class="lead-meta2">
                  <span class="estado-badge">${escHtml(l.estado ?? "sin estado")}</span>
                  ${l.id_contacto ? `<span class="id-badge">ID ${escHtml(l.id_contacto)}</span>` : ""}
                  ${l.bot_activo ? `<span class="bot-badge">🤖 Bot activo</span>` : ""}
                  ${l.ha_respondido ? `<span class="resp-badge">✅ Respondió</span>` : ""}
                </div>
              </div>
              <div class="lead-stats">
                <div class="stat"><span class="stat-n" style="color:#22c55e">${enviados}</span><span class="stat-l">Enviados</span></div>
                <div class="stat"><span class="stat-n" style="color:#3b82f6">${recibidos}</span><span class="stat-l">Recibidos</span></div>
                <div class="stat"><span class="stat-n">${l.puntuacion ?? "—"}</span><span class="stat-l">Puntuación</span></div>
                <div class="stat"><span class="stat-n">${l.dias_reales ?? "—"}</span><span class="stat-l">Días</span></div>
              </div>
            </div>
            ${etiquetas ? `<div class="tags-row">${etiquetas}</div>` : ""}
            <div class="lead-dates">
              Último contacto: <strong>${fmtDate(l.ultimo_contacto_at)}</strong>
              ${l.fecha_respuesta ? ` &nbsp;·&nbsp; Fecha respuesta: <strong>${fmtDate(l.fecha_respuesta)}</strong>` : ""}
              ${l.fecha_proximo_contacto ? ` &nbsp;·&nbsp; Próximo: <strong>${fmtDate(l.fecha_proximo_contacto)}</strong>` : ""}
              ${l.origen ? ` &nbsp;·&nbsp; Origen: <strong>${escHtml(l.origen)}</strong>` : ""}
            </div>

            ${msgs.length > 0 ? `
            <div class="chat-header">
              <span>💬 Conversación — ${msgs.length} mensajes</span>
              ${ultimoMsg ? `<span style="opacity:.7;font-size:11px">Último: ${fmtTs(ultimoMsg.created_at)}</span>` : ""}
            </div>
            <div class="chat-area">${bubbles}</div>
            ` : `<div class="no-msgs">Sin mensajes registrados</div>`}
          </div>`;
      }).join("");

      // ── HTML final ────────────────────────────────────────────────────────
      const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Leads Etiquetados — ${today}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f1117;color:#e2e8f0;font-size:13px;line-height:1.5}
a{color:#a78bfa}

/* HEADER */
.page-header{background:linear-gradient(135deg,#1a0e3a,#0f1117);border-bottom:1px solid #7c3aed;padding:24px 32px}
.page-header h1{font-size:22px;font-weight:700;color:#a78bfa}
.page-header p{color:#94a3b8;margin-top:4px;font-size:12px}

/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 32px}
.kpi{background:#1a1d27;border:1px solid #2e3250;border-radius:10px;padding:16px;text-align:center}
.kpi-n{font-size:26px;font-weight:700;color:#a78bfa}
.kpi-l{font-size:11px;color:#94a3b8;margin-top:3px}

/* LEADS */
.leads-container{padding:0 32px 40px}
.lead-block{background:#1a1d27;border:1px solid #2e3250;border-radius:12px;margin-bottom:24px;overflow:hidden}

/* LEAD HEADER */
.lead-header{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:#1e2235;border-bottom:1px solid #2e3250}
.lead-avatar{width:44px;height:44px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0}
.lead-info{flex:1;min-width:0}
.lead-name{font-size:15px;font-weight:700;color:#e2e8f0}
.lead-meta{font-size:12px;color:#94a3b8;margin-top:3px}
.lead-meta2{margin-top:6px;display:flex;flex-wrap:wrap;gap:5px}
.estado-badge{background:#2e3250;color:#94a3b8;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.id-badge{background:#1e1b4b;color:#a78bfa;padding:2px 8px;border-radius:4px;font-size:11px}
.bot-badge{background:#14532d;color:#86efac;padding:2px 8px;border-radius:4px;font-size:11px}
.resp-badge{background:#1e3a1e;color:#86efac;padding:2px 8px;border-radius:4px;font-size:11px}
.lead-stats{display:flex;gap:14px;flex-shrink:0}
.stat{text-align:center}
.stat-n{display:block;font-size:18px;font-weight:700}
.stat-l{display:block;font-size:10px;color:#94a3b8;margin-top:1px}

/* TAGS */
.tags-row{padding:10px 18px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #2e3250}
.tag-chip{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}

/* DATES */
.lead-dates{padding:8px 18px;font-size:11px;color:#64748b;border-bottom:1px solid #2e3250}
.lead-dates strong{color:#94a3b8}

/* CHAT */
.chat-header{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;background:#128C7E;color:#fff;font-size:12px;font-weight:600}
.chat-area{background:#0b1a12 url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");padding:14px 18px;min-height:80px;max-height:500px;overflow-y:auto}
.bubble-row{display:flex;margin-bottom:8px}
.bubble-row.out{justify-content:flex-end}
.bubble-row.in{justify-content:flex-start}
.bubble{max-width:70%;padding:8px 12px;border-radius:12px;position:relative;word-break:break-word}
.bubble-out{background:#005C4B;color:#e9feee;border-bottom-right-radius:3px}
.bubble-in{background:#1f2c34;color:#e2e8f0;border-bottom-left-radius:3px}
.bubble-text{font-size:13px;line-height:1.5}
.bubble-ts{font-size:10px;opacity:.6;text-align:right;margin-top:4px}
.canal-badge{display:inline-block;background:rgba(255,255,255,.1);border-radius:3px;padding:0 5px;font-size:10px;margin-bottom:4px}
.no-msgs{padding:14px 18px;color:#4b5563;font-style:italic;font-size:12px}

/* RESPONSIVE */
@media(max-width:600px){
  .kpis{grid-template-columns:repeat(2,1fr)}
  .leads-container,.kpis{padding-left:16px;padding-right:16px}
  .lead-header{flex-wrap:wrap}
  .lead-stats{width:100%;justify-content:space-around;margin-top:10px}
  .bubble{max-width:90%}
}
</style>
</head>
<body>

<div class="page-header">
  <h1>📋 Leads Etiquetados</h1>
  <p>Generado el ${today} &nbsp;·&nbsp; ${totalLeads} leads &nbsp;·&nbsp; ${allMsgs.length} mensajes</p>
</div>

<div class="kpis">
  <div class="kpi"><div class="kpi-n">${totalLeads}</div><div class="kpi-l">Total etiquetados</div></div>
  <div class="kpi"><div class="kpi-n" style="color:#22c55e">${respondieron}</div><div class="kpi-l">Respondieron</div></div>
  <div class="kpi"><div class="kpi-n" style="color:#f97316">${sinResp}</div><div class="kpi-l">Sin respuesta</div></div>
  <div class="kpi"><div class="kpi-n">${tasa}%</div><div class="kpi-l">Tasa respuesta</div></div>
</div>

<div class="leads-container">
  ${leadSections}
</div>

<div style="text-align:center;padding:20px;color:#374151;font-size:11px">
  RealtyPlus Nexus · AI-MaX Intelligence · ${today}
</div>
</body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast({ title: "Reporte abierto", description: `${totalLeads} leads · ${allMsgs.length} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingHtml(false);
    }
  };

  // ── EXCEL: solo hoja de leads con métricas ────────────────────────────────
  const handleExcel = async () => {
    setGeneratingXlsx(true);
    try {
      const { tagMap, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

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
        const etiquetas = (l.tag_ids ?? []).map((id: string) => tagMap.get(id) ?? id).join(", ");
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

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [14,28,16,32,12,14,30,11,11,14,11,11,16,20,20,20,14,14,40,20].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws, "Leads Etiquetados");

      const today = new Date().toISOString().slice(0, 10);
      const label = tagFilter === "all" ? "todos" : (tagMap.get(tagFilter) ?? tagFilter);
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
      const { tagMap, leads, msgsWA, msgsAuto } = await fetchData(tagFilter);

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

      for (const lead of leads) {
        const etiquetas = (lead.tag_ids ?? []).map((id: string) => tagMap.get(id) ?? id).join("  ·  ");
        const msgs = msgsByPhone.get(lead.telefono) ?? [];

        // Cabecera del lead
        children.push(new Paragraph({
          children: [new TextRun({ text: lead.nombre ?? "Sin nombre", bold: true, size: 28, color: "7C3AED" })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 60 },
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
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const label = tagFilter === "all" ? "todos" : (tagMap.get(tagFilter) ?? tagFilter);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `conversaciones-${label}-${dateStr}.docx`);

      const totalMsgs = [...msgsByPhone.values()].reduce((acc, arr) => acc + arr.length, 0);
      toast({ title: "Word descargado", description: `${leads.length} leads · ${totalMsgs} mensajes.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setGeneratingDocx(false); }
  };

  const isLoading = generatingXlsx || generatingDocx || generatingHtml;

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

      </div>

      {statsLeads === 0 && !loadingStats && (
        <p className="text-center text-sm text-muted-foreground">
          No hay leads etiquetados con el filtro seleccionado.
        </p>
      )}
    </div>
  );
}

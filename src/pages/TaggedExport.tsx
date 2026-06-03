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
import { Loader2, Download, Tag, Users, MessageSquare, ArrowLeft, FileText, FileSpreadsheet } from "lucide-react";
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

  const isLoading = generatingXlsx || generatingDocx;

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

      </div>

      {statsLeads === 0 && !loadingStats && (
        <p className="text-center text-sm text-muted-foreground">
          No hay leads etiquetados con el filtro seleccionado.
        </p>
      )}
    </div>
  );
}

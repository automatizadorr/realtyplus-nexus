import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Tag, Users, MessageSquare, ArrowLeft } from "lucide-react";
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

export default function TaggedExport() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [loadingStats, setLoadingStats] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statsLeads, setStatsLeads] = useState<number | null>(null);
  const [statsMsgs, setStatsMsgs] = useState<number | null>(null);

  // Cargar tags disponibles
  useEffect(() => {
    supabase.from("lead_tags").select("id, nombre, color").order("nombre")
      .then(({ data }) => { if (data) setAllTags(data); });
  }, []);

  // Actualizar stats cuando cambia el filtro
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        let query = supabase
          .from("leads_campana")
          .select("id, telefono, tag_ids", { count: "exact" })
          .not("tag_ids", "is", null)
          .neq("tag_ids", "{}");

        if (tagFilter !== "all") {
          query = query.contains("tag_ids", [tagFilter]);
        }

        const { data: leads, count } = await query;
        setStatsLeads(count ?? 0);

        if (leads && leads.length > 0) {
          const phones = leads.map((l) => l.telefono);
          const { count: msgCount } = await supabase
            .from("mensajes_whatsapp")
            .select("id", { count: "exact", head: true })
            .in("telefono", phones);
          const { count: autoCount } = await supabase
            .from("mensajes_automatizacion")
            .select("id", { count: "exact", head: true })
            .in("telefono", phones);
          setStatsMsgs((msgCount ?? 0) + (autoCount ?? 0));
        } else {
          setStatsMsgs(0);
        }
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [tagFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // 1. Tags
      const { data: tags } = await supabase.from("lead_tags").select("id, nombre, color");
      const tagMap = new Map<string, string>((tags ?? []).map((t) => [t.id, t.nombre]));

      // 2. Leads etiquetados
      let leadsQuery = supabase
        .from("leads_campana")
        .select("*")
        .not("tag_ids", "is", null)
        .neq("tag_ids", "{}");
      if (tagFilter !== "all") leadsQuery = leadsQuery.contains("tag_ids", [tagFilter]);
      const { data: leads, error: leadsErr } = await leadsQuery;
      if (leadsErr) throw leadsErr;
      if (!leads || leads.length === 0) {
        toast({ title: "Sin datos", description: "No hay leads etiquetados con los filtros seleccionados.", variant: "destructive" });
        return;
      }

      const phones = leads.map((l) => l.telefono);
      const leadByPhone = new Map(leads.map((l) => [l.telefono, l]));

      // 3. Mensajes WhatsApp
      const { data: msgsWA } = await supabase
        .from("mensajes_whatsapp")
        .select("*")
        .in("telefono", phones)
        .order("created_at", { ascending: true });

      // 4. Mensajes Automatización
      const { data: msgsAuto } = await supabase
        .from("mensajes_automatizacion")
        .select("*")
        .in("telefono", phones)
        .order("created_at", { ascending: true });

      // 5. Métricas de mensajes por teléfono
      const msgStats = new Map<string, { enviados: number; recibidos: number; ultimoMsg: string; ultimaFecha: string }>();
      for (const phone of phones) {
        msgStats.set(phone, { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" });
      }
      for (const m of [...(msgsWA ?? []), ...(msgsAuto ?? [])]) {
        const s = msgStats.get(m.telefono);
        if (!s) continue;
        if (m.direccion === "outbound") s.enviados++;
        else s.recibidos++;
        if (!s.ultimaFecha || m.created_at > s.ultimaFecha) {
          s.ultimaFecha = m.created_at ?? "";
          s.ultimoMsg = (m.contenido ?? "").slice(0, 80);
        }
      }

      // ── HOJA 1: Leads Etiquetados ──────────────────────────────────────────
      const sheet1Rows = leads.map((l) => {
        const etiquetas = (l.tag_ids ?? []).map((id: string) => tagMap.get(id) ?? id).join(", ");
        const stats = msgStats.get(l.telefono) ?? { enviados: 0, recibidos: 0, ultimoMsg: "", ultimaFecha: "" };
        return {
          "ID Contacto":          l.id_contacto ?? "",
          "Nombre":               l.nombre ?? "",
          "Teléfono":             l.telefono ?? "",
          "Email":                l.email ?? "",
          "País":                 l.pais ?? "",
          "Estado":               l.estado ?? "",
          "Etiquetas":            etiquetas,
          "Bot Activo":           yesNo(l.bot_activo),
          "Archivado":            yesNo(l.archivado),
          "Ha Respondido":        yesNo(l.ha_respondido),
          "Puntuación":           l.puntuacion ?? "",
          "Días Reales":          l.dias_reales ?? "",
          "Origen":               l.origen ?? "",
          "Último Contacto":      formatDate(l.ultimo_contacto_at),
          "Fecha Respuesta":      formatDate(l.fecha_respuesta),
          "Próximo Contacto":     formatDate(l.fecha_proximo_contacto),
          "Msgs Enviados":        stats.enviados,
          "Msgs Recibidos":       stats.recibidos,
          "Último Mensaje":       stats.ultimoMsg,
          "Fecha Último Msg":     formatDate(stats.ultimaFecha),
        };
      });

      // ── HOJA 2: Conversaciones ─────────────────────────────────────────────
      const sheet2Rows: object[] = [];
      for (const m of msgsWA ?? []) {
        const lead = leadByPhone.get(m.telefono);
        sheet2Rows.push({
          "Teléfono":       m.telefono,
          "Nombre Lead":    lead?.nombre ?? "",
          "País":           lead?.pais ?? "",
          "Fecha":          formatDate(m.created_at),
          "Dirección":      m.direccion === "outbound" ? "Enviado" : "Recibido",
          "Canal":          "WhatsApp",
          "Contenido":      m.contenido ?? "",
          "Autor":          m.autor ?? "",
          "Estado Envío":   "",
        });
      }
      for (const m of msgsAuto ?? []) {
        const lead = leadByPhone.get(m.telefono);
        sheet2Rows.push({
          "Teléfono":       m.telefono,
          "Nombre Lead":    lead?.nombre ?? m.nombre ?? "",
          "País":           lead?.pais ?? m.pais ?? "",
          "Fecha":          formatDate(m.created_at),
          "Dirección":      m.direccion === "outbound" ? "Enviado" : "Recibido",
          "Canal":          m.canal ?? "Automatización",
          "Contenido":      m.contenido ?? "",
          "Autor":          "Bot",
          "Estado Envío":   m.estado_envio ?? "",
        });
      }
      // Ordenar conversaciones por fecha
      sheet2Rows.sort((a: any, b: any) => (a["Fecha"] > b["Fecha"] ? 1 : -1));

      // ── Generar Excel ──────────────────────────────────────────────────────
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
      const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);

      // Ancho de columnas hoja 1
      ws1["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 12 },
        { wch: 14 }, { wch: 30 }, { wch: 11 }, { wch: 11 }, { wch: 14 },
        { wch: 11 }, { wch: 11 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
        { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
      ];
      // Ancho de columnas hoja 2
      ws2["!cols"] = [
        { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 11 },
        { wch: 16 }, { wch: 60 }, { wch: 14 }, { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws1, "Leads Etiquetados");
      XLSX.utils.book_append_sheet(wb, ws2, "Conversaciones");

      const today = new Date().toISOString().slice(0, 10);
      const tagLabel = tagFilter === "all" ? "todos" : (tagMap.get(tagFilter) ?? tagFilter);
      XLSX.writeFile(wb, `etiquetados-${tagLabel}-${today}.xlsx`);

      toast({ title: "Excel generado", description: `${leads.length} leads · ${sheet2Rows.length} mensajes exportados.` });
    } catch (err: any) {
      toast({ title: "Error al generar Excel", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

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
            Descarga un Excel limpio con leads, conversaciones y etiquetas
          </p>
        </div>
      </div>

      {/* Filtro por etiqueta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-violet-400" />
            Filtrar por etiqueta
          </CardTitle>
          <CardDescription>Selecciona una etiqueta específica o exporta todas</CardDescription>
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
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
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
              <p className="text-xs text-muted-foreground">Leads a exportar</p>
              {loadingStats
                ? <Loader2 className="h-4 w-4 animate-spin mt-1" />
                : <p className="text-2xl font-bold">{statsLeads ?? "—"}</p>
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-violet-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Mensajes a exportar</p>
              {loadingStats
                ? <Loader2 className="h-4 w-4 animate-spin mt-1" />
                : <p className="text-2xl font-bold">{statsMsgs ?? "—"}</p>
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estructura del Excel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estructura del archivo Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Badge variant="outline" className="mb-2 border-violet-500 text-violet-400">Hoja 1 — Leads Etiquetados</Badge>
            <p className="text-muted-foreground text-xs leading-relaxed">
              ID Contacto · Nombre · Teléfono · Email · País · Estado · Etiquetas · Bot Activo · Archivado · Ha Respondido · Puntuación · Días Reales · Origen · Último Contacto · Fecha Respuesta · Próximo Contacto · Msgs Enviados · Msgs Recibidos · Último Mensaje · Fecha Último Msg
            </p>
          </div>
          <div>
            <Badge variant="outline" className="mb-2 border-violet-500 text-violet-400">Hoja 2 — Conversaciones</Badge>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Teléfono · Nombre Lead · País · Fecha · Dirección · Canal · Contenido · Autor · Estado Envío
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botón de descarga */}
      <Button
        className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 text-base"
        onClick={handleGenerate}
        disabled={generating || loadingStats || statsLeads === 0}
      >
        {generating
          ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Generando Excel...</>
          : <><Download className="h-5 w-5 mr-2" />Descargar Excel</>
        }
      </Button>

      {statsLeads === 0 && !loadingStats && (
        <p className="text-center text-sm text-muted-foreground">
          No hay leads etiquetados con el filtro seleccionado.
        </p>
      )}
    </div>
  );
}

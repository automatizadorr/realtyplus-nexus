import { useEffect, useMemo, useState } from "react";
import {
  Loader2, MapPin, Mail as MailIcon, MessageCircle, Globe, Instagram, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { waLink, type Lead } from "@/components/prospeccion/LeadDetailDialog";
import { fillTemplate } from "@/lib/fillTemplate";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

const ESTADOS = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};

// prospeccion_leads aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function LeadCard({
  lead, plantillasWa, plantillasEmail, onEstadoChange, onNotasChange, onEnviado,
}: {
  lead: Lead;
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  onEstadoChange: (lead: Lead, estado: string) => void;
  onNotasChange: (lead: Lead, notas: string) => void;
  onEnviado: (lead: Lead, canal: "whatsapp" | "email", plantillaId: string, mensaje: string) => void;
}) {
  const [notasDraft, setNotasDraft] = useState(lead.notas || "");
  const [waPlantilla, setWaPlantilla] = useState("");
  const [emailPlantilla, setEmailPlantilla] = useState("");
  const [waPreview, setWaPreview] = useState("");
  const [emailAsuntoPreview, setEmailAsuntoPreview] = useState("");
  const [emailCuerpoPreview, setEmailCuerpoPreview] = useState("");
  const wa = waLink(lead);

  useEffect(() => {
    const p = plantillasWa.find((x) => x.id === waPlantilla);
    setWaPreview(p ? fillTemplate(p.contenido, lead) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waPlantilla]);

  useEffect(() => {
    const p = plantillasEmail.find((x) => x.id === emailPlantilla);
    setEmailAsuntoPreview(p ? fillTemplate(p.asunto, lead) : "");
    setEmailCuerpoPreview(p ? fillTemplate(p.cuerpo_text || p.cuerpo_html, lead) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailPlantilla]);

  const enviarWa = () => {
    if (!waPlantilla || !wa || !waPreview.trim()) return;
    window.open(`${wa}?text=${encodeURIComponent(waPreview)}`, "_blank", "noreferrer");
    onEnviado(lead, "whatsapp", waPlantilla, waPreview);
  };

  const enviarEmail = () => {
    if (!emailPlantilla || !lead.email || !emailCuerpoPreview.trim()) return;
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(emailAsuntoPreview)}&body=${encodeURIComponent(emailCuerpoPreview)}`;
    onEnviado(lead, "email", emailPlantilla, `${emailAsuntoPreview}\n\n${emailCuerpoPreview}`);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{lead.nombre || "—"}</span>
              {typeof lead.score === "number" && <Badge variant="secondary" className="font-mono">score {lead.score}</Badge>}
              {lead.tipo_lead && <Badge variant="outline">{lead.tipo_lead}</Badge>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.ciudad || "—"}{lead.pais ? `, ${lead.pais}` : ""}</span>
              {lead.web && <a href={lead.web} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#003DA5] hover:underline"><Globe className="h-3 w-3" /> web</a>}
              {lead.instagram && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" /> {lead.instagram}</span>}
            </div>
          </div>
        </div>

        <div className="grid gap-1 rounded-lg border p-2.5 text-sm sm:grid-cols-2">
          {lead.email && <div className="flex items-center gap-1.5"><MailIcon className="h-3.5 w-3.5 text-muted-foreground" /> {lead.email}</div>}
          {(lead.telefono || lead.whatsapp) && <div className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> {lead.telefono || lead.whatsapp}</div>}
        </div>

        {lead.propuesta_valor && (
          <div className="rounded-lg border border-[#003DA5]/20 bg-[#003DA5]/5 p-2.5 text-sm">
            <span className="font-medium">Propuesta: </span>{lead.propuesta_valor}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground">Estado</Label>
          {ESTADOS.map((e) => (
            <button
              key={e} type="button"
              onClick={() => onEstadoChange(lead, e)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                (lead.estado_gestion || "nuevo") === e ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"
              }`}
            >
              {ESTADO_LABEL[e]}
            </button>
          ))}
        </div>

        <Textarea
          defaultValue={lead.notas || ""}
          onChange={(e) => setNotasDraft(e.target.value)}
          onBlur={() => { if (notasDraft !== (lead.notas || "")) onNotasChange(lead, notasDraft); }}
          placeholder="Notas del contacto…"
          className="min-h-[56px] text-sm"
        />

        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={waPlantilla} onValueChange={setWaPlantilla}>
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Plantilla WhatsApp" /></SelectTrigger>
              <SelectContent>
                {plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {!wa && <span className="text-[11px] text-muted-foreground">Este lead no tiene WhatsApp/teléfono.</span>}
          </div>
          {waPlantilla && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
              <Label className="text-[11px] text-muted-foreground">Vista previa (editable)</Label>
              <Textarea value={waPreview} onChange={(e) => setWaPreview(e.target.value)} className="min-h-[80px] bg-background text-sm" />
              <Button type="button" size="sm" disabled={!wa || !waPreview.trim()} onClick={enviarWa} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={emailPlantilla} onValueChange={setEmailPlantilla}>
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="Plantilla email" /></SelectTrigger>
              <SelectContent>
                {plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {!lead.email && <span className="text-[11px] text-muted-foreground">Este lead no tiene email.</span>}
          </div>
          {emailPlantilla && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
              <Label className="text-[11px] text-muted-foreground">Asunto</Label>
              <Textarea value={emailAsuntoPreview} onChange={(e) => setEmailAsuntoPreview(e.target.value)} className="min-h-[36px] bg-background text-sm" />
              <Label className="text-[11px] text-muted-foreground">Vista previa del cuerpo (editable)</Label>
              <Textarea value={emailCuerpoPreview} onChange={(e) => setEmailCuerpoPreview(e.target.value)} className="min-h-[100px] bg-background text-sm" />
              <Button type="button" size="sm" variant="outline" disabled={!lead.email || !emailCuerpoPreview.trim()} onClick={enviarEmail} className="gap-1.5">
                <MailIcon className="h-3.5 w-3.5" /> Enviar email
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProspeccionTab({ plantillasWa, plantillasEmail }: { plantillasWa: PlantillaWa[]; plantillasEmail: PlantillaEmail[] }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState("all");

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb.from("prospeccion_leads").select("*").order("score", { ascending: false });
    if (error) toast({ title: "Error al cargar tus leads", description: error.message, variant: "destructive" });
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const filtered = useMemo(() => {
    if (estadoFilter === "all") return leads;
    return leads.filter((l) => (l.estado_gestion || "nuevo") === estadoFilter);
  }, [leads, estadoFilter]);

  const cambiarEstado = async (lead: Lead, estado: string) => {
    if (!lead.id) return;
    const { error } = await sb.rpc("vendedor_actualizar_lead", { _lead_id: lead.id, _estado: estado, _notas: lead.notas ?? null });
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, estado_gestion: estado } : l)));
  };

  const guardarNotas = async (lead: Lead, notas: string) => {
    if (!lead.id) return;
    const { error } = await sb.rpc("vendedor_actualizar_lead", { _lead_id: lead.id, _estado: lead.estado_gestion || "nuevo", _notas: notas });
    if (error) { toast({ title: "No se pudieron guardar las notas", description: error.message, variant: "destructive" }); return; }
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, notas } : l)));
    toast({ title: "Notas guardadas" });
  };

  const registrarEnvio = async (lead: Lead, canal: "whatsapp" | "email", plantillaId: string, mensaje: string) => {
    if (!lead.id) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    await sb.from("contactos_log").insert({
      lead_id: lead.id, user_id: uid, canal, plantilla_id: plantillaId, mensaje_final: mensaje, origen: "prospeccion",
    });
  };

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) { const e = l.estado_gestion || "nuevo"; c[e] = (c[e] || 0) + 1; }
    return c;
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Leads de campaña de Buscar Leads, asignados a tu país.</p>
        <Button type="button" variant="outline" size="sm" onClick={cargar} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => setEstadoFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${estadoFilter === "all" ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"}`}
        >
          Todos · {leads.length}
        </button>
        {ESTADOS.map((e) => (
          conteos[e] ? (
            <button
              key={e} type="button" onClick={() => setEstadoFilter(estadoFilter === e ? "all" : e)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${estadoFilter === e ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input hover:bg-muted"}`}
            >
              {ESTADO_LABEL[e]} · {conteos[e]}
            </button>
          ) : null
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          {leads.length === 0
            ? "Todavía no tienes leads de prospección. Tu administrador publica leads de campaña por país."
            : "Ningún lead con este estado."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              plantillasWa={plantillasWa}
              plantillasEmail={plantillasEmail}
              onEstadoChange={cambiarEstado}
              onNotasChange={guardarNotas}
              onEnviado={registrarEnvio}
            />
          ))}
        </div>
      )}
    </div>
  );
}

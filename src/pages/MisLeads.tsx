import { useEffect, useMemo, useState } from "react";
import {
  Users, Loader2, MapPin, Mail as MailIcon, MessageCircle, Globe, Instagram, RefreshCw,
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

type PlantillaWa = { id: string; nombre: string; contenido: string };
type PlantillaEmail = { id: string; nombre: string; asunto: string; cuerpo_text: string | null; cuerpo_html: string };

const ESTADOS = ["nuevo", "contactado", "respondio", "cliente", "descartado"] as const;
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", respondio: "Respondió", cliente: "Cliente", descartado: "Descartado",
};

// prospeccion_leads / plantillas_* aún no están en el types.ts generado.
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
  const wa = waLink(lead);

  const enviarWa = () => {
    const p = plantillasWa.find((x) => x.id === waPlantilla);
    if (!p || !wa) return;
    const msg = fillTemplate(p.contenido, lead);
    window.open(`${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    onEnviado(lead, "whatsapp", p.id, msg);
  };

  const enviarEmail = () => {
    const p = plantillasEmail.find((x) => x.id === emailPlantilla);
    if (!p || !lead.email) return;
    const asunto = fillTemplate(p.asunto, lead);
    const cuerpo = fillTemplate(p.cuerpo_text || p.cuerpo_html, lead);
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    onEnviado(lead, "email", p.id, `${asunto}\n\n${cuerpo}`);
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

        {/* Estado */}
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

        {/* Notas */}
        <Textarea
          defaultValue={lead.notas || ""}
          onChange={(e) => setNotasDraft(e.target.value)}
          onBlur={() => { if (notasDraft !== (lead.notas || "")) onNotasChange(lead, notasDraft); }}
          placeholder="Notas del contacto…"
          className="min-h-[56px] text-sm"
        />

        {/* Contactar */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Select value={waPlantilla} onValueChange={setWaPlantilla}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Plantilla WhatsApp" /></SelectTrigger>
            <SelectContent>
              {plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" disabled={!waPlantilla || !wa} onClick={enviarWa} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <MessageCircle className="h-3.5 w-3.5" /> Enviar WhatsApp
          </Button>

          <Select value={emailPlantilla} onValueChange={setEmailPlantilla}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Plantilla email" /></SelectTrigger>
            <SelectContent>
              {plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" disabled={!emailPlantilla || !lead.email} onClick={enviarEmail} className="gap-1.5">
            <MailIcon className="h-3.5 w-3.5" /> Enviar email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MisLeads() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [plantillasWa, setPlantillasWa] = useState<PlantillaWa[]>([]);
  const [plantillasEmail, setPlantillasEmail] = useState<PlantillaEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState("all");

  const cargar = async () => {
    setLoading(true);
    const [{ data: leadsData, error: leadsErr }, { data: waData }, { data: emailData }] = await Promise.all([
      sb.from("prospeccion_leads").select("*").order("score", { ascending: false }),
      sb.from("plantillas_whatsapp").select("id,nombre,contenido").eq("activa", true).order("nombre"),
      sb.from("plantillas_email").select("id,nombre,asunto,cuerpo_text,cuerpo_html").eq("activa", true).order("nombre"),
    ]);
    if (leadsErr) {
      toast({ title: "Error al cargar tus leads", description: leadsErr.message, variant: "destructive" });
    } else {
      setLeads((leadsData ?? []) as Lead[]);
    }
    setPlantillasWa((waData ?? []) as PlantillaWa[]);
    setPlantillasEmail((emailData ?? []) as PlantillaEmail[]);
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
      lead_id: lead.id, user_id: uid, canal, plantilla_id: plantillaId, mensaje_final: mensaje,
    });
  };

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) { const e = l.estado_gestion || "nuevo"; c[e] = (c[e] || 0) + 1; }
    return c;
  }, [leads]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Mis Leads</h1>
            <p className="text-sm text-muted-foreground">Leads de campaña asignados a tu país. Contacta con las plantillas listas.</p>
          </div>
        </div>
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
            ? "Todavía no tienes leads asignados. Tu administrador publica leads de campaña por país."
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

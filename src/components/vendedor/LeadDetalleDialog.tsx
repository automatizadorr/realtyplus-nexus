import { useCallback, useEffect, useState } from "react";
import {
  Loader2, MapPin, Mail as MailIcon, MessageCircle, Phone, PhoneCall, Instagram, Facebook,
  Download, Copy, Check, CalendarClock, Archive, StickyNote, History, ExternalLink, Radar,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/lib/icebreakers";
import { fillTemplate } from "@/lib/fillTemplate";
import { descargarGuion, telLink } from "@/lib/guionLlamada";
import { facebookMessenger, facebookPerfil, instagramDm, instagramPerfil, mensajeRedes } from "@/lib/redes";
import EtapaProgreso from "@/components/vendedor/EtapaProgreso";
import {
  ETAPA_COLOR, ETAPA_LABEL, ETAPAS_PERMITIDAS, type ContactoLog, type Etapa,
  type LeadCampana, type LeadDetalle, type PlantillaEmail, type PlantillaWa, type RolVenta,
} from "@/components/vendedor/types";

// RPCs y columnas nuevas todavía no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const CANAL_LABEL: Record<ContactoLog["canal"], string> = {
  whatsapp: "WhatsApp", email: "Email", llamada: "Llamada", instagram: "Instagram", facebook: "Facebook",
};
const CANAL_ICON: Record<ContactoLog["canal"], typeof MessageCircle> = {
  whatsapp: MessageCircle, email: MailIcon, llamada: PhoneCall, instagram: Instagram, facebook: Facebook,
};

// Resultados posibles de una llamada. Se guardan en contactos_log.resultado y
// son los que alimentan la decisión de "¿vale la pena volver a llamar?".
const RESULTADOS_LLAMADA = [
  "Contestó · interesado",
  "Contestó · pidió info",
  "Contestó · no le interesa",
  "No contestó",
  "Buzón de voz",
  "Número equivocado",
  "Agendó reunión",
] as const;

function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function soloFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL");
}
function dias(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
function waLinkLead(l: Pick<LeadCampana, "telefono" | "pais">): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

function Dato({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="truncate text-sm">{children}</div>
    </div>
  );
}

function BotonCopiar({ texto, label }: { texto: string; label: string }) {
  const { toast } = useToast();
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true); setTimeout(() => setOk(false), 1500);
          toast({ title: "Copiado", description: label });
        } catch { toast({ title: "No se pudo copiar", variant: "destructive" }); }
      }}
    >
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
    </Button>
  );
}

// Ficha completa del lead: todos sus datos, su avance en el embudo, los
// canales de contacto (WhatsApp, email, llamada con guion, Instagram,
// Facebook) y el historial completo del proceso. Se abre al hacer clic en
// una tarjeta del Pipeline o en una fila de la Bandeja.
export default function LeadDetalleDialog({
  leadId, open, onOpenChange, plantillasWa, plantillasEmail, miRol,
  vendedorNombre, onCambio,
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  miRol?: RolVenta;
  vendedorNombre?: string | null;
  /** Se llama tras mover etapa, archivar o registrar contacto, para refrescar. */
  onCambio?: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<LeadDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [notas, setNotas] = useState("");
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [waPlantillaId, setWaPlantillaId] = useState("");
  const [emailPlantillaId, setEmailPlantillaId] = useState("");
  const [resultadoLlamada, setResultadoLlamada] = useState("");
  const [seguimiento, setSeguimiento] = useState("");
  const [moviendo, setMoviendo] = useState(false);

  const cargar = useCallback(async () => {
    if (!leadId) return;
    setCargando(true);
    const { data: d, error } = await sb.rpc("vendedor_lead_detalle", { _lead_id: leadId });
    setCargando(false);
    if (error) { toast({ title: "No se pudo cargar la ficha", description: error.message, variant: "destructive" }); return; }
    const detalle = d as LeadDetalle;
    setData(detalle);
    setNotas(detalle?.lead?.notas_vendedor ?? "");
    setSeguimiento(detalle?.lead?.fecha_proximo_contacto ? String(detalle.lead.fecha_proximo_contacto).slice(0, 10) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => { if (open && leadId) cargar(); }, [open, leadId, cargar]);
  useEffect(() => { if (!open) { setData(null); setResultadoLlamada(""); } }, [open]);

  const lead = data?.lead;
  const prospecto = (data?.prospecto ?? null) as Record<string, unknown> | null;
  const etapa = ((lead?.etapa_venta as Etapa) || "contactado") as Etapa;
  const color = ETAPA_COLOR[etapa];

  const gancho = Array.isArray(prospecto?.problemas) && (prospecto?.problemas as string[]).length
    ? (prospecto?.problemas as string[])[0] : null;
  const propuestaValor = (prospecto?.propuesta_valor as string) || lead?.resumen_ia || null;

  const vars = { nombre: lead?.nombre || undefined, pais: lead?.pais || undefined };

  const registrarContacto = async (
    canal: ContactoLog["canal"], mensaje: string, plantillaId?: string, resultado?: string,
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid || !leadId) return;
    const { error } = await sb.from("contactos_log").insert({
      lead_id: leadId, user_id: uid, canal, plantilla_id: plantillaId ?? null,
      mensaje_final: mensaje, origen: "leads_campana", resultado: resultado ?? null,
    });
    if (error) { toast({ title: "No se pudo registrar el contacto", description: error.message, variant: "destructive" }); return; }
    await cargar();
    onCambio?.();
  };

  const enviarWa = () => {
    const p = plantillasWa.find((x) => x.id === waPlantillaId);
    const link = lead ? waLinkLead(lead) : null;
    if (!p || !link) return;
    const msg = fillTemplate(p.contenido, vars);
    window.open(`${link}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    registrarContacto("whatsapp", msg, p.id);
  };

  const enviarEmail = () => {
    const p = plantillasEmail.find((x) => x.id === emailPlantillaId);
    if (!p || !lead?.email) return;
    const asunto = fillTemplate(p.asunto, vars);
    const cuerpo = fillTemplate(p.cuerpo_text || p.cuerpo_html, vars);
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    registrarContacto("email", `${asunto}\n\n${cuerpo}`, p.id);
  };

  const guardarNotas = async () => {
    if (!leadId) return;
    setGuardandoNotas(true);
    const { error } = await sb.rpc("vendedor_set_notas_lead", { _lead_id: leadId, _notas: notas });
    setGuardandoNotas(false);
    if (error) { toast({ title: "No se pudieron guardar las notas", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Notas guardadas" });
    onCambio?.();
  };

  const moverEtapa = async (destino: Etapa) => {
    if (!leadId) return;
    if (destino === "perdido") {
      const motivo = window.prompt("¿Por qué se perdió este lead?")?.trim();
      if (!motivo) return;
      setMoviendo(true);
      const { error } = await sb.rpc("vendedor_mover_etapa", { _lead_id: leadId, _etapa: destino, _motivo_cierre: motivo });
      setMoviendo(false);
      if (error) { toast({ title: "No se pudo mover", description: error.message, variant: "destructive" }); return; }
    } else {
      setMoviendo(true);
      const { error } = await sb.rpc("vendedor_mover_etapa", { _lead_id: leadId, _etapa: destino, _motivo_cierre: null });
      setMoviendo(false);
      if (error) { toast({ title: "No se pudo mover", description: error.message, variant: "destructive" }); return; }
    }
    await cargar();
    onCambio?.();
    toast({ title: `Movido a ${ETAPA_LABEL[destino]}` });
  };

  const programarSeguimiento = async () => {
    if (!leadId || !seguimiento) return;
    const iso = new Date(`${seguimiento}T09:00:00`).toISOString();
    const { error } = await sb.rpc("vendedor_set_proximo_contacto", { _lead_id: leadId, _fecha: iso });
    if (error) { toast({ title: "No se pudo programar", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Seguimiento el ${new Date(iso).toLocaleDateString("es-CL")}` });
    await cargar();
    onCambio?.();
  };

  const archivar = async () => {
    if (!leadId) return;
    const { error } = await sb.rpc("vendedor_archivar_lead", { _lead_id: leadId, _archivado: true });
    if (error) { toast({ title: "No se pudo archivar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Lead archivado" });
    onOpenChange(false);
    onCambio?.();
  };

  const tel = telLink(lead?.telefono);
  const wa = lead ? waLinkLead(lead) : null;
  const ig = instagramDm(lead?.instagram);
  const igPerfil = instagramPerfil(lead?.instagram);
  const fb = facebookMessenger(lead?.facebook);
  const fbPerfil = facebookPerfil(lead?.facebook);
  const msgRedes = mensajeRedes({
    mensajeIa: lead?.mensaje_instagram, nombre: lead?.nombre, gancho, propuestaValor,
  });

  const etapasPermitidas = miRol ? ETAPAS_PERMITIDAS[miRol] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {cargando || !lead ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-500"
                  style={{ backgroundColor: color.hex }}
                />
                {lead.nombre || "Lead"}
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${color.badge}`}>
                  {ETAPA_LABEL[etapa]}
                </span>
                {lead.ha_respondido && (
                  <Badge variant="secondary" className="text-[10px] text-emerald-600">respondió</Badge>
                )}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {lead.pais && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.pais}</span>}
                <span>Asignado hace {dias(lead.fecha_asignacion) ?? "—"} día(s)</span>
                {lead.origen && <span className="capitalize">· origen: {String(lead.origen).replace(/_/g, " ")}</span>}
              </DialogDescription>
            </DialogHeader>

            {/* Avance en el embudo */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <EtapaProgreso etapa={etapa} mostrarHitos />
            </div>

            {/* Datos de contacto */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <Dato icon={Phone} label="Teléfono">{lead.telefono?.startsWith("sin-tel-") ? <span className="text-muted-foreground">sin teléfono</span> : lead.telefono || "—"}</Dato>
              <Dato icon={MailIcon} label="Email">{lead.email || <span className="text-muted-foreground">—</span>}</Dato>
              <Dato icon={MapPin} label="País">{lead.pais || "—"}</Dato>
              <Dato icon={Instagram} label="Instagram">
                {igPerfil ? <a href={igPerfil} target="_blank" rel="noreferrer" className="text-[#003DA5] hover:underline">{lead.instagram}</a> : <span className="text-muted-foreground">—</span>}
              </Dato>
              <Dato icon={Facebook} label="Facebook">
                {fbPerfil ? <a href={fbPerfil} target="_blank" rel="noreferrer" className="text-[#003DA5] hover:underline">{lead.facebook}</a> : <span className="text-muted-foreground">—</span>}
              </Dato>
              <Dato icon={CalendarClock} label="Próximo contacto">{soloFecha(lead.fecha_proximo_contacto)}</Dato>
            </div>

            {(propuestaValor || gancho) && (
              <div className="space-y-1 rounded-lg border border-[#003DA5]/20 bg-[#003DA5]/5 p-3 text-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#003DA5]">
                  <Radar className="h-3.5 w-3.5" /> Ángulo de venta
                </div>
                {gancho && <p className="text-muted-foreground">{gancho}</p>}
                {propuestaValor && <p>{propuestaValor}</p>}
              </div>
            )}

            {/* Canales de contacto */}
            <div className="space-y-3 rounded-lg border p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contactar</h3>

              {/* WhatsApp */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={waPlantillaId} onValueChange={setWaPlantillaId}>
                  <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Plantilla WhatsApp" /></SelectTrigger>
                  <SelectContent>{plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button" size="sm" disabled={!wa || !waPlantillaId} onClick={enviarWa}
                  className="h-8 gap-1.5 bg-emerald-600 px-2.5 text-[11px] hover:bg-emerald-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                {!wa && <span className="text-[11px] text-muted-foreground">sin WhatsApp marcable</span>}
              </div>

              {/* Email */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={emailPlantillaId} onValueChange={setEmailPlantillaId}>
                  <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Plantilla email" /></SelectTrigger>
                  <SelectContent>{plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button" size="sm" variant="outline" disabled={!lead.email || !emailPlantillaId}
                  onClick={enviarEmail} className="h-8 gap-1.5 px-2.5 text-[11px]"
                >
                  <MailIcon className="h-3.5 w-3.5" /> Email
                </Button>
                {!lead.email && <span className="text-[11px] text-muted-foreground">sin email</span>}
              </div>

              {/* Llamada telefónica + guion en frío */}
              <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button" size="sm" disabled={!tel} className="h-8 gap-1.5 bg-amber-600 px-2.5 text-[11px] hover:bg-amber-700"
                    onClick={() => { if (tel) window.location.href = tel; }}
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> Llamar {lead.telefono && !lead.telefono.startsWith("sin-tel-") ? lead.telefono : ""}
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-[11px]"
                    onClick={() => descargarGuion({
                      nombre: lead.nombre, empresa: lead.nombre, pais: lead.pais,
                      ciudad: (prospecto?.ciudad as string) ?? null,
                      gancho, propuestaValor, vendedor: vendedorNombre, telefono: lead.telefono,
                    })}
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar guion en frío
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={resultadoLlamada} onValueChange={setResultadoLlamada}>
                    <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Resultado de la llamada" /></SelectTrigger>
                    <SelectContent>{RESULTADOS_LLAMADA.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button
                    type="button" size="sm" variant="outline" disabled={!resultadoLlamada}
                    className="h-8 gap-1.5 px-2.5 text-[11px]"
                    onClick={() => { registrarContacto("llamada", `Llamada: ${resultadoLlamada}`, undefined, resultadoLlamada); setResultadoLlamada(""); }}
                  >
                    <Check className="h-3.5 w-3.5" /> Registrar llamada
                  </Button>
                </div>
              </div>

              {/* Instagram / Facebook: el mensaje viene de Buscar Leads */}
              <div className="space-y-2 rounded-md border border-fuchsia-500/25 bg-fuchsia-500/5 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium">
                    Mensaje para redes
                    {lead.mensaje_instagram ? <span className="ml-1 text-muted-foreground">· generado en Buscar Leads</span> : <span className="ml-1 text-muted-foreground">· sugerido</span>}
                  </span>
                  <BotonCopiar texto={msgRedes} label="Mensaje para Instagram/Facebook" />
                </div>
                <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border bg-background p-2 text-[11px] text-muted-foreground">{msgRedes}</p>
                <p className="text-[10px] text-muted-foreground">
                  Instagram y Facebook no aceptan el texto en el enlace: copia el mensaje y pégalo en el chat que se abre.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button" size="sm" disabled={!ig}
                    className="h-8 gap-1.5 bg-gradient-to-r from-fuchsia-600 to-orange-500 px-2.5 text-[11px] text-white hover:opacity-90"
                    onClick={async () => {
                      if (!ig) return;
                      try { await navigator.clipboard.writeText(msgRedes); } catch { /* el usuario puede copiarlo a mano */ }
                      window.open(ig, "_blank", "noreferrer");
                      registrarContacto("instagram", msgRedes);
                    }}
                  >
                    <Instagram className="h-3.5 w-3.5" /> Copiar y abrir Instagram
                  </Button>
                  <Button
                    type="button" size="sm" disabled={!fb}
                    className="h-8 gap-1.5 bg-[#1877F2] px-2.5 text-[11px] text-white hover:bg-[#1877F2]/90"
                    onClick={async () => {
                      if (!fb) return;
                      try { await navigator.clipboard.writeText(msgRedes); } catch { /* el usuario puede copiarlo a mano */ }
                      window.open(fb, "_blank", "noreferrer");
                      registrarContacto("facebook", msgRedes);
                    }}
                  >
                    <Facebook className="h-3.5 w-3.5" /> Copiar y abrir Messenger
                  </Button>
                  {!ig && !fb && <span className="text-[11px] text-muted-foreground">Este lead no tiene redes cargadas.</span>}
                </div>
              </div>
            </div>

            {/* Mover de etapa + seguimiento + archivar */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mover a</span>
              {etapasPermitidas.map((e) => (
                <Button
                  key={e} type="button" size="sm" variant={e === etapa ? "secondary" : "outline"}
                  disabled={moviendo || e === etapa} onClick={() => moverEtapa(e)}
                  className={`h-7 px-2 text-[11px] ${e === etapa ? "" : "hover:border-current"}`}
                  style={e === etapa ? undefined : { color: ETAPA_COLOR[e].hex }}
                >
                  {ETAPA_LABEL[e]}
                </Button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <input
                  type="date" value={seguimiento} onChange={(ev) => setSeguimiento(ev.target.value)}
                  className="h-7 rounded border px-1.5 text-[11px]" aria-label="Fecha de seguimiento"
                />
                <Button type="button" size="sm" variant="outline" disabled={!seguimiento} onClick={programarSeguimiento} className="h-7 gap-1 px-2 text-[11px]">
                  <CalendarClock className="h-3 w-3" /> Programar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={archivar} className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-red-600">
                  <Archive className="h-3 w-3" /> Archivar
                </Button>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1.5 rounded-lg border p-3">
              <Label className="flex items-center gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Notas del lead</Label>
              <Textarea
                value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Lo que dijo textual, con quién hay que hablar, cuándo volver a llamar…"
                className="min-h-[70px] text-sm"
              />
              <Button type="button" size="sm" disabled={guardandoNotas} onClick={guardarNotas} className="h-7 gap-1.5 px-2.5 text-[11px]">
                {guardandoNotas ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar notas
              </Button>
            </div>

            {/* Historial del proceso */}
            <div className="space-y-2 rounded-lg border p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Historial del proceso
              </h3>

              {data.etapas.length === 0 && data.contactos.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">Todavía no hay movimientos registrados.</p>
              ) : (
                <ol className="space-y-2 border-l pl-3">
                  {data.etapas.map((e, i) => (
                    <li key={`et-${i}`} className="relative text-xs">
                      <span
                        className="absolute -left-[17px] top-1 h-2 w-2 rounded-full"
                        style={{ backgroundColor: ETAPA_COLOR[(e.etapa_nueva as Etapa)]?.hex ?? "#94a3b8" }}
                      />
                      <span className="font-medium">
                        {e.etapa_anterior ? `${ETAPA_LABEL[e.etapa_anterior as Etapa] ?? e.etapa_anterior} → ` : ""}
                        {ETAPA_LABEL[e.etapa_nueva as Etapa] ?? e.etapa_nueva}
                      </span>
                      <span className="ml-2 text-muted-foreground">{fecha(e.created_at)}</span>
                    </li>
                  ))}
                  {data.contactos.map((c, i) => {
                    const Icon = CANAL_ICON[c.canal] ?? MessageCircle;
                    return (
                      <li key={`c-${i}`} className="relative text-xs">
                        <span className="absolute -left-[17px] top-1 grid h-2 w-2 place-items-center rounded-full bg-muted-foreground/50" />
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Icon className="h-3 w-3" /> {CANAL_LABEL[c.canal] ?? c.canal}
                          {c.resultado ? ` · ${c.resultado}` : ""}
                        </span>
                        <span className="ml-2 text-muted-foreground">{fecha(c.created_at)}</span>
                        {c.mensaje_final && (
                          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{c.mensaje_final}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {prospecto && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                Este lead salió de una búsqueda en Buscar Leads
                {prospecto.fuente ? ` (${String(prospecto.fuente)})` : ""}
                {typeof prospecto.score === "number" ? ` · score ${prospecto.score}` : ""}.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

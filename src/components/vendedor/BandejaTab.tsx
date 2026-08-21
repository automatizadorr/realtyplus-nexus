import { useEffect, useState } from "react";
import { Loader2, Inbox, MessageCircle, Mail as MailIcon, ArrowRightCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/lib/icebreakers";
import { fillTemplate } from "@/lib/fillTemplate";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

// leads_campana.primer_contacto_at aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type LeadEnBandeja = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; fecha_asignacion: string | null;
};

function waLink(l: LeadEnBandeja): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

export default function BandejaTab({ plantillasWa, plantillasEmail, onLiberados }: {
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  onLiberados?: () => void;
}) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadEnBandeja[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [waPlantillaId, setWaPlantillaId] = useState("");
  const [emailPlantillaId, setEmailPlantillaId] = useState("");
  const [waEnviados, setWaEnviados] = useState<Set<string>>(new Set());
  const [enviandoCorreos, setEnviandoCorreos] = useState(false);
  const [liberando, setLiberando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("leads_campana")
      .select("id, nombre, telefono, email, pais, fecha_asignacion")
      .is("primer_contacto_at", null)
      .order("fecha_asignacion", { ascending: true });
    if (error) toast({ title: "Error al cargar la bandeja", description: error.message, variant: "destructive" });
    else {
      const filas = (data ?? []) as LeadEnBandeja[];
      setLeads(filas);
      setSelected(new Set(filas.map((l) => l.id)));
    }
    setWaEnviados(new Set());
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(leads.map((l) => l.id)));

  const waPlantilla = plantillasWa.find((p) => p.id === waPlantillaId);
  const emailPlantilla = plantillasEmail.find((p) => p.id === emailPlantillaId);

  const registrarContacto = async (leadId: string, canal: "whatsapp" | "email", plantillaId: string, mensaje: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    await sb.from("contactos_log").insert({
      lead_id: leadId, user_id: uid, canal, plantilla_id: plantillaId, mensaje_final: mensaje, origen: "leads_campana",
    });
  };

  const enviarWa = (l: LeadEnBandeja) => {
    if (!waPlantilla) return;
    const link = waLink(l);
    if (!link) return;
    const msg = fillTemplate(waPlantilla.contenido, { nombre: l.nombre || undefined, pais: l.pais || undefined });
    window.open(`${link}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    registrarContacto(l.id, "whatsapp", waPlantilla.id, msg);
    setWaEnviados((s) => new Set(s).add(l.id));
  };

  const liberarAPipeline = async (ids: string[]) => {
    if (ids.length === 0) return 0;
    setLiberando(true);
    try {
      const { data, error } = await sb.rpc("vendedor_liberar_a_pipeline", { _lead_ids: ids });
      if (error) throw error;
      const n = (data ?? [])[0]?.liberados ?? 0;
      setLeads((ls) => ls.filter((l) => !ids.includes(l.id)));
      setSelected((s) => { const n2 = new Set(s); ids.forEach((id) => n2.delete(id)); return n2; });
      onLiberados?.();
      return n;
    } finally {
      setLiberando(false);
    }
  };

  const enviarCorreosYLiberar = async () => {
    if (!emailPlantilla || selected.size === 0) return;
    setEnviandoCorreos(true);
    try {
      const seleccionados = leads.filter((l) => selected.has(l.id));
      const conEmail = seleccionados.filter((l) => l.email);
      if (conEmail.length > 0) {
        const { data, error } = await supabase.functions.invoke("send-personalized-campaign", {
          body: {
            subject: emailPlantilla.asunto,
            html: emailPlantilla.cuerpo_html,
            text: emailPlantilla.cuerpo_text || undefined,
            recipients: conEmail.map((l) => ({ email: l.email, nombre: l.nombre || undefined, pais: l.pais || undefined })),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        for (const l of conEmail) await registrarContacto(l.id, "email", emailPlantilla.id, emailPlantilla.asunto);
        toast({
          title: `Correos: ${data?.sent ?? 0} enviado(s)`,
          description: data?.aviso || (data?.failed ? `${data.failed} fallaron.` : undefined),
          variant: data?.failed ? "destructive" : "default",
        });
      }
      const n = await liberarAPipeline(seleccionados.map((l) => l.id));
      toast({ title: `${n} lead(s) pasados al Pipeline` });
    } catch (e) {
      toast({ title: "No se pudo enviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setEnviandoCorreos(false);
    }
  };

  const pasarSinCorreo = async () => {
    const ids = [...selected];
    const n = await liberarAPipeline(ids);
    if (n > 0) toast({ title: `${n} lead(s) pasados al Pipeline` });
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
        Estos leads te fueron asignados pero todavía <span className="font-semibold text-foreground">no aparecen en tu Pipeline</span>.
        Elige una plantilla de WhatsApp y/o email, contáctalos, y pásalos al Pipeline cuando quieras — así no se te acumulan todos de golpe.
      </p>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plantilla WhatsApp</label>
              <Select value={waPlantillaId} onValueChange={setWaPlantillaId}>
                <SelectTrigger><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                <SelectContent>{plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plantilla email</label>
              <Select value={emailPlantillaId} onValueChange={setEmailPlantillaId}>
                <SelectTrigger><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                <SelectContent>{plantillasEmail.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Badge variant="secondary">{selected.size} seleccionados</Badge>
            <Button
              type="button" size="sm" disabled={!emailPlantilla || selected.size === 0 || enviandoCorreos || liberando}
              onClick={enviarCorreosYLiberar} className="gap-1.5"
            >
              {enviandoCorreos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailIcon className="h-3.5 w-3.5" />}
              Enviar correos y pasar a Pipeline
            </Button>
            <Button
              type="button" size="sm" variant="outline" disabled={selected.size === 0 || liberando || enviandoCorreos}
              onClick={pasarSinCorreo} className="gap-1.5"
            >
              {liberando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="h-3.5 w-3.5" />}
              Pasar a Pipeline sin correo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cargar} className="ml-auto gap-1.5 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Seleccionar todos" className="h-4 w-4 accent-[#003DA5]" checked={allChecked} onChange={toggleAll} />
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead className="hidden sm:table-cell">País</TableHead>
              <TableHead className="w-28">WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4}>
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </div>
              </TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={4}>
                <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <Inbox className="h-6 w-6" /> Tu bandeja está vacía. Los nuevos leads que te asigne el admin aparecerán aquí.
                </div>
              </TableCell></TableRow>
            ) : (
              leads.map((l) => {
                const link = waLink(l);
                const yaEnviado = waEnviados.has(l.id);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <input
                        type="checkbox" aria-label={`Seleccionar ${l.nombre || "lead"}`}
                        className="h-4 w-4 accent-[#003DA5]"
                        checked={selected.has(l.id)} onChange={() => toggleSel(l.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.nombre || "—"}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {l.telefono && <span>{l.telefono}</span>}
                        {l.email && <span>{l.email}</span>}
                        {!l.email && <span className="italic">sin email</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{l.pais || "—"}</TableCell>
                    <TableCell>
                      {link ? (
                        <Button
                          type="button" size="sm" variant={yaEnviado ? "secondary" : "outline"}
                          disabled={!waPlantilla} onClick={() => enviarWa(l)}
                          className="h-8 gap-1 px-2 text-[11px] text-emerald-700"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> {yaEnviado ? "Enviado" : "WA"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">sin WhatsApp</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

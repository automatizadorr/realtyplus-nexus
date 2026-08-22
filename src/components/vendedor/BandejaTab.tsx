import { useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, MessageCircle, Mail as MailIcon, ArrowRightCircle, RefreshCw, ChevronLeft, ChevronRight, Star, Eye, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/lib/icebreakers";
import { fillTemplate } from "@/lib/fillTemplate";
import EditarPlantillaDialog from "@/components/vendedor/EditarPlantillaDialog";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";
import { useGuardiaWhatsapp } from "@/hooks/use-guardia-whatsapp";

// leads_campana.primer_contacto_at aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type LeadEnBandeja = {
  id: string; nombre: string | null; telefono: string | null; email: string | null;
  pais: string | null; fecha_asignacion: string | null;
};

// Se trae de a 25 (no toda la bandeja de una), para no volver lenta la
// plataforma cuando a un vendedor le asignan lotes grandes de golpe.
const PAGE_SIZE = 25;

function waLink(l: LeadEnBandeja): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

type Canal = "whatsapp" | "email";
const favKey = (canal: Canal, id: string) => `${canal}:${id}`;

// Favoritas primero (mismo orden relativo entre ellas y entre el resto).
function ordenarPorFavorito<T extends { id: string }>(items: T[], canal: Canal, favoritos: Set<string>): T[] {
  return [...items].sort((a, b) => {
    const favA = favoritos.has(favKey(canal, a.id)) ? 0 : 1;
    const favB = favoritos.has(favKey(canal, b.id)) ? 0 : 1;
    return favA - favB;
  });
}

export default function BandejaTab({ plantillasWa, plantillasEmail, onLiberados, onPlantillasChanged }: {
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  onLiberados?: () => void;
  onPlantillasChanged?: () => void;
}) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadEnBandeja[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [waPlantillaId, setWaPlantillaId] = useState("");
  const [emailPlantillaId, setEmailPlantillaId] = useState("");
  const [waEnviados, setWaEnviados] = useState<Set<string>>(new Set());
  // Un mismo número no recibe el mensaje dos veces aunque esté cargado en dos
  // leads distintos (a veces con el nombre escrito de otra forma).
  const guardiaWa = useGuardiaWhatsapp();
  const [enviandoCorreos, setEnviandoCorreos] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<{ canal: Canal; plantilla: PlantillaWa | PlantillaEmail } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    sb.from("plantilla_favoritos").select("canal, plantilla_id").then(({ data }: { data: { canal: Canal; plantilla_id: string }[] | null }) => {
      if (data) setFavoritos(new Set(data.map((f) => favKey(f.canal, f.plantilla_id))));
    });
  }, []);

  const toggleFavorito = async (canal: Canal, plantillaId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;
    const key = favKey(canal, plantillaId);
    const eraFavorita = favoritos.has(key);
    setFavoritos((s) => { const n = new Set(s); eraFavorita ? n.delete(key) : n.add(key); return n; });
    if (eraFavorita) {
      await sb.from("plantilla_favoritos").delete().eq("user_id", uid).eq("canal", canal).eq("plantilla_id", plantillaId);
    } else {
      await sb.from("plantilla_favoritos").insert({ user_id: uid, canal, plantilla_id: plantillaId });
    }
  };

  const cargar = async (p: number = page) => {
    setLoading(true);
    const { data, count, error } = await sb
      .from("leads_campana")
      .select("id, nombre, telefono, email, pais, fecha_asignacion", { count: "exact" })
      .is("primer_contacto_at", null)
      // Un lead archivado (duplicado de teléfono, número inmarcable, o archivado
      // a mano) no debe seguir apareciendo en la bandeja. El Pipeline ya filtraba
      // esto; la Bandeja no, y por eso los archivados seguían a la vista.
      .not("archivado", "is", true)
      .order("fecha_asignacion", { ascending: true })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) toast({ title: "Error al cargar la bandeja", description: error.message, variant: "destructive" });
    else {
      const filas = (data ?? []) as LeadEnBandeja[];
      setLeads(filas);
      setTotal(count ?? 0);
      setSelected(new Set(filas.map((l) => l.id)));
    }
    setWaEnviados(new Set());
    setLoading(false);
  };

  useEffect(() => { cargar(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);
  useEffect(() => { setPage((p) => Math.min(p, totalPages - 1)); }, [totalPages]);

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(leads.map((l) => l.id)));

  const waPlantilla = plantillasWa.find((p) => p.id === waPlantillaId);
  const emailPlantilla = plantillasEmail.find((p) => p.id === emailPlantillaId);

  const plantillasWaOrdenadas = useMemo(() => ordenarPorFavorito(plantillasWa, "whatsapp", favoritos), [plantillasWa, favoritos]);
  const plantillasEmailOrdenadas = useMemo(() => ordenarPorFavorito(plantillasEmail, "email", favoritos), [plantillasEmail, favoritos]);

  // Ejemplo para la previsualización: el primer lead seleccionado (en el
  // orden en que aparece en la tabla).
  const leadEjemplo = leads.find((l) => selected.has(l.id));

  const waPreview = waPlantilla && leadEjemplo
    ? fillTemplate(waPlantilla.contenido, { nombre: leadEjemplo.nombre || undefined, pais: leadEjemplo.pais || undefined })
    : null;
  const emailPreview = emailPlantilla && leadEjemplo
    ? {
        asunto: fillTemplate(emailPlantilla.asunto, { nombre: leadEjemplo.nombre || undefined, pais: leadEjemplo.pais || undefined }),
        cuerpo: fillTemplate(emailPlantilla.cuerpo_text || emailPlantilla.cuerpo_html, { nombre: leadEjemplo.nombre || undefined, pais: leadEjemplo.pais || undefined }),
      }
    : null;

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
    if (guardiaWa.esDuplicadoYaContactado(l)) {
      toast({
        title: "Ese número ya recibió el mensaje",
        description: "Está cargado en otro lead (a veces con otro nombre). No se envía de nuevo para no generar spam.",
        variant: "destructive",
      });
      setWaEnviados((s) => new Set(s).add(l.id));
      return;
    }
    const msg = fillTemplate(waPlantilla.contenido, { nombre: l.nombre || undefined, pais: l.pais || undefined });
    window.open(`${link}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
    registrarContacto(l.id, "whatsapp", waPlantilla.id, msg);
    guardiaWa.registrarEnvio(l);
    setWaEnviados((s) => new Set(s).add(l.id));
  };

  const liberarAPipeline = async (ids: string[]) => {
    if (ids.length === 0) return 0;
    setLiberando(true);
    try {
      const { data, error } = await sb.rpc("vendedor_liberar_a_pipeline", { _lead_ids: ids });
      if (error) throw error;
      const n = (data ?? [])[0]?.liberados ?? 0;
      // Al liberar, la ventana (offset/limit) actual corre sola: se vuelve a
      // pedir la misma página y entran los siguientes de la bandeja.
      await cargar(page);
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
        {total > PAGE_SIZE && ` Se muestran de a ${PAGE_SIZE} a la vez (tienes ${total.toLocaleString("es-CL")} en total).`}
      </p>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plantilla WhatsApp</label>
              <div className="flex items-center gap-1.5">
                <Select value={waPlantillaId} onValueChange={setWaPlantillaId}>
                  <SelectTrigger><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                  <SelectContent>
                    {plantillasWaOrdenadas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {favoritos.has(favKey("whatsapp", p.id)) ? "★ " : ""}{p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  disabled={!waPlantillaId} onClick={() => waPlantillaId && toggleFavorito("whatsapp", waPlantillaId)}
                  aria-label="Marcar como favorita"
                >
                  <Star className={`h-4 w-4 ${waPlantillaId && favoritos.has(favKey("whatsapp", waPlantillaId)) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  disabled={!waPlantilla} onClick={() => waPlantilla && setEditando({ canal: "whatsapp", plantilla: waPlantilla })}
                  aria-label="Editar plantilla"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              {waPlantillaId && (
                <div className="flex items-start gap-1.5 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {waPreview ? <p className="whitespace-pre-wrap">{waPreview}</p> : <p>Selecciona al menos un lead para previsualizar.</p>}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Plantilla email</label>
              <div className="flex items-center gap-1.5">
                <Select value={emailPlantillaId} onValueChange={setEmailPlantillaId}>
                  <SelectTrigger><SelectValue placeholder="Elegir plantilla" /></SelectTrigger>
                  <SelectContent>
                    {plantillasEmailOrdenadas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {favoritos.has(favKey("email", p.id)) ? "★ " : ""}{p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  disabled={!emailPlantillaId} onClick={() => emailPlantillaId && toggleFavorito("email", emailPlantillaId)}
                  aria-label="Marcar como favorita"
                >
                  <Star className={`h-4 w-4 ${emailPlantillaId && favoritos.has(favKey("email", emailPlantillaId)) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </Button>
                <Button
                  type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  disabled={!emailPlantilla} onClick={() => emailPlantilla && setEditando({ canal: "email", plantilla: emailPlantilla })}
                  aria-label="Editar plantilla"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              {emailPlantillaId && (
                <div className="flex items-start gap-1.5 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {emailPreview ? (
                    <div>
                      <p className="font-medium text-foreground">{emailPreview.asunto}</p>
                      <p className="whitespace-pre-wrap">{emailPreview.cuerpo}</p>
                    </div>
                  ) : <p>Selecciona al menos un lead para previsualizar.</p>}
                </div>
              )}
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

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {total === 0 ? "Bandeja vacía" : `Página ${page + 1} de ${totalPages} · ${total.toLocaleString("es-CL")} en bandeja`}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1" disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1" disabled={loading || page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <EditarPlantillaDialog
        open={!!editando}
        onOpenChange={(v) => !v && setEditando(null)}
        canal={editando?.canal ?? "whatsapp"}
        plantilla={editando?.plantilla ?? null}
        onSaved={() => onPlantillasChanged?.()}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers, Loader2, Send, CalendarClock, Clock, BookOpen, X, RotateCcw, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Recipient = { email: string; empresa: string; ciudad: string; gancho: string };
type Paso = {
  id: string; paso: number; dias_desde_inicio: number; hora_envio: string;
  asunto: string; cuerpo: string; cta_texto: string | null; cta_url: string | null; guia_titulo: string | null;
};
type Secuencia = { id: string; nombre: string; descripcion: string | null; total_pasos: number; pasos: Paso[] };
type Programado = {
  id: string; secuencia_nombre: string | null; email: string; paso: number; asunto: string;
  enviar_en: string; estado: string; error: string | null;
};

const ESTADO_UI: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Programado", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  enviado:   { label: "Enviado",    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  fallido:   { label: "Falló",      cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  cancelado: { label: "Cancelado",  cls: "bg-muted text-muted-foreground border-border" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Props = {
  destinatarios: Recipient[];
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

export default function SecuenciasCorreo({ destinatarios, fromName, fromEmail, replyTo }: Props) {
  const { toast } = useToast();
  // Secuencias/programados no están en el types.ts generado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [secId, setSecId] = useState<string | null>(null);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [programados, setProgramados] = useState<Programado[]>([]);
  const [loading, setLoading] = useState(false);
  const [programando, setProgramando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const secActual = useMemo(() => secuencias.find((s) => s.id === secId) ?? null, [secuencias, secId]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: secs }, { data: progs }] = await Promise.all([
        sb.from("secuencias_correo").select("id, nombre, descripcion, total_pasos, pasos:secuencias_correo_pasos(*)").order("created_at"),
        sb.from("secuencia_envios_programados")
          .select("id, secuencia_nombre, email, paso, asunto, enviar_en, estado, error")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      const list = (secs ?? []) as Secuencia[];
      setSecuencias(list);
      if (list.length && !secId) setSecId(list[0].id);
      setProgramados((progs ?? []) as Programado[]);
    } catch (e) {
      toast({ title: "No se pudo cargar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Al elegir secuencia, copia los pasos a un estado editable (hora/asunto).
  useEffect(() => {
    const s = secuencias.find((x) => x.id === secId);
    if (!s) return;
    setPasos((s.pasos ?? []).map((p) => ({ ...p })));
    setFechaInicio(hoy());
  }, [secId, secuencias]);

  const setPaso = (i: number, patch: Partial<Paso>) =>
    setPasos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const programar = async () => {
    if (!secActual || !pasos.length || !destinatarios.length) return;
    setProgramando(true);
    try {
      const { data, error } = await supabase.functions.invoke("programar-secuencia", {
        body: {
          secuencia_id: secActual.id,
          fecha_inicio: fechaInicio,
          pasos: pasos.map((p) => ({ paso: p.paso, hora: p.hora_envio, asunto: p.asunto })),
          destinatarios,
          fromName,
          fromEmail,
          replyTo: replyTo.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: `${data.programados} correos programados`,
        description: `${data.contactos} contactos × ${data.pasos} pasos de "${data.secuencia}". Primer envío: ${fmt(data.primer_envio)}.`,
      });
      setConfirmOpen(false);
      cargar();
    } catch (e) {
      toast({ title: "No se pudo programar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setProgramando(false);
    }
  };

  const cancelar = async (id: string) => {
    const { error } = await sb.from("secuencia_envios_programados").update({ estado: "cancelado" }).eq("id", id);
    if (error) { toast({ title: "No se pudo cancelar", description: error.message, variant: "destructive" }); return; }
    setProgramados((prev) => prev.map((p) => (p.id === id ? { ...p, estado: "cancelado" } : p)));
    toast({ title: "Envío cancelado" });
  };

  const totalCorreos = pasos.length * destinatarios.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#003DA5]" /> Secuencia de correos · embudo con guías
          </span>
          <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Programa una secuencia automática de <strong>3 o 5 correos</strong> que regala una guía distinta en cada paso.
          Elige la plantilla, ajusta hora/asunto y la fecha de inicio; el resto se envía solo.
        </p>

        {destinatarios.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Agrega destinatarios en el paso 1 para poder programar una secuencia.
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
          </div>
        ) : secuencias.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Aún no hay plantillas de secuencia en la base de datos.
          </div>
        ) : (
          <>
            {/* Selector de plantilla */}
            <div className="grid gap-2 sm:grid-cols-2">
              {secuencias.map((s) => {
                const activo = s.id === secId;
                return (
                  <button
                    key={s.id} type="button"
                    onClick={() => setSecId(s.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      activo ? "border-[#003DA5] bg-[#003DA5]/5 ring-1 ring-[#003DA5]/40" : "hover:border-[#003DA5]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.nombre}</span>
                      <Badge variant="secondary">{s.total_pasos} correos</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.descripcion}</p>
                  </button>
                );
              })}
            </div>

            {/* Pasos editables */}
            {secActual && pasos.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha del primer correo</Label>
                    <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="h-9 w-44" />
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">
                    <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                    La hora se interpreta en horario de Chile. El sistema envía automáticamente cada 15 minutos.
                  </p>
                </div>

                {pasos.map((p, i) => (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Send className="h-3 w-3" /> Correo {p.paso} de {secActual.total_pasos}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CalendarClock className="h-3 w-3" /> Día {p.dias_desde_inicio === 0 ? "0 (hoy)" : `+${p.dias_desde_inicio}`}
                      </Badge>
                      {p.guia_titulo && (
                        <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                          <BookOpen className="h-3 w-3" /> {p.guia_titulo}
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                      <div className="space-y-1">
                        <Label className="text-xs">Hora</Label>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="time"
                            value={p.hora_envio}
                            onChange={(e) => setPaso(i, { hora_envio: e.target.value })}
                            className="h-9 pl-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Asunto</Label>
                        <Input value={p.asunto} onChange={(e) => setPaso(i, { asunto: e.target.value })} className="h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => setConfirmOpen(true)} disabled={programando || !destinatarios.length} className="gap-2 bg-[#003DA5] hover:bg-[#003DA5]/90">
                    {programando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    Programar secuencia ({destinatarios.length} contactos · {totalCorreos} correos)
                  </Button>
                  {programando && <span className="text-sm text-muted-foreground">Agendando…</span>}
                </div>
              </div>
            )}

            {/* Programaciones recientes */}
            {programados.length > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Programaciones recientes
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Destinatario</th>
                        <th className="hidden px-3 py-2 font-medium sm:table-cell">Secuencia</th>
                        <th className="px-3 py-2 font-medium">Envío</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="w-10 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {programados.slice(0, 15).map((p) => {
                        const ui = ESTADO_UI[p.estado] ?? ESTADO_UI.pendiente;
                        return (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-medium">{p.email}</div>
                              <div className="text-xs text-muted-foreground">Correo {p.paso} · {p.asunto}</div>
                            </td>
                            <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{p.secuencia_nombre}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{fmt(p.enviar_en)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.cls}`}>
                                {ui.label}
                                {p.estado === "fallido" && p.error && <AlertTriangle className="h-3 w-3" />}
                              </span>
                              {p.estado === "fallido" && p.error && (
                                <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-destructive" title={p.error}>{p.error}</div>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {p.estado === "pendiente" && (
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => cancelar(p.id)} aria-label="Cancelar">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Programar {totalCorreos} correos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviarán automáticamente {destinatarios.length} contactos × {pasos.length} correos de{" "}
              <strong>“{secActual?.nombre}”</strong> a partir del {fechaInicio}, a la hora configurada de cada paso
              (horario de Chile). Puedes cancelar envíos pendientes desde esta misma sección.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-[#003DA5] hover:bg-[#003DA5]/90" onClick={() => programar()}>
              Sí, programar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Loader2, RefreshCw, MessageCircle, Mail as MailIcon, MapPin,
  Video, Bot, ChevronLeft, ChevronRight, XCircle, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// calendario_agendamientos aún no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Cita = {
  id: string; lead_id: string;
  fecha_inicio: string; fecha_fin: string | null;
  estado: "agendada" | "modificada" | "cancelada";
  origen: string | null; meet_link: string | null;
  lead_nombre: string | null; lead_telefono: string | null; lead_email: string | null;
  lead_pais: string | null; lead_etapa: string | null; lead_origen: string | null;
  captado_ia: boolean;
  vendedor_id: string | null; vendedor: string | null; setter: string | null;
  es_mio: boolean;
};

const ESTADO_BADGE: Record<Cita["estado"], string> = {
  agendada: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  modificada: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  cancelada: "bg-muted text-muted-foreground border-border line-through",
};
const ESTADO_LABEL: Record<Cita["estado"], string> = {
  agendada: "Agendada", modificada: "Reagendada", cancelada: "Cancelada",
};

// Las reuniones se muestran siempre en hora de Santiago: es la zona con la
// que opera el equipo, y el lead puede estar en México, España o Colombia.
const TZ = "America/Santiago";
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const diaLargo = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const diaClave = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD, ordenable

export default function CalendarioAgendamientos({ titulo = "Agenda de reuniones", compacto = false }:
  { titulo?: string; compacto?: boolean }) {
  const { toast } = useToast();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  // Ventana en semanas desde hoy. 0 = desde hace 7 días y 30 hacia adelante.
  const [semana, setSemana] = useState(0);

  const rango = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const desde = new Date(base); desde.setDate(desde.getDate() - 7 + semana * 30);
    const hasta = new Date(base); hasta.setDate(hasta.getDate() + 30 + semana * 30);
    return { desde: desde.toISOString(), hasta: hasta.toISOString() };
  }, [semana]);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb.rpc("calendario_agendamientos", { _desde: rango.desde, _hasta: rango.hasta });
    if (error) toast({ title: "Error al cargar la agenda", description: error.message, variant: "destructive" });
    else setCitas((data ?? []) as Cita[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rango.desde]);

  // Agrupado por día en vez de rejilla mensual: en el móvil una rejilla de
  // 30 casillas no se lee, y lo que importa es "qué tengo hoy y mañana".
  const porDia = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citas) {
      const k = diaClave(c.fecha_inicio);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [citas]);

  const hoyClave = diaClave(new Date().toISOString());
  const vivas = citas.filter((c) => c.estado !== "cancelada").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-[#003DA5]" /> {titulo}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2" onClick={() => setSemana((s) => s - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Antes
            </Button>
            {semana !== 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setSemana(0)}>Hoy</Button>
            )}
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2" onClick={() => setSemana((s) => s + 1)}>
              Después <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={cargar} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {vivas} reunión(es) en pie · horas en Santiago de Chile. Las agenda el bot de WhatsApp al hablar con el lead.
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : porDia.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay reuniones en este rango.
          </p>
        ) : (
          <div className="space-y-4">
            {porDia.map(([dia, delDia]) => (
              <div key={dia}>
                <div className={`mb-1.5 text-xs font-semibold capitalize ${dia === hoyClave ? "text-[#003DA5]" : "text-muted-foreground"}`}>
                  {diaLargo(delDia[0].fecha_inicio)}{dia === hoyClave && " · hoy"}
                </div>
                <div className="space-y-1.5">
                  {delDia.map((c) => (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border p-2 ${c.estado === "cancelada" ? "opacity-60" : ""} ${c.es_mio ? "border-l-[3px] border-l-[#003DA5]" : ""}`}
                    >
                      <div className="w-12 shrink-0 font-mono text-sm font-semibold">{hora(c.fecha_inicio)}</div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{c.lead_nombre || "Lead sin nombre"}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_BADGE[c.estado]}`}>
                            {c.estado === "cancelada" && <XCircle className="mr-0.5 inline h-2.5 w-2.5" />}
                            {c.estado === "modificada" && <RotateCcw className="mr-0.5 inline h-2.5 w-2.5" />}
                            {ESTADO_LABEL[c.estado]}
                          </span>
                          {c.captado_ia && (
                            <Bot className="h-3 w-3 text-emerald-600" aria-label="captado por el sistema IA" />
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          {c.lead_telefono && (
                            <a
                              href={`https://wa.me/${c.lead_telefono.replace(/\D/g, "")}`}
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-0.5 hover:text-emerald-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="h-3 w-3" /> {c.lead_telefono}
                            </a>
                          )}
                          {c.lead_email && (
                            <span className="inline-flex items-center gap-0.5"><MailIcon className="h-3 w-3" /> {c.lead_email}</span>
                          )}
                          {c.lead_pais && (
                            <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {c.lead_pais}</span>
                          )}
                          {c.lead_etapa && <span>· {c.lead_etapa}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {c.meet_link && (
                          <a href={c.meet_link} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#003DA5] hover:underline">
                            <Video className="h-3 w-3" /> Meet
                          </a>
                        )}
                        {!compacto && (
                          <Badge variant="secondary" className="text-[10px]">
                            {c.vendedor || "sin asignar"}
                          </Badge>
                        )}
                        {!compacto && c.setter && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground" title="Quién lo calificó">
                            calificó {c.setter}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

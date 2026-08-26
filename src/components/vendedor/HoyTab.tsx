import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, MessageCircle, Phone, Mail as MailIcon, Instagram, Facebook, SkipForward,
  Eye, RefreshCw, PartyPopper, ChevronRight, Clock, Flame,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/lib/icebreakers";
import { fillTemplate } from "@/lib/fillTemplate";
import { conModificador, escribiendoEnCampo } from "@/lib/atajos";
import LeadDetalleDialog from "@/components/vendedor/LeadDetalleDialog";
import PasoRapido from "@/components/vendedor/PasoRapido";
import {
  ETAPA_LABEL, MOTIVO_INFO, tzNavegador,
  type ColaLead, type ColaResumen, type MotivoCola, type PlantillaEmail, type PlantillaWa, type RolVenta,
} from "@/components/vendedor/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const PLANTILLA_WA_KEY = "hoy:plantillaWa";

// Por que este lead esta en la cola, en una linea. Se muestra al pasar el
// mouse por encima del motivo: el vendedor no tiene que adivinar que
// significa "Sin plan" o "Traspasado".
const MOTIVO_AYUDA: Record<MotivoCola, string> = {
  reunion: "Tiene reunión agendada dentro de las próximas 24 horas",
  respondio: "Te respondió y todavía nadie le contestó",
  escalado: "La IA no pudo seguir y escaló la conversación a una persona",
  traspaso: "Te lo traspasaron ya calificado y todavía no lo tocaste",
  vencido: "El seguimiento que habías agendado ya pasó de fecha",
  hoy: "Vos mismo agendaste tocarlo hoy",
  nuevo: "Te lo asignaron y nunca lo contactaste",
  sin_plan: "Lo contactaste alguna vez y quedó sin próximo paso agendado",
};

/** Tecla dibujada como tecla: la leyenda de atajos se lee de un vistazo. */
function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

function waLink(l: ColaLead): string | null {
  const raw = (l.telefono || "").replace(/[^\d]/g, "");
  if (raw.length < 8) return null;
  return `https://wa.me/${normalizePhone(raw, l.pais)}`;
}

function horaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------
// Fila compacta de la cola: solo lo que hace falta para reconocer al lead
// y decidir si saltar a él. El trabajo de verdad pasa en la tarjeta de
// foco de arriba.
// ---------------------------------------------------------------------
function FilaCola({ lead, activo, onClick }: { lead: ColaLead; activo: boolean; onClick: () => void }) {
  const info = MOTIVO_INFO[lead.motivo];
  return (
    <button
      type="button" onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
        activo ? "border-[#003DA5] bg-[#003DA5]/5" : "border-transparent hover:bg-muted"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${info.punto}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{lead.nombre || "Sin nombre"}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{lead.motivo_texto}</span>
      </span>
      {activo && <ChevronRight className="h-4 w-4 shrink-0 text-[#003DA5]" />}
    </button>
  );
}

export default function HoyTab({ plantillasWa, plantillasEmail, onCambio }: {
  plantillasWa: PlantillaWa[];
  plantillasEmail: PlantillaEmail[];
  /** Refresca los KPIs de la página cuando la cola avanza. */
  onCambio?: () => void;
}) {
  const { toast } = useToast();
  const [cola, setCola] = useState<ColaLead[]>([]);
  const [resumen, setResumen] = useState<ColaResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [filtro, setFiltro] = useState<MotivoCola | "todos">("todos");
  const [hechos, setHechos] = useState(0);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [miRol, setMiRol] = useState<RolVenta | undefined>(undefined);
  const [miNombre, setMiNombre] = useState<string | null>(null);
  const [canalUsado, setCanalUsado] = useState<string | undefined>(undefined);
  const [waPlantillaId, setWaPlantillaId] = useState<string>(() => localStorage.getItem(PLANTILLA_WA_KEY) ?? "");

  const tz = useMemo(() => tzNavegador(), []);

  const cargar = useCallback(async (mantenerPosicion = false) => {
    setLoading(true);
    const [{ data: filas, error }, { data: res }] = await Promise.all([
      sb.rpc("vendedor_cola_hoy", { _tz: tz, _limite: 100 }),
      sb.rpc("vendedor_cola_resumen", { _tz: tz }),
    ]);
    if (error) toast({ title: "No se pudo cargar la cola", description: error.message, variant: "destructive" });
    setCola((filas ?? []) as ColaLead[]);
    setResumen((res ?? [])[0] ?? null);
    if (!mantenerPosicion) setIdx(0);
    setLoading(false);
  }, [tz, toast]);

  useEffect(() => {
    cargar();
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (!u?.user) return;
      const { data } = await supabase.from("vendedores").select("rol_venta, nombre_display").eq("user_id", u.user.id).maybeSingle();
      setMiRol((data?.rol_venta as RolVenta | undefined) ?? undefined);
      setMiNombre((data?.nombre_display as string | undefined) ?? null);
    });
  }, [cargar]);

  const visibles = useMemo(
    () => (filtro === "todos" ? cola : cola.filter((l) => l.motivo === filtro)),
    [cola, filtro],
  );
  // Al resolver el último lead de la lista el índice queda fuera de rango y
  // la pantalla diría "no queda nada" con leads todavía en la cola.
  useEffect(() => {
    if (idx > 0 && idx >= visibles.length) setIdx(Math.max(0, visibles.length - 1));
  }, [visibles.length, idx]);

  const actual: ColaLead | undefined = visibles[idx];

  // El lead resuelto sale de la cola en el acto: la lista no espera al
  // servidor para dejar de mostrar trabajo que ya está hecho.
  const sacarDeCola = (leadId: string) => {
    setCola((prev) => prev.filter((l) => l.id !== leadId));
    setHechos((n) => n + 1);
    setResumen((r) => (r ? { ...r, total: Math.max(0, r.total - 1) } : r));
    setCanalUsado(undefined);
    onCambio?.();
  };

  const saltar = () => {
    setCanalUsado(undefined);
    setIdx((i) => (i + 1 < visibles.length ? i + 1 : 0));
  };

  const plantillaWa = plantillasWa.find((p) => p.id === waPlantillaId);

  const abrirWhatsapp = async (lead: ColaLead) => {
    const link = waLink(lead);
    if (!link) { toast({ title: "Ese lead no tiene un teléfono marcable", variant: "destructive" }); return; }
    const msg = plantillaWa
      ? fillTemplate(plantillaWa.contenido, { nombre: lead.nombre || undefined, pais: lead.pais || undefined })
      : "";
    window.open(msg ? `${link}?text=${encodeURIComponent(msg)}` : link, "_blank", "noreferrer");
    setCanalUsado("whatsapp");
  };

  const abrirCorreo = (lead: ColaLead) => {
    if (!lead.email) { toast({ title: "Ese lead no tiene correo", variant: "destructive" }); return; }
    const plantilla: PlantillaEmail | undefined = plantillasEmail[0];
    const asunto = plantilla?.asunto ?? "";
    const cuerpo = plantilla?.cuerpo_text ?? "";
    window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
      fillTemplate(asunto, { nombre: lead.nombre || undefined }),
    )}&body=${encodeURIComponent(fillTemplate(cuerpo, { nombre: lead.nombre || undefined }))}`;
    setCanalUsado("email");
  };

  const llamar = (lead: ColaLead) => {
    if (!lead.telefono) { toast({ title: "Ese lead no tiene teléfono", variant: "destructive" }); return; }
    window.location.href = `tel:${normalizePhone(lead.telefono.replace(/[^\d]/g, ""), lead.pais)}`;
    setCanalUsado("llamada");
  };

  // Atajos: el vendedor no suelta el teclado entre lead y lead.
  // Las teclas de una letra se ignoran mientras escribe una nota.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!actual || conModificador(e) || escribiendoEnCampo(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "w") { e.preventDefault(); abrirWhatsapp(actual); }
      else if (k === "l") { e.preventDefault(); llamar(actual); }
      else if (k === "c") { e.preventDefault(); abrirCorreo(actual); }
      else if (k === "f") { e.preventDefault(); setDetalleId(actual.id); }
      else if (k === "s") { e.preventDefault(); saltar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Armando tu cola de hoy…
      </div>
    );
  }

  // Cada filtro lleva su explicacion en el title: "Sin plan" o "Sin tocar"
  // no dicen nada por si solos la primera vez que se ven.
  const chips: { clave: MotivoCola | "todos"; label: string; n: number; ayuda: string }[] = [
    { clave: "todos", label: "Todo", n: cola.length, ayuda: "Todos los leads que piden atención hoy" },
    { clave: "reunion", label: "Reuniones", n: resumen?.reuniones ?? 0, ayuda: "Tienen reunión agendada dentro de las próximas 24 horas" },
    { clave: "respondio", label: "Respondieron", n: resumen?.respuestas ?? 0, ayuda: "Te escribieron o la IA escaló la conversación, y nadie les respondió todavía" },
    { clave: "vencido", label: "Vencidos", n: resumen?.vencidos ?? 0, ayuda: "El seguimiento que habías agendado ya pasó de fecha" },
    { clave: "nuevo", label: "Sin tocar", n: resumen?.nuevos ?? 0, ayuda: "Te los asignaron y todavía no los contactaste ni una vez" },
    { clave: "sin_plan", label: "Sin plan", n: resumen?.sin_plan ?? 0, ayuda: "Los contactaste alguna vez y quedaron sin próximo paso: son los que se pierden" },
  ];

  return (
    <div className="space-y-4">
      {/* Encabezado: cuánto queda y qué es urgente de verdad. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#003DA5]/10 text-[#003DA5]">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {cola.length === 0 ? "Cola vacía" : `${cola.length} lead(s) piden atención`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {resumen && resumen.urgentes > 0
                ? `${resumen.urgentes} con alguien esperando respuesta`
                : "Ninguno urgente: vas al día"}
              {hechos > 0 && ` · ${hechos} resuelto(s) en esta sesión`}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => cargar()} className="ml-auto gap-1.5">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1 px-1">
          {chips.map((c) => (
            <button
              key={c.clave} type="button" title={c.ayuda}
              onClick={() => { setFiltro(c.clave); setIdx(0); }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filtro === c.clave ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-[10px] ${filtro === c.clave ? "bg-white/20" : "bg-muted"}`}>{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {!actual ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <PartyPopper className="h-8 w-8 text-emerald-600" />
            <p className="font-medium">
              {cola.length === 0 ? "No queda nada pendiente" : "Nada pendiente en este filtro"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Cuando un lead responda, venza un seguimiento o te asignen leads nuevos, van a aparecer acá solos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* ---------- Tarjeta de foco: un lead a la vez ---------- */}
          <Card className="border-l-4" style={{ borderLeftColor: "#003DA5" }}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{actual.nombre || "Sin nombre"}</h3>
                    <span
                      title={MOTIVO_AYUDA[actual.motivo]}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${MOTIVO_INFO[actual.motivo].badge}`}
                    >
                      {MOTIVO_INFO[actual.motivo].label}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {ETAPA_LABEL[actual.etapa_venta] ?? actual.etapa_venta}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{actual.motivo_texto}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {idx + 1} de {visibles.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {actual.telefono && <span>{actual.telefono}</span>}
                {actual.email && <span className="truncate">{actual.email}</span>}
                {actual.pais && <span>{actual.pais}</span>}
                {actual.ultimo_contacto_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Último toque {horaCorta(actual.ultimo_contacto_at)}
                  </span>
                )}
              </div>

              {(actual.resumen_ia || actual.notas_vendedor) && (
                <div className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                  {actual.resumen_ia && <p><span className="font-medium">Contexto IA:</span> {actual.resumen_ia}</p>}
                  {actual.notas_vendedor && (
                    <p className="whitespace-pre-line text-muted-foreground">
                      <span className="font-medium text-foreground">Tus notas:</span> {actual.notas_vendedor}
                    </p>
                  )}
                </div>
              )}

              {/* Canales. Abrir el canal NO cierra el paso: el desenlace lo
                  elige el vendedor abajo, porque WhatsApp puede quedar sin
                  respuesta y eso también es información. */}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => abrirWhatsapp(actual)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => llamar(actual)} className="gap-1.5">
                  <Phone className="h-4 w-4" /> Llamar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => abrirCorreo(actual)} className="gap-1.5">
                  <MailIcon className="h-4 w-4" /> Correo
                </Button>
                {actual.instagram && (
                  <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
                    <a href={actual.instagram} target="_blank" rel="noreferrer" onClick={() => setCanalUsado("instagram")}>
                      <Instagram className="h-4 w-4" /> Instagram
                    </a>
                  </Button>
                )}
                {actual.facebook && (
                  <Button type="button" size="sm" variant="outline" asChild className="gap-1.5">
                    <a href={actual.facebook} target="_blank" rel="noreferrer" onClick={() => setCanalUsado("facebook")}>
                      <Facebook className="h-4 w-4" /> Facebook
                    </a>
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => setDetalleId(actual.id)} className="gap-1.5">
                  <Eye className="h-4 w-4" /> Ficha
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={saltar} className="gap-1.5 text-muted-foreground">
                  <SkipForward className="h-4 w-4" /> Saltar
                </Button>
              </div>

              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Atajos: <Tecla>W</Tecla> WhatsApp · <Tecla>L</Tecla> llamar · <Tecla>C</Tecla> correo ·
                {" "}<Tecla>F</Tecla> ficha · <Tecla>S</Tecla> saltar · <Tecla>1</Tecla>–<Tecla>4</Tecla> qué pasó ·
                {" "}<Tecla>Enter</Tecla> guardar y siguiente
              </p>

              {plantillasWa.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Plantilla WhatsApp:</span>
                  <Select
                    value={waPlantillaId}
                    onValueChange={(v) => { setWaPlantillaId(v); localStorage.setItem(PLANTILLA_WA_KEY, v); }}
                  >
                    <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue placeholder="Sin plantilla (chat vacío)" /></SelectTrigger>
                    <SelectContent>
                      {plantillasWa.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <PasoRapido
                lead={actual} miRol={miRol} canalSugerido={canalUsado}
                onListo={({ proximo }) => {
                  sacarDeCola(actual.id);
                  toast({
                    title: "Paso guardado",
                    description: proximo
                      ? `Próximo toque: ${horaCorta(proximo)}`
                      : "Lead cerrado: sale de la cola.",
                  });
                }}
              />
            </CardContent>
          </Card>

          {/* ---------- Lo que viene después ---------- */}
          <div className="space-y-1">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Siguientes en la cola
            </p>
            <div className="max-h-[520px] space-y-0.5 overflow-y-auto pr-1">
              {visibles.slice(0, 40).map((l, i) => (
                <FilaCola key={l.id} lead={l} activo={i === idx} onClick={() => { setIdx(i); setCanalUsado(undefined); }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <LeadDetalleDialog
        leadId={detalleId} open={!!detalleId} onOpenChange={(o) => !o && setDetalleId(null)}
        plantillasWa={plantillasWa} plantillasEmail={plantillasEmail}
        miRol={miRol} vendedorNombre={miNombre}
        onCambio={() => cargar(true)}
      />
    </div>
  );
}

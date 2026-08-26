import { useEffect, useState } from "react";
import { Loader2, CalendarClock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ETAPAS_PERMITIDAS, ETAPA_LABEL, type ColaLead, type Etapa, type RolVenta } from "@/components/vendedor/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ---------------------------------------------------------------------
// Cierre del toque en un solo gesto.
//
// El vendedor acaba de hablar con el lead. Antes eso eran cuatro clics en
// dos pantallas (registrar contacto, mover etapa, agendar el próximo
// toque, anotar) y el que más se olvidaba era el próximo toque -- justo
// el que evita que el lead se pierda. Acá los cuatro salen de un desenlace
// y un botón: elegir "No contestó" ya implica etapa, fecha y registro.
// ---------------------------------------------------------------------

type Desenlace = {
  clave: string;
  label: string;
  /** Resultado que queda en contactos_log. */
  resultado: string;
  /** Días hasta el próximo toque. null = pide fecha exacta. */
  dias: number | null;
  /** Etapa sugerida; se aplica solo si el rol la tiene permitida. */
  etapa?: Etapa;
  /** Etapa de respaldo cuando el rol no puede asignar la sugerida.
   *  Un setter que cierra una reunion no puede mover a "demo", pero si a
   *  "interesado" -- que es justo lo que dispara el traspaso al closer. */
  etapaAlt?: Etapa;
  /** El desenlace fija una reunion: la fecha entra en agendamientos. */
  esReunion?: boolean;
  /** El motivo es obligatorio (cierre perdido). */
  pideNota?: boolean;
};

const DESENLACES: Desenlace[] = [
  { clave: "contesto",    label: "Contestó",      resultado: "contesto",     dias: 1, etapa: "interesado" },
  { clave: "sin_respuesta", label: "No contestó", resultado: "sin_respuesta", dias: 2, etapa: "contactado" },
  { clave: "agendo",      label: "Agendó reunión", resultado: "agendo",      dias: null, etapa: "demo", etapaAlt: "interesado", esReunion: true },
  { clave: "no_interesa", label: "No le interesa", resultado: "no_interesa", dias: 0, etapa: "perdido", pideNota: true },
];

const CANALES: { valor: string; label: string }[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "llamada", label: "Llamada" },
  { valor: "email", label: "Correo" },
  { valor: "instagram", label: "Instagram" },
  { valor: "nota", label: "Solo anotar" },
];

function enDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  // El próximo toque cae a media mañana: una fecha sin hora hace que el
  // lead aparezca en la cola a medianoche y ensucie el orden.
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** Valor para <input type="datetime-local"> a partir de ahora + horas. */
function localInput(horas: number): string {
  const d = new Date(Date.now() + horas * 3600000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function PasoRapido({ lead, miRol, canalSugerido, onListo }: {
  lead: ColaLead;
  miRol?: RolVenta;
  /** Canal que el vendedor acaba de usar desde la tarjeta (abrió WhatsApp, marcó, etc.). */
  canalSugerido?: string;
  /** Se llama cuando el paso quedó guardado: la cola avanza al siguiente. */
  onListo: (info: { etapa: string; proximo: string | null }) => void;
}) {
  const { toast } = useToast();
  const [desenlace, setDesenlace] = useState<string | null>(null);
  const [canal, setCanal] = useState(canalSugerido ?? "whatsapp");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(localInput(24));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Cambió el lead: el formulario arranca limpio, sin arrastrar la nota
    // del anterior (un error caro: queda escrita en la ficha equivocada).
    setDesenlace(null);
    setNota("");
    setFecha(localInput(24));
  }, [lead.id]);

  useEffect(() => { if (canalSugerido) setCanal(canalSugerido); }, [canalSugerido]);

  const elegido = DESENLACES.find((d) => d.clave === desenlace) ?? null;
  const pideFecha = elegido?.dias === null;
  // Etapa a la que va a quedar el lead con este desenlace, ya filtrada por
  // lo que el rol puede asignar. Se muestra antes de guardar: nadie mueve
  // un lead sin saber a donde.
  const permitidasRol = miRol ? ETAPAS_PERMITIDAS[miRol] : [];
  const etapaDestino: Etapa | null = !elegido
    ? null
    : elegido.etapa && permitidasRol.includes(elegido.etapa) && elegido.etapa !== lead.etapa_venta
      ? elegido.etapa
      : elegido.etapaAlt && permitidasRol.includes(elegido.etapaAlt) && elegido.etapaAlt !== lead.etapa_venta
        ? elegido.etapaAlt
        : null;
  const faltaNota = !!elegido?.pideNota && nota.trim().length === 0;

  const guardar = async () => {
    if (!elegido || guardando) return;
    if (faltaNota) {
      toast({ title: "Escribe el motivo", description: "Un lead perdido sin motivo no sirve para aprender.", variant: "destructive" });
      return;
    }
    setGuardando(true);
    // La etapa sugerida solo se manda si el rol puede asignarla; si no, el
    // lead se queda donde está y el paso igual se registra.
    const permitidas = miRol ? ETAPAS_PERMITIDAS[miRol] : [];
    const candidata = elegido.etapa && permitidas.includes(elegido.etapa)
      ? elegido.etapa
      : elegido.etapaAlt && permitidas.includes(elegido.etapaAlt)
        ? elegido.etapaAlt
        : null;
    const etapa = candidata && candidata !== lead.etapa_venta ? candidata : null;
    const reunionAt = elegido.esReunion ? new Date(fecha).toISOString() : null;
    const { data, error } = await sb.rpc("vendedor_registrar_paso", {
      _lead_id: lead.id,
      _canal: canal,
      _resultado: elegido.resultado,
      _nota: nota.trim() || null,
      _proximo_at: pideFecha ? new Date(fecha).toISOString() : elegido.dias !== null ? enDias(elegido.dias) : null,
      _dias: null,
      _etapa: etapa,
      _mensaje: null,
      _plantilla_id: null,
      _reunion_at: reunionAt,
    });
    setGuardando(false);
    if (error) {
      toast({ title: "No se pudo guardar el paso", description: error.message, variant: "destructive" });
      return;
    }
    const mov = data?.movimiento;
    if (mov?.traspasado) {
      toast({ title: "Lead traspasado", description: `Lo sigue ${mov.closer_nombre ?? "un closer"}. Ya no está en tu cola.` });
    }
    onListo({ etapa: data?.etapa ?? lead.etapa_venta, proximo: data?.proximo_contacto ?? null });
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Qué pasó?</span>
        {DESENLACES.map((d) => (
          <Button
            key={d.clave} type="button" size="sm"
            variant={desenlace === d.clave ? "default" : "outline"}
            className={desenlace === d.clave ? "bg-[#003DA5] hover:bg-[#003DA5]/90" : ""}
            onClick={() => setDesenlace(d.clave)}
          >
            {d.label}
          </Button>
        ))}
      </div>

      {elegido && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Canal:</span>
            {CANALES.map((c) => (
              <button
                key={c.valor} type="button" onClick={() => setCanal(c.valor)}
                className={`rounded-full border px-2.5 py-1 transition ${
                  canal === c.valor ? "border-[#003DA5] bg-[#003DA5]/10 text-[#003DA5]" : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {pideFecha ? (
            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="h-9 w-auto"
              />
              <span className="text-xs text-muted-foreground">Fecha y hora de la reunión.</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {elegido.dias === 0
                ? "Se cierra el lead: no vuelve a la cola."
                : `Próximo toque: en ${elegido.dias} día${elegido.dias === 1 ? "" : "s"}.`}
              {etapaDestino && (
                <> Pasa a <span className="font-medium text-foreground">{ETAPA_LABEL[etapaDestino]}</span>.</>
              )}
            </p>
          )}

          <Textarea
            value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder={elegido.pideNota ? "Motivo (obligatorio): precio, ya trabaja con otro, no es el momento…" : "Nota rápida (opcional)"}
            rows={2} className="text-sm"
          />

          <Button
            type="button" onClick={guardar} disabled={guardando || faltaNota}
            className="w-full gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90 sm:w-auto"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar y siguiente
          </Button>
        </>
      )}
    </div>
  );
}

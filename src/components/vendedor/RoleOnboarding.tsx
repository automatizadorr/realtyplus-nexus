import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, UserPlus, Handshake, MessageCircle, CalendarClock, FileText,
  Trophy, Target, Zap, ChevronRight, ChevronLeft, Inbox, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RolVenta } from "@/components/vendedor/types";

// ---------------------------------------------------------------------
// Contenido por rol. Cada paso enseña una pantalla/gesto real de la app
// (Hoy, "¿Qué pasó?", Pipeline, Mis Plantillas) con su nombre exacto.
// ---------------------------------------------------------------------
type Paso = { eyebrow: string; titulo: string; cuerpo: string; icon: React.ElementType };

const PASOS: Record<RolVenta, Paso[]> = {
  setter: [
    {
      eyebrow: "Tu parte del proceso",
      titulo: "Vos abrís la puerta.",
      cuerpo: "Trabajás los leads nuevos: los contactás primero, calificás si hay interés real y los dejás listos para que el closer cierre.",
      icon: UserPlus,
    },
    {
      eyebrow: "Por dónde empezar",
      titulo: "Abrí Hoy y trabajá de arriba hacia abajo",
      cuerpo: "Hoy arma sola tu lista de trabajo y la ordena por urgencia: primero el que respondió o tiene reunión, después los seguimientos vencidos, y al final los que nunca contactaste. Te muestra un lead a la vez con sus botones de WhatsApp, llamada y correo. No tenés que decidir a quién tocar: ya está decidido.",
      icon: Flame,
    },
    {
      eyebrow: "Después de cada toque",
      titulo: "Contestá \"¿Qué pasó?\" y listo",
      cuerpo: "Abajo del lead elegís el desenlace — Contestó, No contestó, Agendó reunión o No le interesa — y con un botón queda todo hecho: el contacto registrado, la etapa movida y el próximo toque agendado. Después salta solo al siguiente lead.",
      icon: Zap,
    },
    {
      eyebrow: "Cuándo pasás la posta",
      titulo: "De Interesado en adelante, es del closer",
      cuerpo: "Cuando un lead confirma interés real o agenda reunión, pasa a Interesado y el closer lo toma automáticamente (vos lo seguís viendo en solo lectura). Si no es buen fit, elegí No le interesa y escribí el motivo. Tus mensajes propios los guardás en Más → Mis Plantillas.",
      icon: Handshake,
    },
  ],
  closer: [
    {
      eyebrow: "Tu parte del proceso",
      titulo: "A vos te toca cerrar.",
      cuerpo: "Recibís los leads que ya mostraron interés real — el setter los calificó, o Camil-AI los entregó directo — y los llevás hasta la venta.",
      icon: Trophy,
    },
    {
      eyebrow: "Por dónde empezar",
      titulo: "Abrí Hoy: lo urgente está arriba",
      cuerpo: "Hoy ordena tu día solo: primero las reuniones de las próximas 24 h, después los que respondieron y esperan, después los leads que te acaban de traspasar sin tocar, y recién ahí los seguimientos vencidos. Un lead a la vez, con sus botones de contacto.",
      icon: Flame,
    },
    {
      eyebrow: "Después de cada toque",
      titulo: "Contestá \"¿Qué pasó?\" y listo",
      cuerpo: "Elegís el desenlace y un botón deja todo hecho: contacto registrado, etapa movida y próximo toque agendado. Si marcás Agendó reunión, ponés fecha y hora y la reunión aparece sola en tu Agenda.",
      icon: Zap,
    },
    {
      eyebrow: "Al cerrar",
      titulo: "Ganado, Perdido, y tu ranking",
      cuerpo: "El cierre lo hacés desde el Pipeline: arrastrá a Ganado si vendiste, o a Perdido si se cayó (te va a pedir el motivo — ayuda a entender por qué se pierden ventas). Arriba vas a ver tus KPIs y tu puesto frente a los demás.",
      icon: Target,
    },
  ],
  ambos: [
    {
      eyebrow: "Tu parte del proceso",
      titulo: "Hacés las dos partes.",
      cuerpo: "Contactás al lead desde el primer mensaje y lo llevás vos mismo hasta el cierre, sin pasárselo a nadie.",
      icon: Zap,
    },
    {
      eyebrow: "Por dónde empezar",
      titulo: "Abrí Hoy y trabajá de arriba hacia abajo",
      cuerpo: "Hoy arma tu lista sola y la ordena por urgencia: reuniones, los que respondieron, los seguimientos vencidos y los que nunca contactaste. Un lead a la vez, con WhatsApp, llamada y correo a un clic. El Pipeline queda para mirar el embudo completo, no para buscar a quién tocar.",
      icon: Flame,
    },
    {
      eyebrow: "Después de cada toque",
      titulo: "Contestá \"¿Qué pasó?\" y listo",
      cuerpo: "Elegís el desenlace — Contestó, No contestó, Agendó reunión, No le interesa — y con un botón queda el contacto registrado, la etapa movida y el próximo toque agendado. Después salta solo al siguiente lead.",
      icon: Handshake,
    },
    {
      eyebrow: "De punta a punta",
      titulo: "Ningún lead se queda sin próximo paso",
      cuerpo: "Cada lead vivo tiene siempre una fecha de próximo toque: si no la elegís vos, la pone el sistema. Los que igual quedaron sin plan te aparecen en Hoy marcados \"Sin plan\" — esa es la lista de los que antes se perdían. Cerrás en Ganado o Perdido desde el Pipeline.",
      icon: CalendarClock,
    },
  ],
};

const CTA_FINAL: Record<RolVenta, string> = {
  setter: "Entendido, a contactar",
  closer: "Entendido, a cerrar",
  ambos: "Entendido, a vender",
};

const ROL_LABEL: Record<RolVenta, string> = { setter: "Setter", closer: "Closer", ambos: "Setter + Closer" };

const COLOR: Record<RolVenta, { texto: string; bg: string; solido: string; hover: string }> = {
  setter: { texto: "text-blue-600", bg: "bg-blue-600/10", solido: "bg-blue-600", hover: "hover:bg-blue-700" },
  closer: { texto: "text-violet-600", bg: "bg-violet-600/10", solido: "bg-violet-600", hover: "hover:bg-violet-700" },
  ambos: { texto: "text-emerald-600", bg: "bg-emerald-600/10", solido: "bg-emerald-600", hover: "hover:bg-emerald-700" },
};

const ETAPAS_VISUAL = [
  { id: "hoy", label: "Hoy" },
  { id: "contactado", label: "Contactado" },
  { id: "interesado", label: "Interesado" },
  { id: "demo", label: "Demo" },
  { id: "ganado", label: "Ganado" },
] as const;

// Zona de cada rol dentro de la secuencia real (ver vendedor_mover_etapa).
// "Hoy" no es una etapa: es la cola de trabajo por la que pasa todo el mundo
// antes de mover nada, así que está encendida para los tres roles.
const ZONA: Record<RolVenta, Set<string>> = {
  setter: new Set(["hoy", "contactado", "interesado"]),
  closer: new Set(["hoy", "interesado", "demo", "ganado"]),
  ambos: new Set(["hoy", "contactado", "interesado", "demo", "ganado"]),
};

const ZONA_TEXTO: Record<RolVenta, string> = {
  setter: "Tu tramo termina en Interesado — ahí entra el closer.",
  closer: "Tu tramo empieza en Interesado — ahí te lo entregan (setter o Camil-AI).",
  ambos: "Trabajás el tramo completo, de punta a punta.",
};

function RelayTrack({ rol }: { rol: RolVenta }) {
  const miZona = ZONA[rol];
  const c = COLOR[rol];

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-border sm:left-5 sm:right-5" />
        {ETAPAS_VISUAL.map((e) => {
          const activa = miZona.has(e.id);
          return (
            <div key={e.id} className="relative z-10 flex flex-col items-center gap-1">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-bold sm:h-10 sm:w-10 ${
                  activa ? `${c.solido} border-transparent text-white` : "border-border bg-background text-muted-foreground"
                }`}
              >
                {e.id === "interesado" ? <Handshake className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                {e.id === "hoy" ? <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
              </div>
              <span className={`w-14 text-center text-[9px] leading-tight sm:w-16 sm:text-[10px] ${activa ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {e.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">{ZONA_TEXTO[rol]}</p>
    </div>
  );
}

export default function RoleOnboarding({ rol, open, onClose }: { rol: RolVenta; open: boolean; onClose: () => void }) {
  const [paso, setPaso] = useState(0);
  const pasos = PASOS[rol];
  const esUltimo = paso === pasos.length - 1;
  const actual = pasos[paso];
  const Icon = actual.icon;
  const c = COLOR[rol];

  useEffect(() => { if (open) setPaso(0); }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex h-full w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${c.bg} ${c.texto}`}>
              Onboarding · {ROL_LABEL[rol]}
            </span>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            {paso === 0 && (
              <div className="mb-6">
                <RelayTrack rol={rol} />
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={paso}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${c.bg} ${c.texto}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${c.texto}`}>{actual.eyebrow}</p>
                <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{actual.titulo}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{actual.cuerpo}</p>
              </motion.div>
            </AnimatePresence>

            {/* Paso 1 = "Hoy": los motivos por los que un lead entra en la cola. */}
            {paso === 1 && (
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  { icon: CalendarClock, label: "Reunión < 24 h" },
                  { icon: MessageCircle, label: "Respondió y espera" },
                  { icon: Flame, label: "Seguimiento vencido" },
                ].map(({ icon: I, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                    <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {label}
                  </div>
                ))}
              </div>
            )}
            {/* Paso 2 = "¿Qué pasó?": lo que deja hecho ese único botón. */}
            {paso === 2 && (
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  { icon: MessageCircle, label: "Registra el contacto" },
                  { icon: Handshake, label: "Mueve la etapa" },
                  { icon: CalendarClock, label: "Agenda el próximo toque" },
                ].map(({ icon: I, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                    <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {label}
                  </div>
                ))}
              </div>
            )}
            {paso === 3 && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> Más → Mis Plantillas: creá y guardá tus propios mensajes
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> Más → Bandeja: solo para mandar la misma plantilla a muchos leads de golpe
                </div>
              </div>
            )}
          </div>

          {/* Footer / navegación */}
          <div className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <div className="flex gap-1.5">
              {pasos.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === paso ? `w-5 ${c.solido}` : "w-1.5 bg-border"}`} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {paso > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPaso((p) => p - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Atrás
                </Button>
              )}
              <Button
                type="button" size="sm"
                onClick={() => (esUltimo ? onClose() : setPaso((p) => p + 1))}
                className={`gap-1 text-white ${c.solido} ${c.hover}`}
              >
                {esUltimo ? CTA_FINAL[rol] : "Siguiente"}
                {!esUltimo && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------
// Persistencia: se muestra solo, una vez, por usuario+rol. "Ver tutorial"
// en Mis Leads lo puede reabrir en cualquier momento.
// ---------------------------------------------------------------------
export function useRoleOnboarding(userId: string | undefined, rol: RolVenta | undefined) {
  const [open, setOpen] = useState(false);
  // v2: la app pasó de "Bandeja primero" a la cola de Hoy. Quien ya había
  // cerrado el tutorial viejo tiene que ver el nuevo igual, así que la clave
  // cambia de nombre en vez de reutilizarse.
  const key = userId && rol ? `onboarding_v2_${rol}_${userId}` : null;

  useEffect(() => {
    if (!key) return;
    if (!localStorage.getItem(key)) setOpen(true);
  }, [key]);

  const close = () => {
    if (key) localStorage.setItem(key, "1");
    setOpen(false);
  };
  const reopen = () => setOpen(true);

  return { open, close, reopen };
}

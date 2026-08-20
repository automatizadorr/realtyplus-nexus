import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, UserPlus, Handshake, MessageCircle, AlarmClock, CalendarClock, FileText,
  Trophy, Kanban, Target, ChevronRight, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RolEquipo } from "@/components/vendedor/types";

// ---------------------------------------------------------------------
// Contenido por rol. Cada paso enseña una pantalla/gesto real de la app
// (Pipeline, Solo hoy, Contactar, Mis Plantillas) con su nombre exacto.
// ---------------------------------------------------------------------
type Paso = { eyebrow: string; titulo: string; cuerpo: string; icon: React.ElementType };

const PASOS: Record<RolEquipo, Paso[]> = {
  setter: [
    {
      eyebrow: "Tu lugar en el equipo",
      titulo: "Vos abrís la puerta.",
      cuerpo: "Trabajás los leads nuevos: los contactás primero, calificás si hay interés real y los dejás listos para que el closer cierre.",
      icon: UserPlus,
    },
    {
      eyebrow: "Tu día a día",
      titulo: "Pipeline y contacto",
      cuerpo: "En Pipeline arrastrás cada lead a la etapa que corresponde. El badge rojo \"Sin contactar hace Xh\" marca a quién priorizar, y el filtro \"Solo hoy\" te muestra solo lo urgente. Para escribirle, tocá Contactar: elegís una plantilla, la revisás y recién ahí se envía.",
      icon: Kanban,
    },
    {
      eyebrow: "Cuándo pasás la posta",
      titulo: "De Interesado en adelante, es del closer",
      cuerpo: "Cuando un lead confirma interés real, movelo a Interesado — ahí lo toma el closer de tu equipo. Si no es un buen fit, movelo a Perdido (te va a pedir el motivo). Podés crear tus propias plantillas en Mis Plantillas.",
      icon: Handshake,
    },
  ],
  closer: [
    {
      eyebrow: "Tu lugar en el equipo",
      titulo: "A vos te toca cerrar.",
      cuerpo: "Recibís los leads que ya mostraron interés real — el setter los calificó, o Camil-AI los entregó directo — y los llevás hasta la venta.",
      icon: Trophy,
    },
    {
      eyebrow: "Tu día a día",
      titulo: "Pipeline y contacto",
      cuerpo: "Tus leads aparecen en Interesado. Arrastralos a Demo cuando agendes la reunión, y a Ganado o Perdido al resolver. Para escribirles, tocá Contactar: misma lógica que el setter, elegís plantilla, revisás y enviás.",
      icon: Kanban,
    },
    {
      eyebrow: "Al cerrar",
      titulo: "Ganado, Perdido, y tu ranking",
      cuerpo: "Si cerrás la venta, movelo a Ganado. Si se cae, a Perdido — te va a pedir el motivo (ayuda a entender por qué se pierden ventas). Arriba de tu Pipeline vas a ver tus KPIs y el puesto de tu equipo frente a los demás.",
      icon: Target,
    },
  ],
};

const CTA_FINAL: Record<RolEquipo, string> = {
  setter: "Entendido, a contactar",
  closer: "Entendido, a cerrar",
};

const ETAPAS_VISUAL = [
  { id: "nuevo", label: "Nuevo" },
  { id: "contactado", label: "Contactado" },
  { id: "interesado", label: "Interesado" },
  { id: "demo", label: "Demo" },
  { id: "ganado", label: "Ganado" },
] as const;

// Zona de cada rol dentro de la secuencia real del pipeline (ver vendedor_mover_etapa).
const ZONA: Record<RolEquipo, Set<string>> = {
  setter: new Set(["nuevo", "contactado", "interesado"]),
  closer: new Set(["interesado", "demo", "ganado"]),
};

function RelayTrack({ rol }: { rol: RolEquipo }) {
  const miZona = ZONA[rol];
  const colorActivo = rol === "setter" ? "bg-blue-600 border-blue-600 text-white" : "bg-violet-600 border-violet-600 text-white";
  const colorLinea = rol === "setter" ? "bg-blue-600" : "bg-violet-600";

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
                  activa ? colorActivo : "border-border bg-background text-muted-foreground"
                }`}
              >
                {e.id === "interesado" ? <Handshake className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
              </div>
              <span className={`w-14 text-center text-[9px] leading-tight sm:w-16 sm:text-[10px] ${activa ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {e.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {rol === "setter"
          ? "Tu tramo termina en Interesado — ahí entra el closer."
          : "Tu tramo empieza en Interesado — ahí te lo entrega el setter (o Camil-AI)."}
      </p>
    </div>
  );
}

export default function RoleOnboarding({ rol, open, onClose }: { rol: RolEquipo; open: boolean; onClose: () => void }) {
  const [paso, setPaso] = useState(0);
  const pasos = PASOS[rol];
  const esUltimo = paso === pasos.length - 1;
  const actual = pasos[paso];
  const Icon = actual.icon;
  const acento = rol === "setter" ? "text-blue-600" : "text-violet-600";
  const acentoBg = rol === "setter" ? "bg-blue-600/10" : "bg-violet-600/10";

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
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${acentoBg} ${acento}`}>
              {rol === "setter" ? "Onboarding · Setter" : "Onboarding · Closer"}
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
                <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${acentoBg} ${acento}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${acento}`}>{actual.eyebrow}</p>
                <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{actual.titulo}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{actual.cuerpo}</p>
              </motion.div>
            </AnimatePresence>

            {paso === 1 && (
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  { icon: AlarmClock, label: "SLA de contacto" },
                  { icon: CalendarClock, label: "Seguimientos" },
                  { icon: MessageCircle, label: "Plantillas listas" },
                ].map(({ icon: I, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                    <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {label}
                  </div>
                ))}
              </div>
            )}
            {paso === 2 && rol === "setter" && (
              <div className="mt-5 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> Mis Plantillas: creá y guardá tus propios mensajes
              </div>
            )}
          </div>

          {/* Footer / navegación */}
          <div className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <div className="flex gap-1.5">
              {pasos.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === paso ? `w-5 ${rol === "setter" ? "bg-blue-600" : "bg-violet-600"}` : "w-1.5 bg-border"}`} />
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
                className={`gap-1 ${rol === "setter" ? "bg-blue-600 hover:bg-blue-700" : "bg-violet-600 hover:bg-violet-700"}`}
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
export function useRoleOnboarding(userId: string | undefined, rol: RolEquipo | undefined) {
  const [open, setOpen] = useState(false);
  const key = userId && rol ? `onboarding_${rol}_${userId}` : null;

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

import { ETAPA_COLOR, ETAPA_LABEL, ETAPA_PROGRESO, ETAPAS_PIPELINE, type Etapa } from "@/components/vendedor/types";

// Barra de progreso del lead dentro del embudo. Usa la paleta por etapa
// (ETAPA_COLOR) para que el color diga lo mismo que la columna del kanban:
// azul = contactado, cian = interesado, violeta = demo, verde = ganado,
// rojo = perdido. La transición de ancho y color se anima sola al mover
// el lead de etapa (no hay estado ni efectos: solo CSS).
export default function EtapaProgreso({
  etapa, compacto = false, mostrarHitos = false,
}: {
  etapa: Etapa;
  /** Sin etiquetas ni porcentaje: para la tarjeta del kanban. */
  compacto?: boolean;
  /** Puntos de cada etapa bajo la barra: para la ficha del lead. */
  mostrarHitos?: boolean;
}) {
  const color = ETAPA_COLOR[etapa];
  const pct = ETAPA_PROGRESO[etapa];
  const orden = ETAPAS_PIPELINE.indexOf(etapa as Exclude<Etapa, "nuevo">);

  return (
    <div className={compacto ? "space-y-1" : "space-y-2"}>
      {!compacto && (
        <div className="flex items-center justify-between text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${color.badge}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color.hex }} />
            {ETAPA_LABEL[etapa]}
          </span>
          <span className="font-mono text-muted-foreground">{pct}%</span>
        </div>
      )}

      <div
        className={`w-full overflow-hidden rounded-full bg-muted ${compacto ? "h-1" : "h-2"}`}
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Avance del lead: ${ETAPA_LABEL[etapa]}`}
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color.hex }}
        />
      </div>

      {mostrarHitos && (
        <div className="flex items-center justify-between">
          {ETAPAS_PIPELINE.map((e, i) => {
            // "perdido" nunca se pinta como alcanzado por el camino normal:
            // es una salida del embudo, no un paso más.
            const alcanzado = etapa === "perdido" ? e === "perdido" : orden >= 0 && i <= orden;
            return (
              <div key={e} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full transition-colors duration-500"
                  style={{ backgroundColor: alcanzado ? ETAPA_COLOR[e].hex : "hsl(var(--muted))" }}
                />
                <span className={`truncate text-[9px] leading-tight ${alcanzado ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {ETAPA_LABEL[e].split(" / ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { ETAPA_LABEL, type CorreosResumen, type VendedorKpis } from "@/components/vendedor/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// Paleta cíclica para las plantillas más usadas (no hay un color fijo por
// plantilla, a diferencia de las otras donas que sí tienen semántica).
const PALETA_PLANTILLAS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#a78bfa", "#84cc16"];

type Segmento = { key: string; label: string; value: number; color: string; detalle: string };

function Dona({
  titulo, subtitulo, data, centro, centroLabel,
}: {
  titulo: string;
  subtitulo: string;
  data: Segmento[];
  centro: string | number;
  centroLabel: string;
}) {
  const [activa, setActiva] = useState<string | null>(null);
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const seleccionada = data.find((d) => d.key === activa) ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sin datos todavía.</p>
        ) : (
          <>
            <div className="relative mx-auto">
              <ChartContainer config={{}} className="mx-auto h-[180px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    strokeWidth={2}
                    onClick={(d: any) => setActiva((prev) => (prev === d.key ? null : d.key))}
                    className="cursor-pointer"
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.key}
                        fill={d.color}
                        stroke="#ffffff"
                        opacity={activa && activa !== d.key ? 0.35 : 1}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums">{seleccionada ? seleccionada.value : centro}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {seleccionada ? seleccionada.label : centroLabel}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              {data.map((d) => {
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                const sel = activa === d.key;
                return (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => setActiva((prev) => (prev === d.key ? null : d.key))}
                    className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors ${
                      sel ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
                    <span className="font-medium tabular-nums">{d.value}</span>
                    <span className="w-9 text-right text-muted-foreground tabular-nums">{pct}%</span>
                  </button>
                );
              })}
            </div>

            {seleccionada && (
              <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">{seleccionada.detalle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function EstadisticasTab({ kpis, correos }: { kpis: VendedorKpis | null; correos: CorreosResumen | null }) {
  const pipelineData: Segmento[] = useMemo(() => {
    if (!kpis) return [];
    const nuevo = Math.max(
      kpis.asignados - kpis.contactados - kpis.interesados - kpis.demos - kpis.ganados - kpis.perdidos,
      0,
    );
    const base: [string, number, string][] = [
      ["nuevo", nuevo, "#94a3b8"],
      ["contactado", kpis.contactados, "#3b82f6"],
      ["interesado", kpis.interesados, "#f59e0b"],
      ["demo", kpis.demos, "#8b5cf6"],
      ["ganado", kpis.ganados, "#10b981"],
      ["perdido", kpis.perdidos, "#f43f5e"],
    ];
    return base
      .filter(([, value]) => value > 0)
      .map(([key, value, color]) => ({
        key,
        value,
        color,
        label: ETAPA_LABEL[key as keyof typeof ETAPA_LABEL],
        detalle: `${value} lead${value === 1 ? "" : "s"} en "${ETAPA_LABEL[key as keyof typeof ETAPA_LABEL]}".`,
      }));
  }, [kpis]);

  const correosData: Segmento[] = useMemo(() => {
    if (!correos) return [];
    const base: [string, number, string, string][] = [
      ["enviado", correos.enviado_30d, "#94a3b8", "Enviado, todavía sin confirmación de entrega."],
      ["entregado", correos.entregado_30d, "#60a5fa", "Llegó a la bandeja del lead."],
      ["abierto", correos.abierto_30d, "#34d399", "El lead abrió el correo."],
      ["click", correos.click_30d, "#a78bfa", "El lead hizo click en el correo."],
      ["rebotado", correos.rebotado_30d, "#fb7185", "No se pudo entregar (rebote)."],
      ["fallido", correos.fallido_30d, "#ef4444", "Error al enviar, no se descuenta del cupo diario."],
    ];
    return base
      .filter(([, value]) => value > 0)
      .map(([key, value, color, detalle]) => ({
        key,
        value,
        color,
        detalle,
        label: key === "enviado" ? "Enviado" : key === "entregado" ? "Entregado" : key === "abierto" ? "Abierto"
          : key === "click" ? "Click" : key === "rebotado" ? "Rebotado" : "Fallido",
      }));
  }, [correos]);

  const cupoData: Segmento[] = useMemo(() => {
    if (!correos) return [];
    const usados = Math.min(correos.enviados_hoy, correos.cupo_diario);
    const restantes = Math.max(correos.cupo_diario - correos.enviados_hoy, 0);
    const out: Segmento[] = [];
    if (usados > 0) {
      out.push({ key: "usados", value: usados, color: "#003DA5", label: "Usados hoy", detalle: `Ya enviaste ${usados} correos hoy.` });
    }
    if (restantes > 0) {
      out.push({ key: "restantes", value: restantes, color: "#e2e8f0", label: "Restantes", detalle: `Te quedan ${restantes} correos disponibles hoy.` });
    }
    return out;
  }, [correos]);

  const [plantillasUsadas, setPlantillasUsadas] = useState<{ plantilla_id: string; canal: string; nombre: string | null; usos: number }[]>([]);
  useEffect(() => {
    sb.rpc("vendedor_plantillas_usadas").then(({ data }: { data: typeof plantillasUsadas | null }) => {
      if (data) setPlantillasUsadas(data);
    });
  }, []);

  const plantillasData: Segmento[] = useMemo(() => {
    return plantillasUsadas.map((p, i) => {
      const canalLabel = p.canal === "whatsapp" ? "WhatsApp" : "Email";
      const nombre = p.nombre || "Plantilla eliminada";
      return {
        key: `${p.canal}:${p.plantilla_id}`,
        value: p.usos,
        color: PALETA_PLANTILLAS[i % PALETA_PLANTILLAS.length],
        label: nombre,
        detalle: `"${nombre}" (${canalLabel}): usada ${p.usos} ${p.usos === 1 ? "vez" : "veces"}.`,
      };
    });
  }, [plantillasUsadas]);

  const leadsTratados = kpis ? kpis.contactados + kpis.interesados + kpis.demos + kpis.ganados + kpis.perdidos : 0;

  return (
    <div className="space-y-4">
      {kpis && (
        <p className="text-xs text-muted-foreground">
          Leads tratados: <span className="font-semibold text-foreground">{leadsTratados}</span> de{" "}
          <span className="font-semibold text-foreground">{kpis.asignados}</span> asignados · Tasa de respuesta:{" "}
          <span className="font-semibold text-foreground">{kpis.tasa_respuesta_pct}%</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dona
          titulo="Pipeline por etapa"
          subtitulo="Tus leads de campaña, agrupados por etapa. Toca un segmento o la lista para ver el detalle."
          data={pipelineData}
          centro={kpis?.asignados ?? 0}
          centroLabel="asignados"
        />
        <Dona
          titulo="Correos enviados (30 días)"
          subtitulo="Estado de tus envíos por Correos Personalizados."
          data={correosData}
          centro={correos?.total_30d ?? 0}
          centroLabel="correos"
        />
        <Dona
          titulo="Cupo diario de correos"
          subtitulo={`Tu tope es de ${correos?.cupo_diario ?? 55} correos por día.`}
          data={cupoData}
          centro={`${correos?.enviados_hoy ?? 0}/${correos?.cupo_diario ?? 55}`}
          centroLabel="usados hoy"
        />
        <Dona
          titulo="Plantillas más usadas"
          subtitulo="Tus plantillas de WhatsApp y email con más envíos (Bandeja, Prospección y Pipeline)."
          data={plantillasData}
          centro={plantillasData.reduce((acc, d) => acc + d.value, 0)}
          centroLabel="envíos"
        />
      </div>
    </div>
  );
}

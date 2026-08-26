import { useEffect, useState } from "react";
import { Gauge, Loader2, RefreshCw, AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// admin_consumo_resumen todavía no está en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Recurso = {
  recurso: string;
  etiqueta: string;
  usado: number;
  incluido: number;
  tope: number | null;
  excedente: number;
  excedente_usd: string | number;
  ampliable: boolean;
};

type Resumen = {
  cuenta: string | null;
  plan: string | null;
  precio_mes_usd: string | number;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  recursos: Recurso[];
  excedente_usd: string | number;
  total_usd: string | number;
  error?: string;
};

const usd = (v: string | number | null | undefined) =>
  `US$${Number(v ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : "—";

export default function ConsumoPlanPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const { data: r, error } = await sb.rpc("admin_consumo_resumen");
    if (error) toast({ title: "Error al cargar el consumo", description: error.message, variant: "destructive" });
    else setData(r as Resumen);
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!loading && (!data || data.error)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-[#003DA5]" /> Consumo del período
          </CardTitle>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={cargar} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {data && (
          <p className="text-xs text-muted-foreground">
            {data.cuenta} · plan {data.plan} · del {fecha(data.periodo_inicio)} al {fecha(data.periodo_fin)}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : data ? (
          <div className="space-y-4">
            {data.recursos.map((r) => {
              // El techo manda sobre lo incluido para dibujar la barra: es el
              // punto donde el servicio se corta, no donde empieza a cobrarse.
              const limite = r.tope ?? Math.max(r.incluido, r.usado, 1);
              const pctIncluido = Math.min(100, (Math.min(r.usado, r.incluido) / limite) * 100);
              const pctExcedente = Math.min(100 - pctIncluido, (Math.max(0, r.usado - r.incluido) / limite) * 100);
              const enTope = r.tope !== null && r.usado >= r.tope;
              const cerca = r.tope !== null && !enTope && r.usado >= r.tope * 0.8;

              return (
                <div key={r.recurso}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{r.etiqueta}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.usado.toLocaleString("es-CL")} / {r.incluido.toLocaleString("es-CL")}
                      {r.tope !== null && ` · tope ${r.tope.toLocaleString("es-CL")}`}
                    </span>
                  </div>

                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="bg-[#003DA5]" style={{ width: `${pctIncluido}%` }} />
                    <div className="bg-amber-500" style={{ width: `${pctExcedente}%` }} />
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    {r.excedente > 0 && (
                      <span className="text-amber-700">
                        {r.excedente.toLocaleString("es-CL")} sobre lo incluido · {usd(r.excedente_usd)}
                      </span>
                    )}
                    {enTope && (
                      <span className="inline-flex items-center gap-1 font-medium text-destructive">
                        <Lock className="h-3 w-3" /> tope alcanzado, no se envían más hasta el {fecha(data.periodo_fin)}
                      </span>
                    )}
                    {cerca && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> cerca del tope
                      </span>
                    )}
                    {!r.ampliable && r.usado >= r.incluido && !enTope && (
                      <span className="text-muted-foreground">este plan no se amplía pagando</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                Plan {usd(data.precio_mes_usd)} + excedentes {usd(data.excedente_usd)}
              </span>
              <span className="font-semibold">Total del período: {usd(data.total_usd)}</span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Solo se cuentan las conversaciones que abrimos nosotros: las que inicia el lead viajan dentro de la
              ventana de 24 h y no las cobra Meta. El tope de correos es duro y no se amplía pagando, porque todos
              los clientes salen por el mismo dominio de envío.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { MessageSquareText, TrendingUp, Globe2 } from "lucide-react";

interface MessagesByDay {
  date: string;
  inbound: number;
  outbound: number;
}

interface CountryKPI {
  pais: string;
  total: number;
  recientes_7d: number;
  promedio_dias: number;
  pct: number;
  respondidos?: number;
  tasa_respuesta?: number;
}

interface Props {
  messagesByDay: MessagesByDay[];
  topCountries: CountryKPI[];
  topResponseCountries: CountryKPI[];
  countries: CountryKPI[];
  lineChartConfig: Record<string, { label: string; color: string }>;
  countryChartConfig: Record<string, { label: string; color: string }>;
  respChartConfig: Record<string, { label: string; color: string }>;
  onSelectCountry: (c: CountryKPI) => void;
}

export default function DashboardCharts({
  messagesByDay,
  topCountries,
  topResponseCountries,
  countries,
  lineChartConfig,
  countryChartConfig,
  respChartConfig,
  onSelectCountry,
}: Props) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="border-border/60 transition-shadow hover:shadow-md">
          <CardHeader className="pb-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Actividad</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
                <MessageSquareText className="h-4 w-4" />
              </span>
              Mensajes por día
              <span className="ml-auto text-xs font-normal text-muted-foreground">últimos 14 días</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineChartConfig} className="h-[220px] w-full">
              <LineChart data={messagesByDay} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Entrantes" />
                <Line type="monotone" dataKey="outbound" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Salientes" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {countries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-3"
        >
          <Card className="border-border/60 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Volumen</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
                  <Globe2 className="h-4 w-4" />
                </span>
                Top 10 países por contactos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={countryChartConfig} className="h-[240px] w-full">
                <BarChart
                  data={topCountries}
                  layout="vertical"
                  margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                  onClick={(state: any) => {
                    const p = state?.activePayload?.[0]?.payload as CountryKPI | undefined;
                    if (p) onSelectCountry(p);
                  }}
                >
                  <defs>
                    <linearGradient id="barPrimary" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="url(#barPrimary)" className="cursor-pointer" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-border/60 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Efectividad</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-1 ring-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </span>
                Tasa de respuesta por país (top 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topResponseCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Aún no hay leads con respuesta registrada.
                </p>
              ) : (
                <ChartContainer config={respChartConfig} className="h-[240px] w-full">
                  <BarChart
                    data={topResponseCountries}
                    layout="vertical"
                    margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                    onClick={(state: any) => {
                      const p = state?.activePayload?.[0]?.payload as CountryKPI | undefined;
                      if (p) onSelectCountry(p);
                    }}
                  >
                    <defs>
                      <linearGradient id="barEmerald" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="%" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="pais" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="tasa_respuesta" fill="url(#barEmerald)" radius={[0, 4, 4, 0]} className="cursor-pointer" />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}

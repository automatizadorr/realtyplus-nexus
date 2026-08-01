import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countryFlag } from "@/lib/countryFlag";

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
  countries: CountryKPI[];
  onSelectCountry: (c: CountryKPI) => void;
}

export default function CountryDetailTable({ countries, onSelectCountry }: Props) {
  if (countries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Detalle</p>
          <CardTitle className="mt-1 text-base font-semibold">
            Detalle por país <span className="font-normal text-muted-foreground">({countries.length})</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">· clic en una fila para segmentar</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/40 [&_th]:h-9 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide">
                <TableRow className="hover:bg-transparent">
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Participación</TableHead>
                  <TableHead className="text-right">Respondieron</TableHead>
                  <TableHead>Tasa resp.</TableHead>
                  <TableHead className="text-right">Últ. 7d</TableHead>
                  <TableHead className="text-right">Días prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((c) => (
                  <TableRow
                    key={c.pais}
                    className="cursor-pointer even:bg-muted/20 hover:bg-primary/5"
                    onClick={() => onSelectCountry(c)}
                  >
                    <TableCell className="font-medium">
                      <span className="mr-2">{countryFlag(c.pais)}</span>
                      {c.pais}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{c.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full min-w-[36px] max-w-[90px] overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(c.respondidos ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full min-w-[36px] max-w-[90px] overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(c.tasa_respuesta ?? 0, 100)}%` }} />
                        </div>
                        <span className="w-11 text-right text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {(c.tasa_respuesta ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.recientes_7d.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.promedio_dias}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

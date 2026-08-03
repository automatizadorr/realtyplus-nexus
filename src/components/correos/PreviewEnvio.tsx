import { useMemo } from "react";
import { MailCheck, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fill, isEmail, unresolvedTokens, type Recipient } from "@/lib/correosVariables";

// Muestra cómo quedará el correo para 2-3 destinatarios REALES, con las
// variables {{}} ya resueltas, y avisa si les faltan datos o variables.
type Props = {
  recipients: Recipient[];
  subject: string;
  cuerpo: string;             // cuerpo en texto plano (input del usuario)
  cuerpoRendered: string;     // cuerpo con HTML ya compuesto (para iframe)
  ganchoFallo: string;        // gancho con el que se completa al que no trae
};

export default function PreviewEnvio({ recipients, subject, cuerpo, cuerpoRendered, ganchoFallo }: Props) {
  const validos = useMemo(() => recipients.filter((r) => isEmail(r.email)), [recipients]);

  const muestras = useMemo(() => {
    if (validos.length === 0) return [];
    const conDatos = validos.filter((r) => (r.nombre || r.empresa || r.ciudad || r.gancho));
    const pool: Recipient[] = [];
    const push = (r: Recipient) => {
      if (pool.length >= 3 || pool.some((p) => p.email === r.email)) return;
      pool.push(r);
    };
    push(conDatos[0] ?? validos[0]);
    push(conDatos[1] ?? validos[validos.length - 1]);
    push(validos[validos.length - 1]);
    if (pool.length < 3 && validos.length > 2) push(validos[1]);
    return pool;
  }, [validos]);

  const faltantes = useMemo(() => {
    let sinNombre = 0, sinEmpresa = 0, sinCiudad = 0, sinGancho = 0, sinVars = 0;
    for (const r of validos) {
      if (!(r.nombre || r.empresa || "").trim()) sinNombre++;
      if (!(r.empresa || "").trim()) sinEmpresa++;
      if (!(r.ciudad || "").trim()) sinCiudad++;
      if (!(r.gancho || "").trim()) sinGancho++;
      const r1 = { ...r, gancho: (r.gancho || "").trim() || ganchoFallo };
      if (unresolvedTokens(`${fill(subject, r1)}\n${fill(cuerpo, r1)}`).length) sinVars++;
    }
    return { sinNombre, sinEmpresa, sinCiudad, sinGancho, sinVars };
  }, [validos, subject, cuerpo, ganchoFallo]);

  if (validos.length === 0) return null;

  const totalCuidado =
    faltantes.sinNombre + faltantes.sinEmpresa + faltantes.sinCiudad +
    faltantes.sinGancho + faltantes.sinVars;

  return (
    <Card className="border-amber-300/60">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <MailCheck className="h-4 w-4 text-[#003DA5]" />
          Vista previa de tu envío
          <Badge variant="secondary">{validos.length} destinatario(s)</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lo que verá cada destinatario ANTES de enviar. Revisa que no falten variables.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalCuidado > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            <span className="inline-flex items-center gap-1 font-semibold">
              <TriangleAlert className="h-3.5 w-3.5" /> Cuidado al enviar:
            </span>
            {faltantes.sinNombre > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{faltantes.sinNombre} sin nombre</Badge>}
            {faltantes.sinEmpresa > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{faltantes.sinEmpresa} sin empresa</Badge>}
            {faltantes.sinCiudad > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{faltantes.sinCiudad} sin ciudad</Badge>}
            {faltantes.sinGancho > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{faltantes.sinGancho} sin gancho*</Badge>}
            {faltantes.sinVars > 0 && <Badge variant="outline" className="border-red-300 text-red-700">{faltantes.sinVars} con variable sin rellenar</Badge>}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {muestras.map((r) => {
            const gancho = (r.gancho || "").trim() || ganchoFallo;
            const asunto = fill(subject, { ...r, gancho });
            const cuerpoOk = fill(cuerpo, { ...r, gancho });
            const htmlOk = fill(cuerpoRendered, { ...r, gancho });
            const tokens = unresolvedTokens(`${asunto}\n${cuerpoOk}`);
            const nombreOk = Boolean((r.nombre || r.empresa || "").trim());
            const empresaOk = Boolean((r.empresa || "").trim());
            const ciuOk = Boolean((r.ciudad || "").trim());
            return (
              <div key={r.email} className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-1 truncate font-mono text-[11px] text-muted-foreground">{r.email}</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  <Badge variant={nombreOk ? "secondary" : "outline"} className={nombreOk ? "" : "border-destructive text-destructive"}>
                    nombre: {nombreOk ? ((r.nombre || r.empresa || "").slice(0, 22) + ((r.nombre || r.empresa || "").length > 22 ? "…" : "")) : "vacío"}
                  </Badge>
                  <Badge variant={empresaOk ? "secondary" : "outline"} className={empresaOk ? "" : "border-destructive text-destructive"}>
                    empresa: {empresaOk ? (r.empresa.slice(0, 22) + (r.empresa.length > 22 ? "…" : "")) : "vacío"}
                  </Badge>
                  <Badge variant={gancho.trim() ? "secondary" : "outline"} className={gancho.trim() ? "" : "border-destructive text-destructive"}>
                    gancho*: {gancho.trim() ? (gancho.length > 14 ? gancho.slice(0, 13) + "…" : gancho) : "vacío"}
                  </Badge>
                  <Badge variant={ciuOk ? "secondary" : "outline"} className={ciuOk ? "" : "border-destructive text-destructive"}>
                    {ciuOk ? r.ciudad : "ciudad vacía"}
                  </Badge>
                </div>
                <p className="mb-1 text-sm font-semibold">{asunto}</p>
                {htmlOk.trim() ? (
                  <iframe title={`Vista ${r.email}`} className="h-44 w-full rounded-md border bg-white" srcDoc={htmlOk} />
                ) : (
                  <pre className="max-h-44 overflow-auto rounded-md border bg-white p-2 text-[11px] leading-relaxed">{cuerpoOk}</pre>
                )}
                {tokens.length > 0 && (
                  <p className="mt-1 text-[11px] font-mono text-destructive">Falta variable: {tokens.join(" ")}</p>
                )}
              </div>
            );
          })}
        </div>

        {faltantes.sinGancho > 0 && (
          <p className="text-[11px] text-muted-foreground">
            * A los destinatarios sin gancho se les rellena con: <code className="rounded bg-muted px-1">{ganchoFallo}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
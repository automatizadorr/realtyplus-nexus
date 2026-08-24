import { useEffect, useState } from "react";
import { AtSign, Loader2, Save, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { describirRemitente, useRemitente } from "@/hooks/use-remitente";
import { REMITENTE_CUPO, type RemitenteConfig, type RemitenteModo } from "@/components/vendedor/types";

const OPCIONES: { valor: RemitenteModo; titulo: string; detalle: string }[] = [
  { valor: "auto", titulo: "Automático (las dos cuentas)", detalle: "Alterna send.lexhouse-ai.com y lexhouse-ai.online. 200 correos/día." },
  { valor: "resend1", titulo: "Solo send.lexhouse-ai.com", detalle: "100 correos/día. Deja descansar el otro dominio." },
  { valor: "resend2", titulo: "Solo lexhouse-ai.online", detalle: "100 correos/día. Útil si el primero está saturado." },
  { valor: "particular", titulo: "Mi correo particular", detalle: "No usa Resend ni gasta cupo: el envío se abre en tu cliente de correo." },
];

// Elección del remitente de correo del vendedor. Vive en "Diseño de Correo"
// (donde se arma el correo) y también en la Bandeja (donde se envía), para no
// tener que cambiar de sección justo antes de mandar.
export default function RemitenteCard({ compacto = false }: { compacto?: boolean }) {
  const { toast } = useToast();
  const { config, cargando, guardar } = useRemitente();
  const [form, setForm] = useState<RemitenteConfig>(config);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setForm(config); }, [config]);

  const set = <K extends keyof RemitenteConfig>(k: K) => (v: RemitenteConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const esParticular = form.remitente_modo === "particular";
  const cupo = REMITENTE_CUPO[form.remitente_modo];
  const opcion = OPCIONES.find((o) => o.valor === form.remitente_modo);

  const onGuardar = async () => {
    if (esParticular && !form.remitente_particular?.trim()) {
      toast({ title: "Falta tu correo particular", variant: "destructive" });
      return;
    }
    setGuardando(true);
    try {
      await guardar(form);
      toast({ title: "Remitente actualizado", description: describirRemitente(form) });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando remitente…
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className={`space-y-3 ${compacto ? "p-3" : "p-4"}`}>
        <div className="flex items-center gap-2">
          <AtSign className="h-4 w-4 text-[#003DA5]" />
          <h3 className="text-sm font-semibold">Correo desde el que envías</h3>
          {cupo !== null
            ? <span className="ml-auto rounded-full border border-[#003DA5]/30 bg-[#003DA5]/10 px-2 py-0.5 text-[10px] font-medium text-[#003DA5]">{cupo}/día</span>
            : <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">sin límite Resend</span>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Cuenta de envío</Label>
            <Select value={form.remitente_modo} onValueChange={(v) => set("remitente_modo")(v as RemitenteModo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPCIONES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
            {opcion && <p className="text-[11px] text-muted-foreground">{opcion.detalle}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nombre que se ve</Label>
            <Input
              value={form.remitente_from_name ?? ""} onChange={(e) => set("remitente_from_name")(e.target.value)}
              placeholder="p. ej. Mario · LexHouse"
            />
          </div>

          {esParticular ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Tu correo particular *</Label>
              <Input
                value={form.remitente_particular ?? ""} onChange={(e) => set("remitente_particular")(e.target.value)}
                placeholder="mario@gmail.com" inputMode="email"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Usuario antes de la @</Label>
              <Input
                value={form.remitente_local ?? ""} onChange={(e) => set("remitente_local")(e.target.value)}
                placeholder="mario"
              />
              <p className="text-[11px] text-muted-foreground">El dominio lo pone el sistema según la cuenta usada.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Responder a (opcional)</Label>
            <Input
              value={form.remitente_reply_to ?? ""} onChange={(e) => set("remitente_reply_to")(e.target.value)}
              placeholder="tu-correo@ejemplo.com" inputMode="email"
            />
            <p className="text-[11px] text-muted-foreground">Donde te llegan las respuestas del lead.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px]">
            {describirRemitente(form)}
          </span>
          <Button type="button" size="sm" disabled={guardando} onClick={onGuardar} className="ml-auto gap-1.5">
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar
          </Button>
        </div>

        {esParticular && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Con el correo particular los envíos se abren en tu cliente de correo con los
            destinatarios en copia oculta. No pasan por Resend, así que no hay estadísticas
            de apertura ni entrega — pero tampoco gastan cupo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

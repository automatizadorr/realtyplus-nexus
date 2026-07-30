import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Sparkles, Trash2, Plus, UserPlus, Eye, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Recipient = { email: string; empresa: string; ciudad: string; gancho: string };
type SendResult = { email: string; ok: boolean; id?: string; error?: string };

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const DEFAULT_SUBJECT = "{{empresa}}: que ningún lead se te vuelva a escapar";
const DEFAULT_BODY = `Hola equipo de {{empresa}},

Les escribo desde LexHouse. Trabajamos con corredoras en Chile y hay algo que vemos seguido: {{gancho}}.

LexHouse es un equipo de inteligencia artificial que trabaja 24/7 para tu corredora:

- Un agente por WhatsApp que responde y captura cada consulta al instante, de día y de noche.
- Un CRM que reúne todos tus leads en un solo panel, con seguimiento automático.
- Publicación de tus propiedades en +12 portales en minutos, no en horas.

En la práctica: menos leads perdidos, respuesta inmediata y tu equipo enfocado en cerrar, no en copiar y pegar.

¿Te muestro en 10 minutos cómo se vería con las propiedades de {{empresa}}? Puedes responder este correo o escribirme por WhatsApp.

Un saludo,
Mario · LexHouse`;

// Reemplaza {{empresa}}/{{ciudad}}/{{gancho}} en una plantilla.
function fill(tpl: string, r: Partial<Recipient>): string {
  return tpl.replace(/\{\{\s*(empresa|ciudad|gancho)\s*\}\}/gi, (_m, k) => {
    const key = k.toLowerCase() as keyof Recipient;
    return (r[key] as string) || "";
  });
}

// Convierte el cuerpo en texto plano a HTML con estilo (párrafos, listas y saltos).
function bodyToHtml(text: string): string {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const html = blocks
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim());
      const isList = lines.every((l) => /^[-•]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li>${l.replace(/^[-•]\s+/, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a2b4a;line-height:1.6;max-width:560px;margin:0 auto">\n${html}\n</div>`;
}

export default function CorreosPersonalizados() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [rawInput, setRawInput] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [fromName, setFromName] = useState("Mario · LexHouse");
  const [fromEmail, setFromEmail] = useState("no-reply@send.lexhouse-ai.com");
  const [replyTo, setReplyTo] = useState(user?.email ?? "");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const validCount = useMemo(
    () => recipients.filter((r) => EMAIL_RE.test(r.email)).length,
    [recipients],
  );

  // Extrae correos del texto pegado y los añade (deduplicando con los existentes).
  const extractEmails = () => {
    const found = rawInput.match(EMAIL_RE) || [];
    const existing = new Set(recipients.map((r) => r.email.toLowerCase()));
    const nuevos: Recipient[] = [];
    for (const raw of found) {
      const e = raw.toLowerCase();
      if (existing.has(e)) continue;
      existing.add(e);
      nuevos.push({ email: e, empresa: "", ciudad: "", gancho: "" });
    }
    if (nuevos.length === 0) {
      toast({ title: "Sin correos nuevos", description: "No encontré correos nuevos en el texto pegado.", variant: "destructive" });
      return;
    }
    setRecipients((prev) => [...prev, ...nuevos]);
    setRawInput("");
    toast({ title: `${nuevos.length} correo(s) añadido(s)`, description: "Completa empresa, ciudad y gancho de cada uno." });
  };

  const updateRow = (i: number, field: keyof Recipient, value: string) => {
    setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const removeRow = (i: number) => setRecipients((prev) => prev.filter((_, idx) => idx !== i));
  const addEmptyRow = () => setRecipients((prev) => [...prev, { email: "", empresa: "", ciudad: "", gancho: "" }]);

  // Envía a Resend vía edge function. `only` limita a un destinatario (prueba).
  const doSend = async (payloadRecipients: Recipient[], label: string) => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Falta contenido", description: "Completa el asunto y el cuerpo del correo.", variant: "destructive" });
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-personalized-campaign", {
        body: {
          fromName, fromEmail,
          replyTo: replyTo.trim() || undefined,
          subject,
          text: body,
          html: bodyToHtml(body),
          recipients: payloadRecipients,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results ?? []);
      toast({
        title: `${label}: ${data?.sent ?? 0} enviado(s)`,
        description: data?.failed ? `${data.failed} fallaron. Revisa el detalle abajo.` : "Todos entregados a Resend.",
        variant: data?.failed ? "destructive" : "default",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Error al enviar", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendTest = () => {
    const base = recipients[0];
    const testTo = user?.email;
    if (!testTo) {
      toast({ title: "Sin correo de prueba", description: "Tu sesión no tiene email para la prueba.", variant: "destructive" });
      return;
    }
    doSend(
      [{
        email: testTo,
        empresa: base?.empresa || "Tu Corredora",
        ciudad: base?.ciudad || "tu ciudad",
        gancho: base?.gancho || "los leads se pierden entre planillas y WhatsApp",
      }],
      "Prueba",
    );
  };

  const previewRow = recipients.find((r) => EMAIL_RE.test(r.email)) || {
    empresa: "Tu Corredora", ciudad: "tu ciudad", gancho: "los leads se pierden entre planillas y WhatsApp",
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Correos Personalizados</h1>
          <p className="text-sm text-muted-foreground">
            Extrae correos, personaliza por empresa/ciudad/gancho y envía por Resend.
          </p>
        </div>
      </motion.div>

      {/* Paso 1 — Destinatarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#003DA5] text-xs font-bold text-white">1</span>
            Destinatarios
            {validCount > 0 && <Badge variant="secondary" className="ml-1">{validCount} válidos</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs text-muted-foreground">Pega aquí texto, HTML o una lista con correos y extráelos automáticamente</Label>
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Pega aquí el texto/HTML con los correos…"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={extractEmails} disabled={!rawInput.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" /> Extraer correos
            </Button>
            <Button type="button" variant="outline" onClick={addEmptyRow} className="gap-2">
              <UserPlus className="h-4 w-4" /> Añadir fila manual
            </Button>
          </div>

          {recipients.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              <Plus className="mx-auto mb-2 h-6 w-6 opacity-40" />
              Aún no hay destinatarios. Pega correos arriba o añade una fila manual.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Correo</TableHead>
                    <TableHead className="min-w-[150px]">Empresa</TableHead>
                    <TableHead className="min-w-[120px]">Ciudad</TableHead>
                    <TableHead className="min-w-[240px]">Gancho (dolor)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={r.email} onChange={(e) => updateRow(i, "email", e.target.value)} placeholder="correo@dominio.cl"
                          className={!r.email || EMAIL_RE.test(r.email) ? "" : "border-destructive"} />
                      </TableCell>
                      <TableCell><Input value={r.empresa} onChange={(e) => updateRow(i, "empresa", e.target.value)} placeholder="Nombre corredora" /></TableCell>
                      <TableCell><Input value={r.ciudad} onChange={(e) => updateRow(i, "ciudad", e.target.value)} placeholder="Ciudad" /></TableCell>
                      <TableCell><Input value={r.gancho} onChange={(e) => updateRow(i, "gancho", e.target.value)} placeholder="p.ej. leads dispersos sin CRM" /></TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)} aria-label="Quitar">
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 2 — Remitente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#003DA5] text-xs font-bold text-white">2</span>
            Remitente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre remitente</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Correo remitente (dominio verificado)</Label>
            <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responder a (reply-to)</Label>
            <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="tu@correo.com" />
          </div>
        </CardContent>
      </Card>

      {/* Paso 3 — Mensaje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#003DA5] text-xs font-bold text-white">3</span>
              Mensaje
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5">
              <Eye className="h-4 w-4" /> {showPreview ? "Ocultar" : "Vista previa"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Variables disponibles: <code className="rounded bg-muted px-1">{"{{empresa}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{ciudad}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{gancho}}"}</code> — se rellenan por fila.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cuerpo</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-[13px]" />
          </div>

          {showPreview && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Vista previa · {("empresa" in previewRow && previewRow.empresa) || "(sin empresa)"}
              </p>
              <p className="mb-3 text-sm font-semibold">{fill(subject, previewRow)}</p>
              <div className="prose prose-sm max-w-none text-[14px] [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: bodyToHtml(fill(body, previewRow)) }} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={sendTest} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Enviar prueba a mí
        </Button>
        <Button type="button" onClick={() => setConfirmOpen(true)} disabled={sending || validCount === 0} className="gap-2 bg-[#003DA5] hover:bg-[#003DA5]/90">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar a todos ({validCount})
        </Button>
        {sending && <span className="text-sm text-muted-foreground">Enviando… no cierres esta página.</span>}
      </div>

      {/* Resultados */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado del envío</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Correo</TableHead><TableHead>Estado</TableHead><TableHead>Detalle</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.email}</TableCell>
                      <TableCell>
                        {r.ok ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Enviado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> Falló</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ok ? r.id : r.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmación de envío masivo */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a {validCount} destinatario(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará el correo personalizado a cada destinatario real desde <strong>{fromEmail}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#003DA5] hover:bg-[#003DA5]/90"
              onClick={() => { setConfirmOpen(false); doSend(recipients.filter((r) => EMAIL_RE.test(r.email)), "Campaña"); }}
            >
              Sí, enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

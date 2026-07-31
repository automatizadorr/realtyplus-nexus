import { useEffect, useMemo, useState } from "react";
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
import { bodyToHtml, buildProEmail } from "@/lib/emailTemplates";
import EmailDesignCard, { type DesignMode } from "@/components/correos/EmailDesignCard";
import CorreoSeguimiento from "@/components/correos/CorreoSeguimiento";
import { EMAIL_COPYS, type EmailCopy, GANCHOS_DOLOR, emailCopyCategorias } from "@/lib/emailCopys";

type Recipient = { email: string; empresa: string; ciudad: string; gancho: string };
type SendResult = { email: string; ok: boolean; id?: string; error?: string };

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const isEmail = (s: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test((s || "").trim());

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

// --- Scraping / extracción de datos desde HTML ---

// Extrae el primer array JSON de objetos ([{...}]) del texto, con matching de
// corchetes balanceado (tolera arrays anidados como "problemas"). Sirve para
// leer el bloque `const data = [ ... ]` que traen los HTML de prospección.
function extractFirstJsonArray(text: string): Record<string, unknown>[] | null {
  const m = text.match(/\[\s*\{/);
  if (!m || m.index === undefined) return null;
  const start = m.index;
  let depth = 0, inStr = false, esc = false, quote = "";
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(text.slice(start, i + 1));
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Deriva un "gancho" (dolor) legible desde el registro de prospección.
function toGancho(o: Record<string, unknown>): string {
  if (typeof o.gancho === "string" && o.gancho.trim()) return o.gancho.trim();
  const p = o.problemas;
  if (Array.isArray(p) && p.length > 0) {
    const first = String(p[0]).trim();
    return first ? first.charAt(0).toLowerCase() + first.slice(1) : "";
  }
  return "";
}

const pick = (o: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

// Parsea texto/HTML pegado y devuelve destinatarios. Primero intenta el array
// estructurado (empresa/ciudad/gancho); luego añade correos sueltos (mailto: y
// regex) que no estuvieran ya. `structured` = cuántos vinieron con datos.
function parseProspects(raw: string): { recips: Recipient[]; structured: number } {
  const out: Recipient[] = [];
  const seen = new Set<string>();
  let structured = 0;

  const arr = extractFirstJsonArray(raw);
  if (arr) {
    for (const o of arr) {
      const email = pick(o, "email", "correo", "mail").toLowerCase();
      if (!isEmail(email) || seen.has(email)) continue;
      seen.add(email);
      out.push({
        email,
        empresa: pick(o, "nombre", "empresa", "name", "corredora"),
        ciudad: pick(o, "ciudad", "city", "comuna"),
        gancho: toGancho(o),
      });
      structured++;
    }
  }

  // Correos sueltos: enlaces mailto: y coincidencias de regex.
  const mailtos = [...raw.matchAll(/mailto:([^"'>\s?]+)/gi)].map((mm) => mm[1]);
  const plains = raw.match(EMAIL_RE) || [];
  for (const cand of [...mailtos, ...plains]) {
    const e = cand.toLowerCase();
    if (!isEmail(e) || seen.has(e)) continue;
    seen.add(e);
    out.push({ email: e, empresa: "", ciudad: "", gancho: "" });
  }

  return { recips: out, structured };
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

  // Diseño del correo
  const [designMode, setDesignMode] = useState<DesignMode>("pro");
  const [titulo, setTitulo] = useState("Que ningún lead de {{empresa}} se vuelva a escapar");
  const [ctaText, setCtaText] = useState("Agendar 10 minutos");
  const [ctaUrl, setCtaUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#003DA5");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerText, setFooterText] = useState(
    "LexHouse · Inteligencia artificial para corredoras de propiedades. Responde este correo y te contactamos.",
  );
  // Botón secundario opcional (contacto directo) + regalo/bonus (lo fijan las plantillas).
  const [cta2Text, setCta2Text] = useState("");
  const [cta2Url, setCta2Url] = useState("");
  const [bonusText, setBonusText] = useState("");
  const [bonusUrl, setBonusUrl] = useState("");

  // Aplica una plantilla de copy (asunto + título + cuerpo + botón + regalo) al composer.
  const applyCopy = (c: EmailCopy) => {
    setSubject(c.subject);
    setTitulo(c.titulo);
    setBody(c.body);
    setCtaText(c.ctaText);
    setCtaUrl(c.ctaUrl);
    setBrandColor(c.brandColor);
    setCta2Text(c.cta2Text ?? "");
    setCta2Url(c.cta2Url ?? "");
    setBonusText(c.bonusText ?? "");
    setBonusUrl(c.bonusUrl ?? "");
    setDesignMode("pro");
    // Los ganchos rotan según la plantilla elegida.
    setActiveGanchos(c.ganchos?.length ? c.ganchos : GANCHOS_DOLOR);
    setGanchoSel("rotar");
    toast({ title: `Plantilla "${c.badge}" cargada`, description: "Asunto, cuerpo, botón, regalo y ganchos afines listos. Revisa y envía." });
  };

  // Compone el HTML de la campaña (plantilla con {{variables}} intactas; la edge las rellena).
  const composeHtml = () =>
    designMode === "pro"
      ? buildProEmail({ fromName, titulo, body, ctaText, ctaUrl, cta2Text, cta2Url, brandColor, logoUrl, footerText, bonusText, bonusUrl })
      : bodyToHtml(body);

  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seguimientoKey, setSeguimientoKey] = useState(0);

  // Si venimos desde "Buscar Leads", precargamos los destinatarios importados.
  useEffect(() => {
    const raw = sessionStorage.getItem("prospeccion_leads_import");
    if (!raw) return;
    sessionStorage.removeItem("prospeccion_leads_import");
    try {
      const imported = JSON.parse(raw);
      if (Array.isArray(imported) && imported.length) {
        const rows: Recipient[] = imported
          .filter((r: Partial<Recipient>) => isEmail(r?.email ?? ""))
          .map((r: Partial<Recipient>) => ({
            email: (r.email ?? "").toLowerCase(),
            empresa: r.empresa ?? "",
            ciudad: r.ciudad ?? "",
            gancho: r.gancho ?? "",
          }));
        if (rows.length) {
          setRecipients(rows);
          toast({ title: `${rows.length} leads cargados`, description: "Vienen del buscador, con empresa/ciudad/gancho. Revisa y envía." });
        }
      }
    } catch {
      /* ignora payload corrupto */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validCount = useMemo(
    () => recipients.filter((r) => isEmail(r.email)).length,
    [recipients],
  );

  // Importa desde el texto/HTML pegado: primero intenta datos estructurados
  // (bloque `const data = [...]` de los HTML de prospección → empresa/ciudad/gancho)
  // y, si no, cae a extraer solo los correos (mailto: + regex). Deduplica.
  const importData = () => {
    const { recips } = parseProspects(rawInput);
    const existing = new Set(recipients.map((r) => r.email.toLowerCase()));
    const nuevos = recips.filter((r) => !existing.has(r.email));
    if (nuevos.length === 0) {
      toast({ title: "Sin correos nuevos", description: "No encontré correos nuevos en el texto/HTML pegado.", variant: "destructive" });
      return;
    }
    setRecipients((prev) => [...prev, ...nuevos]);
    setRawInput("");
    const conDatos = nuevos.filter((r) => r.empresa || r.ciudad || r.gancho).length;
    toast({
      title: `${nuevos.length} destinatario(s) importado(s)`,
      description: conDatos > 0
        ? `${conDatos} con empresa/ciudad/gancho autocompletados desde el HTML. Revisa lo que falte.`
        : "Solo correos detectados. Completa empresa, ciudad y gancho de cada uno.",
    });
  };

  // Gancho de dolor por defecto para leads que no lo traen ("rotar" = varía por lead).
  const [ganchoSel, setGanchoSel] = useState("rotar");
  // Set de ganchos activo: por defecto los generales; al elegir una plantilla, los suyos.
  const [activeGanchos, setActiveGanchos] = useState<string[]>(GANCHOS_DOLOR);

  // Rellena el gancho de los destinatarios que lo tengan vacío (fijo o rotando).
  const rellenarGanchos = () => {
    let rot = 0, filled = 0;
    setRecipients((prev) =>
      prev.map((r) => {
        if ((r.gancho || "").trim()) return r;
        filled++;
        const gancho = ganchoSel === "rotar" ? activeGanchos[rot++ % activeGanchos.length] : ganchoSel;
        return { ...r, gancho };
      }),
    );
    if (filled === 0) {
      toast({ title: "Nada que rellenar", description: "Todos los destinatarios ya tienen un gancho de dolor." });
    } else {
      toast({ title: `${filled} gancho(s) rellenados`, description: ganchoSel === "rotar" ? "Se variaron entre los 9 ganchos. Puedes editarlos en la tabla." : "Puedes editarlos en la tabla." });
    }
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
      // Red de seguridad: ningún correo sale con {{gancho}} vacío.
      let rot = 0;
      const finalRecipients = payloadRecipients.map((r) =>
        (r.gancho || "").trim()
          ? r
          : { ...r, gancho: ganchoSel === "rotar" ? activeGanchos[rot++ % activeGanchos.length] : ganchoSel },
      );
      const { data, error } = await supabase.functions.invoke("send-personalized-campaign", {
        body: {
          fromName, fromEmail,
          replyTo: replyTo.trim() || undefined,
          subject,
          text: body,
          html: composeHtml(),
          recipients: finalRecipients,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.results ?? []);
      setSeguimientoKey((k) => k + 1); // refresca el panel de seguimiento
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

  const previewBase = recipients.find((r) => isEmail(r.email)) || {
    empresa: "Tu Corredora", ciudad: "tu ciudad", gancho: "",
  };
  const previewRow = {
    ...previewBase,
    gancho: (previewBase.gancho || "").trim() || (ganchoSel === "rotar" ? activeGanchos[0] : ganchoSel),
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
          <Label className="text-xs text-muted-foreground">
            Pega el <strong>HTML de prospección</strong> (o cualquier texto/lista con correos). Si detecta los datos
            estructurados, autocompleta <strong>empresa, ciudad y gancho</strong>; si no, extrae solo los correos.
          </Label>
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Pega aquí el HTML de la campaña (p. ej. campana-nexus-inmobiliarias.html) o una lista de correos…"
            rows={4}
            className="font-mono text-[12px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={importData} disabled={!rawInput.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" /> Extraer datos del HTML
            </Button>
            <Button type="button" variant="outline" onClick={addEmptyRow} className="gap-2">
              <UserPlus className="h-4 w-4" /> Añadir fila manual
            </Button>
          </div>

          {recipients.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="min-w-[240px] flex-1 space-y-1.5">
                <Label className="text-xs">Gancho de dolor por defecto (para leads sin gancho)</Label>
                <select
                  value={ganchoSel}
                  onChange={(e) => setGanchoSel(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="rotar">↻ Rotar automáticamente (según la plantilla)</option>
                  {activeGanchos.map((g) => (
                    <option key={g} value={g}>{g.length > 70 ? g.slice(0, 70) + "…" : g}</option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={rellenarGanchos} className="gap-2">
                <Sparkles className="h-4 w-4" /> Rellenar ganchos vacíos
                {recipients.filter((r) => !(r.gancho || "").trim()).length > 0 &&
                  <Badge variant="secondary">{recipients.filter((r) => !(r.gancho || "").trim()).length}</Badge>}
              </Button>
            </div>
          )}

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
                          className={!r.email || isEmail(r.email) ? "" : "border-destructive"} />
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

      {/* Plantillas que convierten (copys especializados con regalo) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[#003DA5]" /> Plantillas que convierten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Copys listos por etapa del embudo. Cada uno ataca un dolor, rota ganchos afines y (según el caso) regala una guía. Un clic carga asunto, cuerpo, botón, regalo y ganchos.
          </p>
          {emailCopyCategorias().map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{cat}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {EMAIL_COPYS.filter((c) => c.categoria === cat).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyCopy(c)}
                    className="group flex flex-col rounded-xl border p-3 text-left transition hover:border-[#003DA5]/50 hover:shadow-sm"
                  >
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: `${c.brandColor}18`, color: c.brandColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.brandColor }} />
                      {c.badge}
                    </span>
                    <span className="mt-2 text-sm font-semibold leading-snug">{c.titulo}</span>
                    <span className="mt-1 text-xs text-muted-foreground">Dolor: {c.dolor}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#003DA5] opacity-0 transition group-hover:opacity-100">
                      <Sparkles className="h-3 w-3" /> Usar esta plantilla
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Diseño del correo */}
      <EmailDesignCard
        userId={user?.id}
        designMode={designMode} setDesignMode={setDesignMode}
        titulo={titulo} setTitulo={setTitulo}
        ctaText={ctaText} setCtaText={setCtaText}
        ctaUrl={ctaUrl} setCtaUrl={setCtaUrl}
        brandColor={brandColor} setBrandColor={setBrandColor}
        logoUrl={logoUrl} setLogoUrl={setLogoUrl}
        footerText={footerText} setFooterText={setFooterText}
      />

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
              {designMode === "pro" ? (
                <iframe
                  title="Vista previa del correo"
                  className="h-[560px] w-full rounded-md border bg-white"
                  srcDoc={fill(composeHtml(), previewRow)}
                />
              ) : (
                <div className="prose prose-sm max-w-none text-[14px] [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: bodyToHtml(fill(body, previewRow)) }} />
              )}
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

      {/* Seguimiento de correos (recibido / abierto / clic vía webhook de Resend) */}
      <CorreoSeguimiento refreshKey={seguimientoKey} />

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
              onClick={() => { setConfirmOpen(false); doSend(recipients.filter((r) => isEmail(r.email)), "Campaña"); }}
            >
              Sí, enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

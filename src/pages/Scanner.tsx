import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScanSearch, Rocket, Trash2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ParsedContact {
  nombre: string;
  telefono: string;
  email: string;
  pais: string;
  fuente: string;
  id_contacto?: string | null;
}

const COUNTRY_PREFIXES: { prefix: string; pais: string }[] = [
  { prefix: "591", pais: "Bolivia" },
  { prefix: "56", pais: "Chile" },
  { prefix: "52", pais: "México" },
  { prefix: "54", pais: "Argentina" },
  { prefix: "51", pais: "Perú" },
  { prefix: "57", pais: "Colombia" },
  { prefix: "34", pais: "España" },
  { prefix: "40", pais: "Rumanía" },
  { prefix: "385", pais: "Croacia" },
  { prefix: "359", pais: "Bulgaria" },
  { prefix: "20", pais: "Egipto" },
  { prefix: "27", pais: "Sudáfrica" },
  { prefix: "7", pais: "Rusia" },
  { prefix: "1", pais: "EEUU" },
];

const COUNTRY_KEYWORDS = ["Bolivia", "Chile", "México", "Mexico", "Argentina", "Perú", "Peru", "Colombia", "España", "Espana", "Rumanía", "Rumania", "Croacia", "Bulgaria", "EEUU", "USA"];

const COUNTRY_FLAGS: Record<string, string> = {
  Bolivia: "🇧🇴", Chile: "🇨🇱", México: "🇲🇽", Mexico: "🇲🇽", Argentina: "🇦🇷",
  Perú: "🇵🇪", Peru: "🇵🇪", Colombia: "🇨🇴", España: "🇪🇸", Espana: "🇪🇸",
  Rumanía: "🇷🇴", Rumania: "🇷🇴", Croacia: "🇭🇷", Bulgaria: "🇧🇬",
  EEUU: "🇺🇸", USA: "🇺🇸", Egipto: "🇪🇬", Sudáfrica: "🇿🇦", Rusia: "🇷🇺",
  Desconocido: "🌍",
};

const STATUS_WORDS = new Set(["nuevo", "contactado", "sin", "definir", "seguimiento", "finalizada", "meet", "llamar", "cerrado", "activo", "inactivo", "respondió", "respondio"]);

function inferCountryByPhone(digits: string): string | null {
  for (const { prefix, pais } of COUNTRY_PREFIXES) {
    if (digits.startsWith(prefix)) return pais;
  }
  return null;
}

function inferCountryByText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const k of COUNTRY_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return k;
  }
  return null;
}

function capitalize(s: string): string {
  return s.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

const WEBHOOK_URL = "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/primer_contacto";

const normPhone = (p: string) => (p || "").replace(/\D/g, "");

export default function Scanner() {
  const [rawText, setRawText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"" | "syncing" | "importing">("");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const parseContacts = () => {
    const fuente = fileName
      ? (/\.(xlsx|xls)$/i.test(fileName) ? "excel" : /\.csv$/i.test(fileName) ? "csv" : "texto")
      : "texto";

    const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
    const phoneRe = /(?:\+|00)?[\d\s().\-]{7,}/g;

    const rawLines = rawText.split("\n");
    const parsed: ParsedContact[] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (line.length < 6) continue;
      if (/^[-=._\s]+$/.test(line)) continue;

      const emailMatch = line.match(emailRe);
      const email = emailMatch ? emailMatch[0] : "";

      let bestDigits = "";
      let bestStartsPlus = false;
      const matches = line.match(phoneRe) || [];
      for (const m of matches) {
        const trimmed = m.trim();
        const startsPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
        const digits = trimmed.replace(/\D/g, "");
        if (digits.length < 7) continue;
        if (digits.length > bestDigits.length) {
          bestDigits = digits;
          bestStartsPlus = startsPlus;
        }
      }
      if (!bestDigits) continue;

      let telefono = bestStartsPlus ? "+" + bestDigits.replace(/^0+/, "") : "+" + bestDigits;
      const digitsOnly = telefono.replace(/\D/g, "");
      const pais =
        inferCountryByPhone(digitsOnly) ||
        inferCountryByText(line) ||
        "Desconocido";

      const cleaned = line.replace(emailRe, " ").replace(phoneRe, " ");
      const tokens = cleaned
        .split(/[,;\t|]+|\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !/^\+?\d+$/.test(t))
        .filter((t) => !STATUS_WORDS.has(t.toLowerCase()))
        .filter((t) => !COUNTRY_KEYWORDS.some((k) => k.toLowerCase() === t.toLowerCase()));

      let nombre = capitalize(tokens.join(" ")).slice(0, 60).trim();
      if (!nombre) nombre = "Sin nombre";

      parsed.push({ nombre, telefono, email, pais, fuente, id_contacto: null });
    }

    const seen = new Set<string>();
    const unique: ParsedContact[] = [];
    let duplicates = 0;
    for (const c of parsed) {
      const key = c.telefono.replace(/\D/g, "");
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      unique.push(c);
    }

    setContacts(unique);
    toast({
      title: "Contactos procesados",
      description: `${unique.length} contactos detectados${duplicates ? ` · ${duplicates} duplicados eliminados` : ""}.`,
    });
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const lines = rows
          .filter((r) => r.some((c) => String(c).trim()))
          .map((r) => r.map((c) => String(c).trim()).join(", "));
        setRawText(lines.join("\n"));
      } else {
        const text = await file.text();
        setRawText(text);
      }
    } catch (err: any) {
      toast({ title: "Error al leer archivo", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const launchCampaign = async () => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
      return;
    }
    if (!campaignName.trim() || contacts.length === 0) {
      toast({ title: "Error", description: "Nombre de campaña y contactos son requeridos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setLoadingStage("syncing");
    try {
      // a/b. Fetch all leads from Google Sheets to build lookup maps
      const emailMap = new Map<string, string>();
      const phoneMap = new Map<string, string>();
      try {
        const { data: sheetsData, error: sheetsErr } = await supabase.functions.invoke("sheets-leads", {
          body: {},
        });
        if (sheetsErr) throw sheetsErr;
        const leads: any[] = sheetsData?.leads || [];
        for (const l of leads) {
          const id = (l.id_contacto || "").toString().trim();
          if (!id) continue;
          const em = (l.email || "").toString().trim().toLowerCase();
          const ph = normPhone(l.telefono || "");
          if (em && !emailMap.has(em)) emailMap.set(em, id);
          if (ph && !phoneMap.has(ph)) phoneMap.set(ph, id);
        }
      } catch (err: any) {
        console.warn("sheets-leads enrichment failed:", err);
        toast({
          title: "Aviso",
          description: "No se pudieron sincronizar IDs desde Google Sheets. Continuando sin enriquecimiento.",
        });
      }

      // c. Enrich contacts with id_contacto
      const enriched = contacts.map((c) => {
        const em = (c.email || "").trim().toLowerCase();
        const ph = normPhone(c.telefono);
        const id = (em && emailMap.get(em)) || (ph && phoneMap.get(ph)) || null;
        return { ...c, id_contacto: id };
      });
      const matchedCount = enriched.filter((c) => c.id_contacto).length;
      setContacts(enriched);

      setLoadingStage("importing");

      // d. Upsert into leads_escaner
      const rows = enriched.map((c) => ({
        id_contacto: c.id_contacto,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email || null,
        campaign_name: campaignName,
        message_template: messageTemplate || null,
        archivo_origen: fileName || null,
        estado: "nuevo",
        user_id: user.id,
      }));

      const { error: escanerError } = await supabase
        .from("leads_escaner")
        .upsert(rows, { onConflict: "telefono,campaign_name", ignoreDuplicates: true });
      if (escanerError) throw escanerError;

      // e. Create campaign record
      const { error: campError } = await supabase.from("lead_recovery_campaigns").insert({
        user_id: user.id,
        campaign_name: campaignName,
        status: "executing",
        channel: "whatsapp",
        message_template_whatsapp: messageTemplate || null,
        total_leads: enriched.length,
      });
      if (campError) throw campError;

      // f. Fire-and-forget webhook (via authenticated edge function proxy)
      supabase.functions.invoke("send-n8n-webhook", {
        body: {
          target: "primer_contacto",
          payload: {
            user_id: user.id,
            user_email: user.email,
            campaign_name: campaignName,
            message_template: messageTemplate,
            total_contacts: enriched.length,
            contacts: enriched,
            archivo_origen: fileName || null,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch((err) => console.warn("Webhook primer_contacto failed:", err));

      toast({
        title: "¡Campaña lanzada!",
        description: `${enriched.length} contactos importados (${matchedCount} con ID de hoja).`,
      });
      setRawText("");
      setCampaignName("");
      setMessageTemplate("");
      setContacts([]);
      setFileName("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const launchLabel = loadingStage === "syncing"
    ? "Sincronizando IDs..."
    : loadingStage === "importing"
    ? "Importando..."
    : "Lanzar Campaña";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ScanSearch className="h-6 w-6 text-accent" />
        <h2 className="text-2xl font-bold text-foreground">Escáner de Contactos</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de Campaña</CardTitle>
            <CardDescription>Nombra tu campaña y pega los contactos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de Campaña</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ej: Recuperación Q2 2026" />
            </div>
            <div className="space-y-2">
              <Label>Plantilla de Mensaje (WhatsApp)</Label>
              <Textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} placeholder="Hola {nombre}, te contactamos de Realtyplus..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Pegar Contactos (nombre, teléfono, email por línea)</Label>
              <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Juan Pérez, +5491112345678, juan@email.com&#10;María López, +5491198765432" rows={6} />
            </div>
            <div className="space-y-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <Upload className="mr-2 h-4 w-4" /> Subir archivo
              </Button>
              {fileName && <p className="text-xs text-muted-foreground">Archivo: {fileName}</p>}
            </div>
            <div className="flex gap-3">
              <Button onClick={parseContacts} variant="secondary" className="flex-1" disabled={loading}>
                <ScanSearch className="mr-2 h-4 w-4" /> Procesar
              </Button>
              <Button onClick={launchCampaign} disabled={contacts.length === 0 || loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                {launchLabel}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contactos Detectados ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Pega texto y presiona "Procesar" para detectar contactos.</p>
            ) : (
              <>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>ID Hoja</TableHead>
                        <TableHead>País</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nombre}</TableCell>
                          <TableCell>{c.telefono}</TableCell>
                          <TableCell>{c.email}</TableCell>
                          <TableCell className="font-mono text-xs">{c.id_contacto || "—"}</TableCell>
                          <TableCell>
                            <span className="mr-1">{COUNTRY_FLAGS[c.pais] || "🌍"}</span>
                            <span className="text-xs">{c.pais}</span>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeContact(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="secondary">Total: {contacts.length}</Badge>
                  <Badge variant="secondary">Con email: {contacts.filter((c) => c.email).length}</Badge>
                  <Badge variant="secondary">Sin email: {contacts.filter((c) => !c.email).length}</Badge>
                  <Badge variant="secondary">Países únicos: {new Set(contacts.map((c) => c.pais)).size}</Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

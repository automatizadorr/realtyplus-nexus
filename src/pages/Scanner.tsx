import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanSearch, Rocket, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ParsedContact {
  nombre: string;
  telefono: string;
  email: string;
}

const WEBHOOK_URL = "https://lex-house-ai-n8n.7u9ufb.easypanel.host/webhook/primer_contacto";

export default function Scanner() {
  const [rawText, setRawText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const parseContacts = () => {
    const lines = rawText.split("\n").filter((l) => l.trim());
    const parsed: ParsedContact[] = lines.map((line) => {
      const parts = line.split(/[,;\t]+/).map((p) => p.trim());
      const phoneMatch = parts.find((p) => /\+?\d{7,}/.test(p.replace(/\s/g, "")));
      const emailMatch = parts.find((p) => /@/.test(p));
      const nombre = parts.find((p) => p !== phoneMatch && p !== emailMatch) || "";
      return {
        nombre,
        telefono: phoneMatch?.replace(/\s/g, "") || "",
        email: emailMatch || "",
      };
    });
    setContacts(parsed.filter((c) => c.telefono));
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
    try {
      const { error: campError } = await supabase
        .from("lead_recovery_campaigns")
        .insert({
          user_id: user.id,
          campaign_name: campaignName,
          status: "executing",
          channel: "whatsapp",
          message_template_whatsapp: messageTemplate || null,
          total_leads: contacts.length,
        });

      if (campError) throw campError;

      const leads = contacts.map((c) => ({
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email || null,
        estado: "nuevo",
      }));

      const { error: leadsError } = await supabase.from("leads_campana").insert(leads);
      if (leadsError) throw leadsError;

      // Fire-and-forget webhook notification
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          user_email: user.email,
          campaign_name: campaignName,
          message_template: messageTemplate,
          total_contacts: contacts.length,
          contacts,
          file_name: fileName || null,
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) => console.error("Webhook primer_contacto failed:", err));

      toast({ title: "¡Campaña lanzada!", description: `${contacts.length} contactos importados.` });
      setRawText("");
      setCampaignName("");
      setMessageTemplate("");
      setContacts([]);
      setFileName("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
              <Button onClick={parseContacts} variant="secondary" className="flex-1">
                <ScanSearch className="mr-2 h-4 w-4" /> Procesar
              </Button>
              <Button onClick={launchCampaign} disabled={contacts.length === 0 || loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                <Rocket className="mr-2 h-4 w-4" /> Lanzar Campaña
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
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.nombre}</TableCell>
                        <TableCell>{c.telefono}</TableCell>
                        <TableCell>{c.email}</TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

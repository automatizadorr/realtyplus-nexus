import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanSearch, Rocket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ParsedContact {
  nombre: string;
  telefono: string;
  email: string;
}

export default function Scanner() {
  const [rawText, setRawText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(false);
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
      // 1. Create campaign with correct column names
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

      // 2. Insert leads into leads_campana
      const leads = contacts.map((c) => ({
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email || null,
        estado: "nuevo",
      }));

      const { error: leadsError } = await supabase.from("leads_campana").insert(leads);
      if (leadsError) throw leadsError;

      toast({ title: "¡Campaña lanzada!", description: `${contacts.length} contactos importados.` });
      setRawText("");
      setCampaignName("");
      setMessageTemplate("");
      setContacts([]);
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

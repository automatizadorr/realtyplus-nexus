import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Rocket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  pais: string | null;
  estado: string | null;
  bot_activo: boolean | null;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateCampaignDialog({ open, onOpenChange, onCreated }: CreateCampaignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [campaignName, setCampaignName] = useState("");
  const [channel, setChannel] = useState("whatsapp_email");
  const [templateWhatsapp, setTemplateWhatsapp] = useState("");
  const [templateEmail, setTemplateEmail] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterPais, setFilterPais] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLeads();
      // Reset form
      setCampaignName("");
      setChannel("whatsapp_email");
      setTemplateWhatsapp("");
      setTemplateEmail("");
      setSubjectEmail("");
      setSelectedIds(new Set());
      setSearchQuery("");
      setFilterEstado("all");
      setFilterPais("all");
    }
  }, [open]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    const { data, error } = await supabase
      .from("leads_campana")
      .select("id, nombre, telefono, email, pais, estado, bot_activo")
      .order("nombre");
    if (!error && data) setLeads(data);
    setLoadingLeads(false);
  };

  const estados = useMemo(() => [...new Set(leads.map(l => l.estado).filter(Boolean))], [leads]);
  const paises = useMemo(() => [...new Set(leads.map(l => l.pais).filter(Boolean))], [leads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !searchQuery ||
        l.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.telefono.includes(searchQuery) ||
        (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchEstado = filterEstado === "all" || l.estado === filterEstado;
      const matchPais = filterPais === "all" || l.pais === filterPais;
      return matchSearch && matchEstado && matchPais;
    });
  }, [leads, searchQuery, filterEstado, filterPais]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  };

  const handleLaunch = async () => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
      return;
    }
    if (!campaignName.trim() || selectedIds.size === 0) {
      toast({ title: "Error", description: "Nombre y al menos un contacto son requeridos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("lead_recovery_campaigns")
        .insert({
          user_id: user.id,
          campaign_name: campaignName.trim(),
          channel,
          total_leads: selectedIds.size,
          status: "executing",
          message_template_whatsapp: templateWhatsapp || null,
          message_template_email: templateEmail || null,
          subject_email: subjectEmail || null,
          target_filters: { lead_ids: Array.from(selectedIds) },
        });

      if (error) throw error;

      toast({ title: "¡Campaña creada!", description: `${selectedIds.size} contactos seleccionados.` });
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-accent" /> Nueva Campaña
          </DialogTitle>
          <DialogDescription>Configura tu campaña y selecciona los contactos</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Campaign config */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de Campaña *</Label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ej: Recuperación Q2 2026" />
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">Solo WhatsApp</SelectItem>
                  <SelectItem value="email">Solo Email</SelectItem>
                  <SelectItem value="whatsapp_email">WhatsApp + Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(channel === "whatsapp" || channel === "whatsapp_email") && (
              <div className="space-y-2">
                <Label>Plantilla WhatsApp</Label>
                <Textarea value={templateWhatsapp} onChange={e => setTemplateWhatsapp(e.target.value)} placeholder="Hola {nombre}, te contactamos..." rows={3} />
              </div>
            )}
            {(channel === "email" || channel === "whatsapp_email") && (
              <>
                <div className="space-y-2">
                  <Label>Asunto Email</Label>
                  <Input value={subjectEmail} onChange={e => setSubjectEmail(e.target.value)} placeholder="Oportunidad de inversión" />
                </div>
                <div className="space-y-2">
                  <Label>Plantilla Email</Label>
                  <Textarea value={templateEmail} onChange={e => setTemplateEmail(e.target.value)} placeholder="Estimado/a {nombre}..." rows={3} />
                </div>
              </>
            )}
          </div>

          {/* Right: Contact selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                <Users className="h-4 w-4" /> Contactos
              </Label>
              <Badge variant="secondary">{selectedIds.size} seleccionados</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar nombre, teléfono o email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {estados.map(e => <SelectItem key={e} value={e!}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPais} onValueChange={setFilterPais}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="País" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los países</SelectItem>
                  {paises.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">
                Seleccionar todos ({filtered.length})
              </span>
            </div>

            <ScrollArea className="h-[240px] border rounded-md">
              {loadingLeads ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Cargando contactos...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No se encontraron contactos.</p>
              ) : (
                <div className="divide-y">
                  {filtered.map(lead => (
                    <label key={lead.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.telefono} {lead.email ? `· ${lead.email}` : ""}</p>
                      </div>
                      {lead.pais && <Badge variant="outline" className="text-[10px] shrink-0">{lead.pais}</Badge>}
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleLaunch} disabled={loading || selectedIds.size === 0 || !campaignName.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Rocket className="mr-2 h-4 w-4" />
            {loading ? "Creando..." : `Lanzar Campaña (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

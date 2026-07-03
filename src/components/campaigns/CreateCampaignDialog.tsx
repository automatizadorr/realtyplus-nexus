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
  id_contacto: string | null;
  dias_reales: number | null;
  tag_ids: string[] | null;
}

interface Tag {
  id: string;
  nombre: string;
  color: string | null;
}

const normPhone = (p: string) => ((p || "").split("/")[0].trim()).replace(/\D/g, "");

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
  const [filterTag, setFilterTag] = useState("all");
  const [tags, setTags] = useState<Tag[]>([]);
  const [contactFilter, setContactFilter] = useState<"all" | "contacted" | "uncontacted">("all");
  const [idFilter, setIdFilter] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [contactedSet, setContactedSet] = useState<Set<string>>(new Set());
  const [contactedLoaded, setContactedLoaded] = useState(false);
  const [loadingContacted, setLoadingContacted] = useState(false);
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
      setFilterTag("all");
      setContactFilter("all");
      setIdFilter("");
      setMinDays("");
      setMaxDays("");
      setContactedSet(new Set());
      setContactedLoaded(false);
    }
  }, [open]);

  // Carga diferida del set de contactados solo cuando el filtro lo necesita.
  useEffect(() => {
    if (open && contactFilter !== "all" && !contactedLoaded && !loadingContacted) {
      fetchContactedSet();
    }
  }, [open, contactFilter, contactedLoaded, loadingContacted]);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    const [{ data, error }, tagsRes] = await Promise.all([
      supabase
        .from("leads_campana")
        .select("id, nombre, telefono, email, pais, estado, bot_activo, id_contacto, dias_reales, tag_ids")
        .order("nombre"),
      supabase
        .from("lead_tags")
        .select("id, nombre, color")
        .order("nombre"),
    ]);
    if (!error && data) setLeads(data as Lead[]);
    if (tagsRes.data) setTags(tagsRes.data as Tag[]);
    setLoadingLeads(false);
  };

  // El set de "contactados" (mensajes_whatsapp outbound) es pesado, así que solo
  // se carga la primera vez que el usuario usa el filtro de contactados.
  const fetchContactedSet = async () => {
    setLoadingContacted(true);
    const { data } = await supabase
      .from("mensajes_whatsapp")
      .select("telefono")
      .eq("direccion", "outbound")
      .limit(50000);
    if (data) {
      setContactedSet(new Set(data.map((m: any) => normPhone(m.telefono)).filter(Boolean)));
    }
    setContactedLoaded(true);
    setLoadingContacted(false);
  };

  const estados = useMemo(() => [...new Set(leads.map(l => l.estado).filter(Boolean))], [leads]);
  const paises = useMemo(() => [...new Set(leads.map(l => l.pais).filter(Boolean))], [leads]);

  const filtered = useMemo(() => {
    const min = minDays === "" ? null : Number(minDays);
    const max = maxDays === "" ? null : Number(maxDays);
    return leads.filter(l => {
      const matchSearch = !searchQuery ||
        l.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.telefono.includes(searchQuery) ||
        (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchEstado = filterEstado === "all" || l.estado === filterEstado;
      const matchPais = filterPais === "all" || l.pais === filterPais;
      const matchTag = filterTag === "all" || (l.tag_ids || []).includes(filterTag);
      const matchId = !idFilter || (l.id_contacto || "").toLowerCase().includes(idFilter.toLowerCase());
      const isContacted = contactedSet.has(normPhone(l.telefono));
      const matchContact =
        contactFilter === "all" ||
        (contactFilter === "contacted" && isContacted) ||
        (contactFilter === "uncontacted" && !isContacted);
      const dias = l.dias_reales ?? 0;
      const matchMin = min === null || dias >= min;
      const matchMax = max === null || dias <= max;
      return matchSearch && matchEstado && matchPais && matchTag && matchId && matchContact && matchMin && matchMax;
    });
  }, [leads, searchQuery, filterEstado, filterPais, filterTag, idFilter, contactFilter, contactedSet, minDays, maxDays]);

  // Solo renderizamos un máximo de filas en el DOM para no congelar el navegador
  // con miles de contactos. El total filtrado sigue disponible para contador,
  // "seleccionar todos" y el lanzamiento de la campaña.
  const MAX_VISIBLE = 200;
  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE), [filtered]);

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
      const selectedLeads = leads.filter(l => selectedIds.has(l.id));
      const targetFilters = {
        lead_ids: Array.from(selectedIds),
        estado: filterEstado,
        pais: filterPais,
        tag_id: filterTag === "all" ? null : filterTag,
        contacto: contactFilter,
        id_contacto: idFilter || null,
        min_dias: minDays === "" ? null : Number(minDays),
        max_dias: maxDays === "" ? null : Number(maxDays),
        search: searchQuery || null,
      };

      // 1) Save campaign in Supabase
      const { data: inserted, error } = await supabase
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
          target_filters: targetFilters,
        })
        .select()
        .single();

      if (error) throw error;

      // 2) Enriquecer los leads seleccionados con datos de Sheet4
      let sheetLeads: any[] = [];
      try {
        const { data: sheetData, error: sheetErr } = await supabase.functions.invoke("sheets-leads", { body: {} });
        if (sheetErr) throw sheetErr;
        if (sheetData?.success) sheetLeads = sheetData.leads || [];
      } catch (e) { console.warn("sheets-leads:", e); }

      const sheetByExact  = new Map<string, any>();
      const sheetBySuffix = new Map<string, any>();
      for (const l of sheetLeads) {
        const ph = normPhone(l.telefono || "");
        if (!ph) continue;
        if (!sheetByExact.has(ph))  sheetByExact.set(ph, l);
        if (ph.length >= 8) { const s = ph.slice(-8); if (!sheetBySuffix.has(s)) sheetBySuffix.set(s, l); }
      }
      const findSheet = (tel: string) => {
        const ph = normPhone(tel);
        return sheetByExact.get(ph) ?? (ph.length >= 8 ? sheetBySuffix.get(ph.slice(-8)) : null) ?? null;
      };

      // sheet.leads = solo los leads seleccionados, enriquecidos con Sheet4
      const webhookLeads = selectedLeads.map((l) => {
        const sl = findSheet(l.telefono || "");
        const partes = (l.nombre || "").trim().split(/\s+/);
        return {
          id_contacto: sl?.id_contacto || l.id_contacto || null,
          nombres:     sl?.nombres     || partes[0]      || "",
          apellidos:   sl?.apellidos   || partes.slice(1).join(" "),
          email:       sl?.email       || l.email         || "",
          telefono:    l.telefono      || "",
          pais:        sl?.pais        || l.pais          || "",
          dias_transcurridos: sl?.dias_transcurridos != null ? Number(sl.dias_transcurridos) : 1,
        };
      });

      // 3) Enviar al webhook solo los leads seleccionados
      const paisWebhook = webhookLeads[0]?.pais || (targetFilters as any)?.pais || "";
      try {
        const { error: whErr } = await supabase.functions.invoke("send-n8n-webhook", {
          body: {
            target: "campanas_segmentadas",
            payload: {
              campaign_id:               inserted?.id,
              campaign_name:             campaignName.trim(),
              channel,
              status:                    "executing",
              total_leads:               webhookLeads.length,
              message_template_whatsapp: templateWhatsapp || null,
              message_template_email:    templateEmail    || null,
              subject_email:             subjectEmail     || null,
              target_filters:            targetFilters,
              sheet: {
                pais:  paisWebhook,
                total: webhookLeads.length,
                leads: webhookLeads,
              },
              triggered_at: new Date().toISOString(),
            },
          },
        });
        if (whErr) throw whErr;
        toast({ title: "¡Campaña lanzada!", description: `${webhookLeads.length} leads enviados al webhook.` });
      } catch (whErr: any) {
        console.warn("Webhook n8n falló:", whErr);
        toast({ title: "Campaña creada (sin webhook)", description: whErr.message, variant: "destructive" });
      }

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

            {tags.length > 0 && (
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Etiqueta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las etiquetas</SelectItem>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color || "#888" }} />
                        {t.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Select value={contactFilter} onValueChange={(v: any) => setContactFilter(v)}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="uncontacted">Sin contactar</SelectItem>
                  <SelectItem value="contacted">Contactados</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="flex-1 h-8 text-xs"
                placeholder="ID contacto"
                value={idFilter}
                onChange={e => setIdFilter(e.target.value)}
              />
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground shrink-0">Días:</span>
              <Input
                type="number"
                className="flex-1 h-8 text-xs"
                placeholder="Min"
                value={minDays}
                onChange={e => setMinDays(e.target.value)}
              />
              <Input
                type="number"
                className="flex-1 h-8 text-xs"
                placeholder="Max"
                value={maxDays}
                onChange={e => setMaxDays(e.target.value)}
              />
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
              {loadingLeads || loadingContacted ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Cargando contactos...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No se encontraron contactos.</p>
              ) : (
                <div className="divide-y">
                  {visible.map(lead => (
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
            {!loadingLeads && !loadingContacted && filtered.length > MAX_VISIBLE && (
              <p className="text-[11px] text-muted-foreground text-center">
                Mostrando {MAX_VISIBLE} de {filtered.length}. Usa los filtros o la búsqueda para acotar.
                Puedes seleccionar todos ({filtered.length}) igualmente.
              </p>
            )}
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

import { useEffect, useState } from "react";
import { Loader2, MapPin, Mail as MailIcon, MessageCircle, ArchiveRestore } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadCampana } from "@/components/vendedor/types";

const COLUMNAS = "id, nombre, telefono, email, pais, etapa_venta, fecha_asignacion";

export default function ArchivadosDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadCampana[]>([]);
  const [loading, setLoading] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads_campana")
      .select(COLUMNAS)
      .eq("archivado", true)
      .order("fecha_asignacion", { ascending: false });
    if (error) toast({ title: "Error al cargar archivados", description: error.message, variant: "destructive" });
    else setLeads((data ?? []) as LeadCampana[]);
    setLoading(false);
  };

  useEffect(() => { if (open) cargar(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const desarchivar = async (leadId: string) => {
    setRestaurando(leadId);
    const { error } = await supabase.rpc("vendedor_archivar_lead", { _lead_id: leadId, _archivado: false });
    setRestaurando(null);
    if (error) { toast({ title: "No se pudo desarchivar", description: error.message, variant: "destructive" }); return; }
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    toast({ title: "Lead restaurado al pipeline" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leads archivados</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No tienes leads archivados.
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <Card key={l.id}>
                <CardContent className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm font-medium">{l.nombre || "—"}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      {l.pais && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {l.pais}</span>}
                    </div>
                    {(l.telefono || l.email) && (
                      <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        {l.telefono && <div className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5 text-emerald-600" /> {l.telefono}</div>}
                        {l.email && <div className="flex items-center gap-1"><MailIcon className="h-2.5 w-2.5" /> {l.email}</div>}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button" size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                    disabled={restaurando === l.id}
                    onClick={() => desarchivar(l.id)}
                  >
                    {restaurando === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}
                    Desarchivar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Clock,
  Tag as TagIcon,
  RefreshCw,
  Mic,
  User,
  FileText,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVoiceLeads, type VoiceLead } from "@/hooks/use-voice-leads";

type ColKey = "nuevo" | "contactado" | "reunion" | "cierre";

const COLUMNS: { key: ColKey; label: string; color: string; accent: string }[] = [
  { key: "nuevo", label: "Nuevo", color: "from-sky-500/15 to-sky-500/5", accent: "bg-sky-500" },
  { key: "contactado", label: "Contactado", color: "from-amber-500/15 to-amber-500/5", accent: "bg-amber-500" },
  { key: "reunion", label: "Reunión", color: "from-violet-500/15 to-violet-500/5", accent: "bg-violet-500" },
  { key: "cierre", label: "Cierre", color: "from-emerald-500/15 to-emerald-500/5", accent: "bg-emerald-500" },
];

function normalizeStatus(s: string): ColKey {
  const v = (s || "").toLowerCase().trim();
  if (["contactado", "contacted"].includes(v)) return "contactado";
  if (["reunion", "reunión", "meeting"].includes(v)) return "reunion";
  if (["cierre", "ganado", "won", "closed"].includes(v)) return "cierre";
  return "nuevo";
}

export default function VoiceCrm() {
  const { leads, loading, error, refetch, updateStatus } = useVoiceLeads();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<ColKey | null>(null);
  const [detail, setDetail] = useState<VoiceLead | null>(null);

  const grouped = useMemo(() => {
    const g: Record<ColKey, VoiceLead[]> = { nuevo: [], contactado: [], reunion: [], cierre: [] };
    leads.forEach((l) => g[normalizeStatus(l.status)].push(l));
    return g;
  }, [leads]);

  const handleDrop = async (col: ColKey) => {
    setHoverCol(null);
    if (!dragging) return;
    const lead = leads.find((l) => l.telefono === dragging);
    setDragging(null);
    if (!lead) return;
    if (normalizeStatus(lead.status) === col) return;
    try {
      await updateStatus(lead.telefono, col);
      toast.success(`Movido a ${col}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gradient-to-br from-background to-muted/20">
      <header className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#003366] to-[#cc0000] flex items-center justify-center shadow-lg">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CRM Agente de Voz</h1>
            <p className="text-xs text-muted-foreground">
              Leads capturados por Licia-AI · {leads.length} contactos
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </header>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-x-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-w-[800px] xl:min-w-0 h-full">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverCol(col.key);
              }}
              onDragLeave={() => setHoverCol((c) => (c === col.key ? null : c))}
              onDrop={() => handleDrop(col.key)}
              className={`flex flex-col rounded-2xl border bg-gradient-to-b ${col.color} transition-all ${
                hoverCol === col.key ? "ring-2 ring-primary scale-[1.01]" : ""
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.accent}`} />
                  <h2 className="font-semibold text-sm uppercase tracking-wide">{col.label}</h2>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {grouped[col.key].length}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
                <AnimatePresence>
                  {grouped[col.key].map((lead) => (
                    <motion.div
                      key={lead.telefono + lead.row}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable
                      onDragStart={() => setDragging(lead.telefono)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setDetail(lead)}
                      className={`group cursor-grab active:cursor-grabbing rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-all ${
                        dragging === lead.telefono ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <p className="font-semibold text-sm truncate">
                              {lead.nombre || "Sin nombre"}
                            </p>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {lead.telefono && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3" />
                                <span className="truncate">{lead.telefono}</span>
                              </div>
                            )}
                            {lead.ubicacion && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{lead.ubicacion}</span>
                              </div>
                            )}
                            {lead.presupuesto && (
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" />
                                <span className="truncate">{lead.presupuesto}</span>
                              </div>
                            )}
                          </div>
                          {(lead.tipo_interes || lead.modelo_franquicia) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {lead.tipo_interes && (
                                <Badge variant="outline" className="text-[10px] py-0 h-5">
                                  {lead.tipo_interes}
                                </Badge>
                              )}
                              {lead.modelo_franquicia && (
                                <Badge variant="outline" className="text-[10px] py-0 h-5 border-[#cc0000]/30 text-[#cc0000]">
                                  {lead.modelo_franquicia}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {grouped[col.key].length === 0 && !loading && (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    Sin leads
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#003366]" />
              {detail?.nombre}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow icon={Phone} label="Teléfono" value={detail.telefono} />
                <InfoRow icon={Mail} label="Email" value={detail.email} />
                <InfoRow icon={MapPin} label="Ubicación" value={detail.ubicacion} />
                <InfoRow icon={DollarSign} label="Presupuesto" value={detail.presupuesto} />
                <InfoRow icon={TagIcon} label="Tipo interés" value={detail.tipo_interes} />
                <InfoRow icon={TagIcon} label="Franquicia" value={detail.modelo_franquicia} />
                <InfoRow icon={TagIcon} label="Propósito" value={detail.proposito} />
                <InfoRow icon={Clock} label="Horario" value={detail.horario} />
              </div>
              {detail.resumen && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Resumen de conversación
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{detail.resumen}</p>
                </div>
              )}
              {detail.informe && (
                <details className="rounded-lg border bg-muted/30 p-3">
                  <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">
                    Ver informe completo
                  </summary>
                  <pre className="text-xs mt-2 whitespace-pre-wrap font-mono">{detail.informe}</pre>
                </details>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {COLUMNS.map((c) => (
                  <Button
                    key={c.key}
                    size="sm"
                    variant={normalizeStatus(detail.status) === c.key ? "default" : "outline"}
                    onClick={async () => {
                      try {
                        await updateStatus(detail.telefono, c.key);
                        setDetail({ ...detail, status: c.key });
                        toast.success(`Movido a ${c.label}`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Error");
                      }
                    }}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate">{value}</p>
      </div>
    </div>
  );
}

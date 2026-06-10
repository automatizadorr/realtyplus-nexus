import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScanSearch, Tags, Mic, BotMessageSquare, Loader2 } from "lucide-react";
import { useVoiceLeads } from "@/hooks/use-voice-leads";

type ScannerLead = {
  id: string;
  nombre: string;
  apellidos: string | null;
  telefono: string;
  email: string | null;
  pais: string | null;
  estado: string;
  campaign_name: string;
  created_at: string;
};

type TagRow = { id: string; nombre: string; color: string };
type LeadTagged = { id: string; nombre: string; telefono: string; tag_ids: string[] | null };

type AIContact = {
  telefono: string;
  nombre: string | null;
  pais: string | null;
  campaign_name: string | null;
  last_at: string;
  count: number;
};

type DialogKind = null | "scanner" | "tags" | "voice" | "ai";

export default function NewStatsSection() {
  const [scanner, setScanner] = useState<ScannerLead[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [taggedLeads, setTaggedLeads] = useState<LeadTagged[]>([]);
  const [aiContacts, setAiContacts] = useState<AIContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const { leads: voiceLeads, loading: voiceLoading } = useVoiceLeads();

  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes, lRes, mRes] = await Promise.all([
          supabase
            .from("leads_escaner")
            .select("id, nombre, apellidos, telefono, email, pais, estado, campaign_name, created_at")
            .order("created_at", { ascending: false })
            .limit(5000),
          supabase.from("lead_tags").select("id, nombre, color"),
          supabase.from("leads_campana").select("id, nombre, telefono, tag_ids").limit(10000),
          supabase
            .from("mensajes_automatizacion")
            .select("telefono, nombre, pais, campaign_name, created_at, direccion")
            .eq("direccion", "outbound")
            .order("created_at", { ascending: false })
            .limit(10000),
        ]);
        setScanner((sRes.data ?? []) as ScannerLead[]);
        setTags((tRes.data ?? []) as TagRow[]);
        setTaggedLeads((lRes.data ?? []) as LeadTagged[]);

        const map = new Map<string, AIContact>();
        (mRes.data ?? []).forEach((m: any) => {
          if (!m.telefono) return;
          const cur = map.get(m.telefono);
          if (cur) {
            cur.count++;
            if (m.created_at > cur.last_at) cur.last_at = m.created_at;
          } else {
            map.set(m.telefono, {
              telefono: m.telefono,
              nombre: m.nombre,
              pais: m.pais,
              campaign_name: m.campaign_name,
              last_at: m.created_at,
              count: 1,
            });
          }
        });
        setAiContacts(Array.from(map.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tagStats = useMemo(() => {
    return tags.map((t) => {
      const leads = taggedLeads.filter((l) => l.tag_ids?.includes(t.id));
      return { ...t, count: leads.length, leads };
    }).sort((a, b) => b.count - a.count);
  }, [tags, taggedLeads]);

  const totalTagged = useMemo(
    () => taggedLeads.filter((l) => (l.tag_ids?.length ?? 0) > 0).length,
    [taggedLeads],
  );

  const cards = [
    {
      key: "scanner" as const,
      title: "Leads Escáner",
      value: scanner.length,
      icon: ScanSearch,
      accent: "text-fuchsia-600",
      bg: "bg-fuchsia-50 dark:bg-fuchsia-950",
      subtitle: `${new Set(scanner.map((s) => s.campaign_name)).size} campañas`,
    },
    {
      key: "tags" as const,
      title: "Leads Etiquetados",
      value: totalTagged,
      icon: Tags,
      accent: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950",
      subtitle: `${tags.length} etiquetas`,
    },
    {
      key: "voice" as const,
      title: "CRM Realty Web-AI",
      value: voiceLeads.length,
      icon: Mic,
      accent: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950",
      subtitle: voiceLoading ? "Cargando..." : `${voiceLeads.filter((v) => v.status === "cierre").length} cierres`,
    },
    {
      key: "ai" as const,
      title: "Contactados por IA",
      value: aiContacts.length,
      icon: BotMessageSquare,
      accent: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950",
      subtitle: `${aiContacts.reduce((s, a) => s + a.count, 0)} mensajes enviados`,
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const selectedTag = selectedTagId ? tagStats.find((t) => t.id === selectedTagId) : null;

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Nuevas estadísticas · clic en una tarjeta para ver el detalle
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => setOpenDialog(card.key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenDialog(card.key)}
              className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.accent}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Scanner dialog */}
      <Dialog open={openDialog === "scanner"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanSearch className="h-5 w-5 text-fuchsia-600" />
              Leads desde el Escáner ({scanner.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanner.slice(0, 500).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{[s.nombre, s.apellidos].filter(Boolean).join(" ")}</TableCell>
                    <TableCell className="text-sm">{s.telefono}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email || "—"}</TableCell>
                    <TableCell className="text-sm">{s.pais || "—"}</TableCell>
                    <TableCell className="text-sm">{s.campaign_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tags dialog */}
      <Dialog open={openDialog === "tags"} onOpenChange={(o) => { if (!o) { setOpenDialog(null); setSelectedTagId(null); } }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-indigo-600" />
              Estadísticas de etiquetas
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">{tags.length} etiquetas · {totalTagged} leads etiquetados</p>
              {tagStats.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTagId(t.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition hover:bg-muted/50 ${
                    selectedTagId === t.id ? "bg-muted border-primary" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-medium">{t.nombre}</span>
                  </span>
                  <Badge variant="secondary">{t.count}</Badge>
                </button>
              ))}
              {tagStats.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No hay etiquetas creadas.</p>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
              {!selectedTag ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">
                  Selecciona una etiqueta para ver sus leads.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedTag.leads.slice(0, 300).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nombre}</TableCell>
                        <TableCell className="text-sm">{l.telefono}</TableCell>
                      </TableRow>
                    ))}
                    {selectedTag.leads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                          Sin leads con esta etiqueta.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice dialog */}
      <Dialog open={openDialog === "voice"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-pink-600" />
              CRM Realty Web-AI ({voiceLeads.length})
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {["nuevo", "contactado", "reanion", "cierre"].map((st) => {
              const count = voiceLeads.filter((v) => (v.status || "nuevo").toLowerCase() === st).length;
              return (
                <div key={st} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground capitalize">{st}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Interés</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voiceLeads.map((v) => (
                  <TableRow key={v.row}>
                    <TableCell className="font-medium">{v.nombre}</TableCell>
                    <TableCell className="text-sm">{v.telefono}</TableCell>
                    <TableCell className="text-sm">{v.tipo_interes}</TableCell>
                    <TableCell className="text-sm">{v.ubicacion}</TableCell>
                    <TableCell className="text-sm">{v.presupuesto}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.status || "nuevo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {voiceLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Sin leads del agente de voz.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI contacted dialog */}
      <Dialog open={openDialog === "ai"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BotMessageSquare className="h-5 w-5 text-teal-600" />
              Contactados por la IA ({aiContacts.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-right">Mensajes</TableHead>
                  <TableHead>Último envío</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiContacts.slice(0, 500).map((a) => (
                  <TableRow key={a.telefono}>
                    <TableCell className="font-medium">{a.nombre || "—"}</TableCell>
                    <TableCell className="text-sm">{a.telefono}</TableCell>
                    <TableCell className="text-sm">{a.pais || "—"}</TableCell>
                    <TableCell className="text-sm">{a.campaign_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.last_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

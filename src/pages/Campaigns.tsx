import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, type VistaSeguimientoCampana } from "@/lib/supabase";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<VistaSeguimientoCampana[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vista_seguimiento_campana")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (!error && data) setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const statusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case "activa": return "default";
      case "completada": return "secondary";
      case "pausada": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-accent" />
          <h2 className="text-2xl font-bold text-foreground">Campañas</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Campañas</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 && !loading ? (
            <p className="text-muted-foreground text-center py-8">No hay campañas registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Respondidos</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre_campana}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(c.estado)}>{c.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.total_leads}</TableCell>
                    <TableCell className="text-right">{c.enviados}</TableCell>
                    <TableCell className="text-right">{c.respondidos}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {c.tasa_respuesta ? `${(c.tasa_respuesta * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.fecha_creacion).toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

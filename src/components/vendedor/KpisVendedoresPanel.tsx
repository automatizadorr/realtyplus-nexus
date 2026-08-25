import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Loader2, RefreshCw, ChevronDown, ChevronRight, MessageCircle,
  Mail as MailIcon, Instagram, Facebook, PhoneCall, Radar, Bot, CalendarClock, Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { RolVenta } from "@/components/vendedor/types";

// Las RPC admin_* nuevas todavía no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Kpi = {
  user_id: string; nombre_display: string | null; rol_venta: RolVenta;
  activo: boolean; recibe_traspasos: boolean;
  leads_total: number; en_bandeja: number;
  contactado: number; interesado: number; demo: number; ganado: number; perdido: number;
  archivados: number; captados_ia: number; vencidos: number;
  traspaso_dados: number; traspaso_recibidos: number;
  cta_whatsapp: number; cta_email: number; cta_instagram: number; cta_facebook: number; cta_llamada: number;
  busquedas: number; prospectos: number;
  ultima_actividad: string | null;
};

type Busqueda = {
  id: string; nicho: string; ciudad: string; created_at: string;
  cantidad_encontrada: number; nuevos: number;
  total_leads: number; contactados: number; en_crm: number;
};

type Contacto = {
  created_at: string; canal: string; resultado: string | null;
  lead_nombre: string | null; lead_telefono: string | null; mensaje: string | null;
};

const ROL_BADGE: Record<RolVenta, string> = {
  setter: "bg-blue-500/15 text-blue-600",
  closer: "bg-violet-500/15 text-violet-600",
  ambos: "bg-emerald-500/15 text-emerald-600",
};
const ROL_LABEL: Record<RolVenta, string> = { setter: "Setter", closer: "Closer", ambos: "Setter + Closer" };

const CANAL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle, email: MailIcon, instagram: Instagram, facebook: Facebook, llamada: PhoneCall,
};
const CANAL_COLOR: Record<string, string> = {
  whatsapp: "text-emerald-600", email: "text-[#003DA5]", instagram: "text-pink-600",
  facebook: "text-blue-600", llamada: "text-amber-600",
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function haceCuanto(iso: string | null): string {
  if (!iso) return "sin actividad";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

// Contador de un canal. Se pinta apagado cuando está en cero para que de un
// vistazo se vea por dónde contacta cada vendedor y por dónde no.
function Cta({ canal, n }: { canal: string; n: number }) {
  const Icon = CANAL_ICON[canal] ?? MessageCircle;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ${n > 0 ? CANAL_COLOR[canal] : "text-muted-foreground/40"}`}
      title={`${n} por ${canal}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {n}
    </span>
  );
}

export default function KpisVendedoresPanel() {
  const { toast } = useToast();
  const [filas, setFilas] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);

  const [abierto, setAbierto] = useState<string | null>(null);
  const [busquedas, setBusquedas] = useState<Busqueda[] | null>(null);
  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb.rpc("admin_kpis_vendedores");
    if (error) toast({ title: "Error al cargar los KPIs", description: error.message, variant: "destructive" });
    else setFilas((data ?? []) as Kpi[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // El detalle se pide recién al desplegar: son dos consultas más por
  // vendedor y casi nunca se miran todos a la vez.
  const desplegar = async (uid: string) => {
    if (abierto === uid) { setAbierto(null); setBusquedas(null); setContactos(null); return; }
    setAbierto(uid); setCargandoDetalle(true); setBusquedas(null); setContactos(null);
    try {
      const [b, c] = await Promise.all([
        sb.rpc("admin_busquedas_vendedor", { _user_id: uid }),
        sb.rpc("admin_contactos_vendedor", { _user_id: uid, _limite: 30 }),
      ]);
      if (b.error) throw b.error;
      if (c.error) throw c.error;
      setBusquedas((b.data ?? []) as Busqueda[]);
      setContactos((c.data ?? []) as Contacto[]);
    } catch (e) {
      toast({ title: "No se pudo cargar el detalle", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      setAbierto(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const totales = useMemo(() => filas.reduce((a, f) => ({
    leads: a.leads + Number(f.leads_total),
    bandeja: a.bandeja + Number(f.en_bandeja),
    vencidos: a.vencidos + Number(f.vencidos),
    cta: a.cta + Number(f.cta_whatsapp) + Number(f.cta_email) + Number(f.cta_instagram) + Number(f.cta_facebook) + Number(f.cta_llamada),
  }), { leads: 0, bandeja: 0, vencidos: 0, cta: 0 }), [filas]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-[#003DA5]" /> Rendimiento del equipo
          </CardTitle>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={cargar} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {totales.leads.toLocaleString("es-CL")} leads repartidos · {totales.bandeja.toLocaleString("es-CL")} sin primer contacto ·{" "}
          {totales.cta.toLocaleString("es-CL")} contactos hechos
          {totales.vencidos > 0 && <> · <span className="font-medium text-amber-600">{totales.vencidos} con seguimiento vencido</span></>}
          . Haz clic en una fila para ver su historial de Buscar Leads y los contactos que apretó.
        </p>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right" title="Asignados pero sin primer contacto">Bandeja</TableHead>
                <TableHead className="min-w-[200px]">Pipeline</TableHead>
                <TableHead className="min-w-[150px]">Contactos por canal</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Prospección</TableHead>
                <TableHead className="hidden md:table-cell">Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8}>
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                  </div>
                </TableCell></TableRow>
              ) : filas.length === 0 ? (
                <TableRow><TableCell colSpan={8}>
                  <div className="py-8 text-center text-sm text-muted-foreground">Todavía no hay vendedores dados de alta.</div>
                </TableCell></TableRow>
              ) : filas.map((f) => (
                // El fragmento es el que va en la lista, así que la key va aquí
                // y no en las filas de adentro.
                <Fragment key={f.user_id}>
                  <TableRow
                    className="cursor-pointer align-top"
                    onClick={() => desplegar(f.user_id)}
                  >
                    <TableCell className="pt-3">
                      {abierto === f.user_id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{f.nombre_display || f.user_id.slice(0, 8)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className={`text-[10px] ${ROL_BADGE[f.rol_venta]}`}>{ROL_LABEL[f.rol_venta]}</Badge>
                        {!f.activo && <Badge variant="outline" className="text-[10px] text-muted-foreground">inactivo</Badge>}
                        {f.recibe_traspasos && (
                          <Badge variant="outline" className="text-[10px] text-violet-600" title="Entra en la rotación que recibe los leads que califican los setters">
                            recibe traspasos
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{Number(f.leads_total).toLocaleString("es-CL")}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center gap-1 font-mono text-sm ${Number(f.en_bandeja) > 0 ? "text-amber-600" : "text-muted-foreground/50"}`}>
                        <Inbox className="h-3.5 w-3.5" />{Number(f.en_bandeja).toLocaleString("es-CL")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span title="Contactado">C <b className="font-mono">{f.contactado}</b></span>
                        <span title="Interesado" className="text-[#003DA5]">I <b className="font-mono">{f.interesado}</b></span>
                        <span title="Demo" className="text-violet-600">D <b className="font-mono">{f.demo}</b></span>
                        <span title="Ganado" className="text-emerald-600">G <b className="font-mono">{f.ganado}</b></span>
                        <span title="Perdido" className="text-muted-foreground">P <b className="font-mono">{f.perdido}</b></span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                        {Number(f.captados_ia) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700"><Bot className="h-2.5 w-2.5" />{f.captados_ia} por IA</span>
                        )}
                        {Number(f.vencidos) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600"><CalendarClock className="h-2.5 w-2.5" />{f.vencidos} vencidos</span>
                        )}
                        {Number(f.traspaso_dados) > 0 && <span>{f.traspaso_dados} entregados</span>}
                        {Number(f.traspaso_recibidos) > 0 && <span>{f.traspaso_recibidos} recibidos</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Cta canal="whatsapp" n={Number(f.cta_whatsapp)} />
                        <Cta canal="email" n={Number(f.cta_email)} />
                        <Cta canal="instagram" n={Number(f.cta_instagram)} />
                        <Cta canal="facebook" n={Number(f.cta_facebook)} />
                        <Cta canal="llamada" n={Number(f.cta_llamada)} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground">
                      {Number(f.busquedas) > 0
                        ? <span className="inline-flex items-center gap-1"><Radar className="h-3 w-3 text-[#003DA5]" />{f.busquedas} búsq. · {f.prospectos}</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{haceCuanto(f.ultima_actividad)}</TableCell>
                  </TableRow>

                  {abierto === f.user_id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/20 p-3">
                        {cargandoDetalle ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando detalle…
                          </div>
                        ) : (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <Radar className="h-3.5 w-3.5 text-[#003DA5]" /> Historial de Buscar Leads
                              </div>
                              {!busquedas || busquedas.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No ha hecho búsquedas de prospección.</p>
                              ) : (
                                <div className="max-h-72 overflow-y-auto rounded border bg-background">
                                  {busquedas.map((b) => (
                                    <div key={b.id} className="border-b px-2 py-1.5 text-xs last:border-b-0">
                                      <div className="font-medium">{b.nicho} · {b.ciudad}</div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {fecha(b.created_at)} · {b.total_leads} guardados
                                        {Number(b.contactados) > 0 && <> · {b.contactados} contactados</>}
                                        {Number(b.en_crm) > 0 && <> · <span className="text-[#003DA5]">{b.en_crm} pasados al CRM</span></>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> Últimos contactos que apretó
                              </div>
                              {!contactos || contactos.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Todavía no ha apretado ningún botón de contacto.</p>
                              ) : (
                                <div className="max-h-72 overflow-y-auto rounded border bg-background">
                                  {contactos.map((c, i) => {
                                    const Icon = CANAL_ICON[c.canal] ?? MessageCircle;
                                    return (
                                      <div key={i} className="flex items-start gap-2 border-b px-2 py-1.5 text-xs last:border-b-0">
                                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CANAL_COLOR[c.canal] ?? ""}`} />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium">{c.lead_nombre || "—"}</div>
                                          <div className="text-[11px] text-muted-foreground">
                                            {fecha(c.created_at)}
                                            {c.lead_telefono && <> · {c.lead_telefono}</>}
                                            {c.resultado && <> · {c.resultado}</>}
                                          </div>
                                          {c.mensaje && <div className="truncate text-[11px] text-muted-foreground/80">{c.mensaje}</div>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

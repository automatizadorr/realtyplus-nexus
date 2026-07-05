import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, MessageSquare, TrendingUp, Zap, RefreshCw, Activity,
  ArrowUpRight, Clock, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedNumber, kpiGrid, kpiItem } from "@/components/AnimatedNumber";

// Color de avatar determinista (mismo criterio que los inbox).
const AVATAR_COLORS = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
  "#f43f5e", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Stats {
  totalContactos: number;
  respondieron: number;
  mensajesEnviados: number;
  mensajesRecibidos: number;
  sinResponder: number;
  tasaRespuesta: number;
  leadsHoy: number;
  topCampanas: { name: string; total: number; respondieron: number }[];
  mensajesPorDia: { dia: string; enviados: number; recibidos: number }[];
  recientes: { nombre: string | null; telefono: string; texto: string; tiempo: string; camp: string | null }[];
}

function relTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function ResumenTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Contactos y tasas
      const { data: inbox } = await (supabase as any)
        .from("vista_inbox_automatizacion")
        .select("telefono, nombre, pais, campaign_name, last_message_at, last_message_text, last_message_dir, ultimo_estado, unread_count")
        .limit(2000);

      const rows = (inbox || []) as any[];
      const totalContactos = rows.length;
      const respondieron = rows.filter((r: any) =>
        r.ultimo_estado?.toLowerCase() === "respondido" || (r.unread_count || 0) > 0
      ).length;
      const sinResponder = rows.filter((r: any) =>
        r.last_message_dir === "outbound" && !((r.unread_count || 0) > 0)
      ).length;
      const tasaRespuesta = totalContactos > 0
        ? Math.round((respondieron / totalContactos) * 100)
        : 0;

      // Hoy
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const leadsHoy = rows.filter((r: any) =>
        r.last_message_at && new Date(r.last_message_at) >= hoy
      ).length;

      // Top campañas
      const campMap: Record<string, { total: number; respondieron: number }> = {};
      for (const r of rows) {
        const c = r.campaign_name || "Sin campaña";
        if (!campMap[c]) campMap[c] = { total: 0, respondieron: 0 };
        campMap[c].total++;
        if ((r.unread_count || 0) > 0) campMap[c].respondieron++;
      }
      const topCampanas = Object.entries(campMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Mensajes por día (últimos 7 días)
      const { data: msgs } = await (supabase as any)
        .from("mensajes_automatizacion")
        .select("direccion, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(5000);

      const diaMap: Record<string, { enviados: number; recibidos: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        diaMap[key] = { enviados: 0, recibidos: 0 };
      }
      for (const m of (msgs || []) as any[]) {
        const key = new Date(m.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        if (diaMap[key]) {
          if (m.direccion === "outbound") diaMap[key].enviados++;
          else diaMap[key].recibidos++;
        }
      }
      const mensajesPorDia = Object.entries(diaMap).map(([dia, v]) => ({ dia, ...v }));
      const mensajesEnviados = mensajesPorDia.reduce((s, d) => s + d.enviados, 0);
      const mensajesRecibidos = mensajesPorDia.reduce((s, d) => s + d.recibidos, 0);

      // Actividad reciente (inbound)
      const recientes = rows
        .filter((r: any) => r.last_message_dir === "inbound" && r.last_message_at)
        .sort((a: any, b: any) =>
          new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        )
        .slice(0, 8)
        .map((r: any) => ({
          nombre: r.nombre,
          telefono: r.telefono,
          texto: r.last_message_text || "—",
          tiempo: relTime(r.last_message_at),
          camp: r.campaign_name,
        }));

      setStats({
        totalContactos, respondieron, mensajesEnviados, mensajesRecibidos,
        sinResponder, tasaRespuesta, leadsHoy, topCampanas, mensajesPorDia, recientes,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!stats) return null;

  const kpis = [
    { label: "Total contactos", value: stats.totalContactos, icon: Users, sub: "en automatización", wrap: "from-blue-500/20 to-blue-500/5 text-blue-600 ring-blue-500/25", bar: "from-blue-400 to-blue-600" },
    { label: "Respondieron", value: stats.respondieron, icon: CheckCircle2, sub: `${stats.tasaRespuesta}% tasa de respuesta`, wrap: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 ring-emerald-500/25", bar: "from-emerald-400 to-emerald-600" },
    { label: "Mensajes enviados", value: stats.mensajesEnviados, icon: MessageSquare, sub: "últimos 7 días", wrap: "from-indigo-500/20 to-indigo-500/5 text-indigo-600 ring-indigo-500/25", bar: "from-indigo-400 to-indigo-600" },
    { label: "Mensajes recibidos", value: stats.mensajesRecibidos, icon: ArrowUpRight, sub: "últimos 7 días", wrap: "from-violet-500/20 to-violet-500/5 text-violet-600 ring-violet-500/25", bar: "from-violet-400 to-violet-600" },
    { label: "Sin responder", value: stats.sinResponder, icon: Clock, sub: "pendientes de atención", wrap: "from-amber-500/20 to-amber-500/5 text-amber-600 ring-amber-500/25", bar: "from-amber-400 to-amber-600" },
    { label: "Activos hoy", value: stats.leadsHoy, icon: Zap, sub: "con actividad en 24h", wrap: "from-rose-500/20 to-rose-500/5 text-rose-600 ring-rose-500/25", bar: "from-rose-400 to-rose-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Resumen de automatización</h3>
          <p className="text-xs text-muted-foreground">Estadísticas en tiempo real de tus oportunidades calientes</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <motion.div variants={kpiGrid} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={kpiItem}>
            <Card className="relative h-full overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${k.bar}`} aria-hidden="true" />
              <CardContent className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase leading-tight tracking-wider text-muted-foreground">{k.label}</p>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br ring-1 ${k.wrap}`}>
                    <k.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums"><AnimatedNumber value={k.value} /></p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gráfico mensajes por día */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Mensajes últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.mensajesPorDia} barSize={14}>
                <defs>
                  <linearGradient id="autoEnviados" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="autoRecibidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(220 80% 55%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(220 80% 55%)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="enviados" name="Enviados"  fill="url(#autoEnviados)" radius={[3,3,0,0]} />
                <Bar dataKey="recibidos" name="Recibidos" fill="url(#autoRecibidos)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top campañas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top campañas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topCampanas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            ) : (
              stats.topCampanas.map((c) => {
                const pct = c.total > 0 ? Math.round((c.respondieron / c.total) * 100) : 0;
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate flex-1 pr-2">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actividad reciente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Respuestas recientes de leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay respuestas recientes</p>
          ) : (
            <div className="divide-y">
              {stats.recientes.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: avatarColor(r.nombre || r.telefono) }}
                  >
                    {(r.nombre?.[0] || r.telefono[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{r.nombre || r.telefono}</span>
                      {r.camp && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal shrink-0">
                          {r.camp}
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{r.tiempo}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{r.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

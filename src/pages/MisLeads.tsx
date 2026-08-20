import { useEffect, useState } from "react";
import { Users, Radar, Kanban, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import ProspeccionTab from "@/components/vendedor/ProspeccionTab";
import PipelineTab from "@/components/vendedor/PipelineTab";
import MisPlantillasTab from "@/components/vendedor/MisPlantillasTab";
import type { PlantillaEmail, PlantillaWa } from "@/components/vendedor/types";

// plantillas_* / RPC vendedor_kpis aún no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Kpis = {
  asignados: number; contactados: number; interesados: number; demos: number;
  ganados: number; perdidos: number; tasa_respuesta_pct: number; dias_promedio_cierre: number | null;
};

type Ranking = { mi_puesto: number; total_vendedores: number; mis_ganados: number };
type MiEquipo = { equipo_id: string; rol_equipo: "setter" | "closer"; equipos_venta: { nombre: string } | null };

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}

export default function MisLeads() {
  const [plantillasWa, setPlantillasWa] = useState<PlantillaWa[]>([]);
  const [plantillasEmail, setPlantillasEmail] = useState<PlantillaEmail[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [misEquipos, setMisEquipos] = useState<MiEquipo[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  const cargarPlantillas = async () => {
    const [{ data: wa }, { data: email }] = await Promise.all([
      sb.from("plantillas_whatsapp").select("id,nombre,contenido,creado_por,activa").order("nombre"),
      sb.from("plantillas_email").select("id,nombre,asunto,cuerpo_text,cuerpo_html,creado_por,activa").order("nombre"),
    ]);
    setPlantillasWa((wa ?? []) as PlantillaWa[]);
    setPlantillasEmail((email ?? []) as PlantillaEmail[]);
  };

  const cargarKpis = async () => {
    setLoadingKpis(true);
    const { data: userData } = await supabase.auth.getUser();
    const [{ data: kpiData }, { data: rankData }, { data: equiposData }] = await Promise.all([
      sb.rpc("vendedor_kpis"),
      sb.rpc("vendedor_ranking"),
      userData?.user
        ? sb.from("equipo_miembros").select("equipo_id, rol_equipo, equipos_venta(nombre)").eq("user_id", userData.user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setKpis((kpiData ?? [])[0] ?? null);
    setRanking((rankData ?? [])[0] ?? null);
    setMisEquipos((equiposData ?? []) as MiEquipo[]);
    setLoadingKpis(false);
  };

  useEffect(() => { cargarPlantillas(); cargarKpis(); }, []);

  // Las plantillas activas (compartidas por admin + las propias activas) son las que
  // se ofrecen para enviar; en "Mis Plantillas" se ven además las propias inactivas.
  const plantillasWaActivas = plantillasWa.filter((p) => p.activa);
  const plantillasEmailActivas = plantillasEmail.filter((p) => p.activa);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Mis Leads</h1>
          <p className="text-sm text-muted-foreground">Tu pipeline de ventas y tus leads de prospección.</p>
        </div>
      </div>

      {misEquipos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {misEquipos.map((m) => (
            <span key={m.equipo_id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <span className="font-medium">{m.equipos_venta?.nombre ?? "Equipo"}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                m.rol_equipo === "setter" ? "bg-blue-500/15 text-blue-600" : "bg-violet-500/15 text-violet-600"
              }`}>
                {m.rol_equipo === "setter" ? "Setter" : "Closer"}
              </span>
            </span>
          ))}
        </div>
      )}

      {loadingKpis ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando KPIs…</div>
      ) : kpis && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <KpiTile label="Asignados" value={kpis.asignados} />
          <KpiTile label="Contactados" value={kpis.contactados} />
          <KpiTile label="Interesados" value={kpis.interesados} />
          <KpiTile label="Demos" value={kpis.demos} />
          <KpiTile label="Ganados" value={kpis.ganados} />
          <KpiTile label="Perdidos" value={kpis.perdidos} />
          <KpiTile label="Días prom. cierre" value={kpis.dias_promedio_cierre ?? "—"} />
        </div>
      )}

      {ranking && ranking.total_vendedores > 1 && (
        <p className="text-xs text-muted-foreground">
          🏆 Tu equipo está en el puesto <span className="font-semibold text-foreground">{ranking.mi_puesto}</span> de {ranking.total_vendedores} equipos por leads ganados ({ranking.mis_ganados}).
        </p>
      )}

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5"><Kanban className="h-4 w-4" /> Pipeline</TabsTrigger>
          <TabsTrigger value="prospeccion" className="gap-1.5"><Radar className="h-4 w-4" /> Prospección</TabsTrigger>
          <TabsTrigger value="plantillas" className="gap-1.5"><FileText className="h-4 w-4" /> Mis Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineTab plantillasWa={plantillasWaActivas} plantillasEmail={plantillasEmailActivas} />
        </TabsContent>

        <TabsContent value="prospeccion">
          <ProspeccionTab plantillasWa={plantillasWaActivas} plantillasEmail={plantillasEmailActivas} />
        </TabsContent>

        <TabsContent value="plantillas">
          <MisPlantillasTab plantillasWa={plantillasWa} plantillasEmail={plantillasEmail} onChanged={cargarPlantillas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

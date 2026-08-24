import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, Loader2, GraduationCap, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PipelineTab from "@/components/vendedor/PipelineTab";
import MisPlantillasTab from "@/components/vendedor/MisPlantillasTab";
import CorreosVendedorTab from "@/components/vendedor/CorreosVendedorTab";
import BuscarLeadsVendedorTab from "@/components/vendedor/BuscarLeadsVendedorTab";
import EstadisticasTab from "@/components/vendedor/EstadisticasTab";
import BandejaTab from "@/components/vendedor/BandejaTab";
import ReactivacionChatTab from "@/components/vendedor/ReactivacionChatTab";
import RoleOnboarding, { useRoleOnboarding } from "@/components/vendedor/RoleOnboarding";
import ArchivadosDialog from "@/components/vendedor/ArchivadosDialog";
import SeccionesNav from "@/components/vendedor/SeccionesNav";
import type { CorreosResumen, PlantillaEmail, PlantillaWa, RolVenta, VendedorKpis } from "@/components/vendedor/types";

// plantillas_* / RPC vendedor_kpis aún no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Kpis = VendedorKpis;

type Ranking = { mi_puesto: number; total_vendedores: number; mis_ganados: number };

function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}

const TABS_VALIDOS = ["bandeja", "pipeline", "reactivacion", "plantillas", "diseno-correo", "buscar-leads", "estadisticas"] as const;

export default function MisLeads() {
  const { user } = useAuth();
  const { tab } = useParams<{ tab: string }>();
  const tabActivo = (TABS_VALIDOS as readonly string[]).includes(tab ?? "") ? (tab as string) : "pipeline";

  const [plantillasWa, setPlantillasWa] = useState<PlantillaWa[]>([]);
  const [plantillasEmail, setPlantillasEmail] = useState<PlantillaEmail[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [correos, setCorreos] = useState<CorreosResumen | null>(null);
  const [miRol, setMiRol] = useState<RolVenta | undefined>(undefined);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [archivadosOpen, setArchivadosOpen] = useState(false);

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
    const [{ data: kpiData }, { data: rankData }, { data: correosData }, { data: perfil }] = await Promise.all([
      sb.rpc("vendedor_kpis"),
      sb.rpc("vendedor_ranking"),
      sb.rpc("vendedor_correos_resumen"),
      userData?.user
        ? sb.from("vendedores").select("rol_venta").eq("user_id", userData.user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setKpis((kpiData ?? [])[0] ?? null);
    setRanking((rankData ?? [])[0] ?? null);
    setCorreos((correosData ?? [])[0] ?? null);
    setMiRol((perfil?.rol_venta as RolVenta | undefined) ?? undefined);
    setLoadingKpis(false);
  };

  useEffect(() => { cargarPlantillas(); cargarKpis(); }, []);

  // Las plantillas activas (compartidas por admin + las propias activas) son las que
  // se ofrecen para enviar; en "Mis Plantillas" se ven además las propias inactivas.
  const plantillasWaActivas = plantillasWa.filter((p) => p.activa);
  const plantillasEmailActivas = plantillasEmail.filter((p) => p.activa);

  // Onboarding por rol: se muestra solo una vez (por usuario+rol).
  const onboarding = useRoleOnboarding(user?.id, miRol);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Mis Leads</h1>
          <p className="text-sm text-muted-foreground">Tu pipeline de ventas.</p>
        </div>
        {miRol && (
          <Button type="button" variant="outline" size="sm" onClick={() => setArchivadosOpen(true)} className="shrink-0 gap-1.5">
            <Archive className="h-4 w-4" /> <span className="hidden sm:inline">Archivados</span>
          </Button>
        )}
        {miRol && (
          <Button type="button" variant="outline" size="sm" onClick={onboarding.reopen} className="shrink-0 gap-1.5">
            <GraduationCap className="h-4 w-4" /> <span className="hidden sm:inline">Ver tutorial</span>
          </Button>
        )}
      </div>

      {miRol && <RoleOnboarding rol={miRol} open={onboarding.open} onClose={onboarding.close} />}
      <ArchivadosDialog open={archivadosOpen} onClose={() => setArchivadosOpen(false)} />

      {miRol && (
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
          miRol === "setter" ? "bg-blue-500/15 text-blue-600" : miRol === "closer" ? "bg-violet-500/15 text-violet-600" : "bg-emerald-500/15 text-emerald-600"
        }`}>
          {miRol === "setter" ? "Setter" : miRol === "closer" ? "Closer" : "Setter + Closer"}
        </span>
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
          🏆 Estás en el puesto <span className="font-semibold text-foreground">{ranking.mi_puesto}</span> de {ranking.total_vendedores} vendedores por leads ganados ({ranking.mis_ganados}).
        </p>
      )}

      {/* La navegación entre secciones vive en el sidebar Y aquí dentro: en
          móvil el sidebar se colapsa y en escritorio obliga a salir del
          contexto, así que la misma lista está a un clic dentro de la página.
          El valor activo del Tabs viene de la URL (/mis-leads/:tab). */}
      {miRol && <SeccionesNav />}
      <Tabs value={tabActivo}>
        <TabsContent value="bandeja">
          <BandejaTab
            plantillasWa={plantillasWaActivas} plantillasEmail={plantillasEmailActivas}
            onLiberados={cargarKpis} onPlantillasChanged={cargarPlantillas}
          />
        </TabsContent>

        <TabsContent value="pipeline">
          <PipelineTab plantillasWa={plantillasWaActivas} plantillasEmail={plantillasEmailActivas} />
        </TabsContent>

        <TabsContent value="reactivacion">
          <ReactivacionChatTab />
        </TabsContent>

        <TabsContent value="plantillas">
          <MisPlantillasTab plantillasWa={plantillasWa} onChanged={cargarPlantillas} />
        </TabsContent>

        <TabsContent value="diseno-correo">
          <CorreosVendedorTab plantillasEmail={plantillasEmail} onChanged={cargarPlantillas} />
        </TabsContent>

        <TabsContent value="buscar-leads">
          <BuscarLeadsVendedorTab />
        </TabsContent>

        <TabsContent value="estadisticas">
          <EstadisticasTab kpis={kpis} correos={correos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

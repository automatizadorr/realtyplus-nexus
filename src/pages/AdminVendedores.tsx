import { useEffect, useState } from "react";
import { Users, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PAISES_PROSPECCION } from "@/lib/paises";
import AsignarLeadsPanel from "@/components/vendedor/AsignarLeadsPanel";
import KpisVendedoresPanel from "@/components/vendedor/KpisVendedoresPanel";
import CalendarioAgendamientos from "@/components/vendedor/CalendarioAgendamientos";
import type { RolVenta } from "@/components/vendedor/types";

type VendedorRow = {
  user_id: string;
  email: string;
  nombre_display: string | null;
  telefono_contacto: string | null;
  activo: boolean;
  rol_venta: RolVenta;
  limite_mensajes_dia: number;
  paises: string[];
};

// vendedores/vendedor_paises + las RPC admin_* aún no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROL_LABEL: Record<RolVenta, string> = { setter: "Setter", closer: "Closer", ambos: "Setter + Closer" };
const ROL_BADGE: Record<RolVenta, string> = {
  setter: "bg-blue-500/15 text-blue-600",
  closer: "bg-violet-500/15 text-violet-600",
  ambos: "bg-emerald-500/15 text-emerald-600",
};

export default function AdminVendedores() {
  const { toast } = useToast();
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [agregarOpen, setAgregarOpen] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoRol, setNuevoRol] = useState<RolVenta>("ambos");
  const [agregando, setAgregando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await sb.rpc("admin_listar_vendedores");
    if (error) toast({ title: "Error al cargar vendedores", description: error.message, variant: "destructive" });
    else setVendedores((data ?? []) as VendedorRow[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const agregarVendedor = async () => {
    if (!nuevoEmail.trim()) return;
    setAgregando(true);
    const { error } = await sb.rpc("admin_agregar_vendedor", { _email: nuevoEmail.trim(), _rol: nuevoRol });
    setAgregando(false);
    if (error) { toast({ title: "No se pudo agregar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Vendedor agregado" });
    setAgregarOpen(false);
    setNuevoEmail("");
    setNuevoRol("ambos");
    cargar();
  };

  const cambiarRol = async (v: VendedorRow, rol: RolVenta) => {
    const { error } = await sb.from("vendedores").update({ rol_venta: rol }).eq("user_id", v.user_id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    setVendedores((vs) => vs.map((x) => (x.user_id === v.user_id ? { ...x, rol_venta: rol } : x)));
  };

  const toggleActivo = async (v: VendedorRow, activo: boolean) => {
    const { error } = await sb.from("vendedores").update({ activo }).eq("user_id", v.user_id);
    if (error) { toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" }); return; }
    setVendedores((vs) => vs.map((x) => (x.user_id === v.user_id ? { ...x, activo } : x)));
  };

  const togglePais = async (v: VendedorRow, pais: string, marcar: boolean) => {
    if (marcar) {
      const { error } = await sb.from("vendedor_paises").insert({ user_id: v.user_id, pais });
      if (error) { toast({ title: "No se pudo agregar el país", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await sb.from("vendedor_paises").delete().eq("user_id", v.user_id).eq("pais", pais);
      if (error) { toast({ title: "No se pudo quitar el país", description: error.message, variant: "destructive" }); return; }
    }
    setVendedores((vs) => vs.map((x) => (x.user_id === v.user_id
      ? { ...x, paises: marcar ? [...x.paises, pais].sort() : x.paises.filter((p) => p !== pais) }
      : x)));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#003DA5]/10 text-[#003DA5]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Vendedores</h1>
            <p className="text-sm text-muted-foreground">Rol (setter/closer/ambos), países de prospección, y activación de cada uno.</p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setAgregarOpen(true)} className="gap-1.5 bg-[#003DA5] hover:bg-[#003DA5]/90">
          <Plus className="h-4 w-4" /> Agregar vendedor
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : vendedores.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Todavía no hay vendedores. Usa "Agregar vendedor" (la persona debe tener cuenta creada primero).
        </div>
      ) : (
        <div className="space-y-3">
          {vendedores.map((v) => (
            <Card key={v.user_id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.nombre_display || v.email}</span>
                      <Badge className={ROL_BADGE[v.rol_venta]} variant="secondary">{ROL_LABEL[v.rol_venta]}</Badge>
                      {!v.activo && <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={v.rol_venta} onValueChange={(r) => cambiarRol(v, r as RolVenta)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="setter">Setter</SelectItem>
                        <SelectItem value="closer">Closer</SelectItem>
                        <SelectItem value="ambos">Setter + Closer</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch checked={v.activo} onCheckedChange={(a) => toggleActivo(v, a)} /> Activo
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Países (Prospección)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAISES_PROSPECCION.map((p) => {
                      const activo = v.paises.includes(p);
                      return (
                        <button
                          key={p} type="button"
                          onClick={() => togglePais(v, p, !activo)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            activo ? "border-[#003DA5] bg-[#003DA5] text-white" : "border-input text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && <CalendarioAgendamientos titulo="Agenda del equipo" />}

      {!loading && vendedores.length > 0 && <KpisVendedoresPanel />}

      {!loading && vendedores.length > 0 && (
        <AsignarLeadsPanel vendedores={vendedores.filter((v) => v.activo).map((v) => ({ user_id: v.user_id, nombre_display: v.nombre_display }))} />
      )}

      <Dialog open={agregarOpen} onOpenChange={setAgregarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar vendedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email (debe tener cuenta creada)</Label>
              <Input value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="persona@gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol inicial</Label>
              <Select value={nuevoRol} onValueChange={(r) => setNuevoRol(r as RolVenta)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="setter">Setter</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="ambos">Setter + Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAgregarOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={agregarVendedor} disabled={!nuevoEmail.trim() || agregando} className="bg-[#003DA5] hover:bg-[#003DA5]/90">
              {agregando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

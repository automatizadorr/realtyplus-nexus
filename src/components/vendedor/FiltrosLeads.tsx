import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ANTIGUEDADES, contarFiltros, filtrosVacios, ORDENES, ORIGENES,
  type FiltrosLead, type OrdenLeads,
} from "@/lib/filtrosLeads";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Faceta = { pais: string; n: number };

/** Qué controles muestra cada pantalla. Lo que no aplica, no se dibuja. */
export type FiltrosVisibles = {
  origen?: boolean;
  respondio?: boolean;
  captadosIa?: boolean;
  vencidos?: boolean;
  contacto?: boolean;   // con correo / con teléfono
  antiguedad?: boolean;
  orden?: boolean;
};

const TODOS: FiltrosVisibles = {
  origen: true, respondio: true, captadosIa: true, vencidos: true,
  contacto: true, antiguedad: true, orden: true,
};

/**
 * Barra de búsqueda + panel de filtros, compartida por Hoy, Bandeja y
 * Pipeline. El texto se escribe con debounce (350 ms) para no disparar una
 * consulta por tecla; el resto de los filtros se aplican al tocarlos.
 *
 * La lista de países sale de vendedor_paises(): son los países que el
 * vendedor TIENE, con su conteo. Una lista fija ofrecería países sin un
 * solo lead y escondería los que no estuvieran en ella.
 */
export default function FiltrosLeads({ filtros, onChange, visibles = TODOS, resultados }: {
  filtros: FiltrosLead;
  onChange: (f: FiltrosLead) => void;
  visibles?: FiltrosVisibles;
  /** Cuántos leads quedaron con los filtros puestos, para mostrarlo al lado. */
  resultados?: number | null;
}) {
  const [qInput, setQInput] = useState(filtros.q);
  const [abierto, setAbierto] = useState(false);
  const [paises, setPaises] = useState<Faceta[]>([]);
  const activos = contarFiltros(filtros);

  useEffect(() => {
    let vivo = true;
    sb.rpc("vendedor_paises").then(({ data }: { data: Faceta[] | null }) => {
      if (vivo && data) setPaises(data);
    });
    return () => { vivo = false; };
  }, []);

  // Si el filtro se limpia desde afuera ("Limpiar"), el input tiene que
  // seguirlo; si no, queda texto escrito que ya no se está aplicando.
  useEffect(() => { setQInput(filtros.q); }, [filtros.q]);

  useEffect(() => {
    if (qInput === filtros.q) return;
    const t = setTimeout(() => onChange({ ...filtros, q: qInput }), 350);
    return () => clearTimeout(t);
  }, [qInput, filtros, onChange]);

  const set = <K extends keyof FiltrosLead>(clave: K, valor: FiltrosLead[K]) =>
    onChange({ ...filtros, [clave]: valor });

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput} onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono…"
            className="h-8 pl-8 text-xs"
          />
          {qInput && (
            <button
              type="button" onClick={() => setQInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* El país es el filtro que más se usa, así que va afuera del panel:
            a un clic, sin abrir nada. */}
        <Select value={filtros.pais} onValueChange={(v) => set("pais", v)}>
          <SelectTrigger className="h-8 w-[168px] text-xs"><SelectValue placeholder="País" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los países</SelectItem>
            {paises.map((p) => (
              <SelectItem key={p.pais} value={p.pais}>{p.pais} ({p.n})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button" size="sm" variant={abierto || activos > 0 ? "secondary" : "outline"}
          onClick={() => setAbierto((v) => !v)} className="h-8 gap-1.5 text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
          {activos > 0 && <span className="rounded-full bg-[#003DA5] px-1.5 text-[10px] text-white">{activos}</span>}
        </Button>

        {activos > 0 && (
          <Button
            type="button" size="sm" variant="ghost"
            onClick={() => onChange(filtrosVacios())}
            className="h-8 gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </Button>
        )}

        {typeof resultados === "number" && (
          <span className="ml-auto text-xs text-muted-foreground">
            {resultados.toLocaleString("es-CL")} resultado{resultados === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {abierto && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2">
          {visibles.origen && (
            <Select value={filtros.origen} onValueChange={(v) => set("origen", v)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGENES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {visibles.antiguedad && (
            <Select value={filtros.antiguedad} onValueChange={(v) => set("antiguedad", v)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANTIGUEDADES.map((a) => <SelectItem key={a.valor} value={a.valor}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {visibles.orden && (
            <Select value={filtros.orden} onValueChange={(v) => set("orden", v as OrdenLeads)}>
              <SelectTrigger className="h-8 w-[195px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDENES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {visibles.respondio && (
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={filtros.respondio} onCheckedChange={(v) => set("respondio", v)} />
              Solo los que respondieron
            </label>
          )}

          {visibles.vencidos && (
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={filtros.vencidos} onCheckedChange={(v) => set("vencidos", v)} />
              Seguimiento vencido
            </label>
          )}

          {visibles.captadosIa && (
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={filtros.captadosIa} onCheckedChange={(v) => set("captadosIa", v)} />
              <Bot className="h-3 w-3 text-emerald-600" /> Captados por IA
            </label>
          )}

          {visibles.contacto && (
            <>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={filtros.conEmail} onCheckedChange={(v) => set("conEmail", v)} />
                Con correo
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={filtros.conTelefono} onCheckedChange={(v) => set("conTelefono", v)} />
                Con teléfono marcable
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

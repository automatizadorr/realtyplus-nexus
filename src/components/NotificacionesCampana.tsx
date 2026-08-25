import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

// Las RPC de notificaciones aún no están en el types.ts generado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Notif = {
  id: string; tipo: string; titulo: string; cuerpo: string | null;
  lead_id: string | null; url: string | null;
  leida_at: string | null; created_at: string;
};

// Cada cuánto se vuelve a preguntar por notificaciones nuevas. No hay
// realtime: un sondeo de un minuto es una consulta barata (un count) y
// evita mantener una suscripción abierta por usuario.
const INTERVALO_MS = 60_000;

function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default function NotificacionesCampana() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const contar = useCallback(async () => {
    const { data, error } = await sb.rpc("notificaciones_sin_leer");
    if (!error && typeof data === "number") setSinLeer(data);
  }, []);

  useEffect(() => {
    contar();
    const iv = setInterval(contar, INTERVALO_MS);
    return () => clearInterval(iv);
  }, [contar]);

  // La lista completa se pide solo al abrir la campana; el sondeo de fondo
  // trae únicamente el contador.
  const abrir = async (v: boolean) => {
    setAbierto(v);
    if (!v) return;
    setCargando(true);
    const { data } = await sb.rpc("notificaciones_listar", { _limite: 30 });
    setItems((data ?? []) as Notif[]);
    setCargando(false);
  };

  const marcarTodas = async () => {
    await sb.rpc("notificaciones_marcar_leidas", { _ids: null });
    setItems((xs) => (xs ?? []).map((x) => ({ ...x, leida_at: x.leida_at ?? new Date().toISOString() })));
    setSinLeer(0);
  };

  const ir = async (n: Notif) => {
    if (!n.leida_at) {
      await sb.rpc("notificaciones_marcar_leidas", { _ids: [n.id] });
      setSinLeer((x) => Math.max(0, x - 1));
    }
    setAbierto(false);
    if (n.url) navigate(n.url);
  };

  return (
    <Popover open={abierto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {sinLeer > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#003DA5] px-1 text-[10px] font-semibold text-white">
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {sinLeer > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={marcarTodas}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
            </Button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : !items || items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nada por ahora. Aquí llegan los cierres de negocio, los leads que te traspasan y las reuniones nuevas.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => ir(n)}
                className={`block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 ${n.leida_at ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.leida_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#003DA5]" />}
                  <div className={`min-w-0 flex-1 ${n.leida_at ? "pl-3.5" : ""}`}>
                    <div className="text-xs font-medium leading-snug">{n.titulo}</div>
                    {n.cuerpo && <div className="text-[11px] leading-snug text-muted-foreground">{n.cuerpo}</div>}
                    <div className="text-[10px] text-muted-foreground/70">{haceCuanto(n.created_at)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

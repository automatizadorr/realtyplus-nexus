import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowRight, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FormattedText } from "@/lib/whatsappFormat";
import { countryFlag } from "@/lib/countryFlag";

export interface HotLead {
  telefono: string;
  nombre: string;
  pais: string | null;
}

interface Msg {
  id: string | number;
  contenido: string | null;
  direccion: string;
  created_at: string;
}

const digits = (t: string) => String(t || "").split("@")[0].replace(/\D/g, "");

const AVATAR_COLORS = ["#0ea5e9", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6"];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < (seed || "?").length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function HotLeadDialog({
  lead,
  onOpenChange,
  onGoToLead,
}: {
  lead: HotLead | null;
  onOpenChange: (open: boolean) => void;
  onGoToLead: (telefono: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    (async () => {
      const { data } = await (supabase as any)
        .from("vista_mensajes_whatsapp")
        .select("id, contenido, direccion, created_at")
        .eq("phone_key", digits(lead.telefono))
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setMessages(((data as Msg[]) || []).slice().reverse());
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 60);
    })();
    return () => { cancelled = true; };
  }, [lead]);

  return (
    <Dialog open={!!lead} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b bg-muted/30 p-4">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: avatarColor(lead?.nombre || lead?.telefono || "?") }}
          >
            {(lead?.nombre?.trim()?.[0] || "#").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="truncate text-base">
              {lead?.pais ? `${countryFlag(lead.pais)} ` : ""}{lead?.nombre || "Sin nombre"}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">{lead?.telefono}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Caliente
          </span>
        </DialogHeader>

        <ScrollArea className="h-[52vh] px-4 py-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-6 w-6 opacity-40" />
              No se encontraron mensajes para este contacto.
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => {
                const out = m.direccion === "outbound";
                return (
                  <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        out ? "rounded-br-sm bg-emerald-500 text-white" : "rounded-bl-sm bg-muted text-foreground"
                      }`}
                    >
                      {m.contenido && <FormattedText text={m.contenido} />}
                      <div className={`mt-1 text-[10px] ${out ? "text-white/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t bg-muted/30 p-3">
          <Button
            className="w-full bg-[#003DA5] text-white hover:bg-[#003DA5]/90"
            onClick={() => lead && onGoToLead(lead.telefono)}
          >
            Ir a la conversación en el inbox
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HotLeadDialog;
